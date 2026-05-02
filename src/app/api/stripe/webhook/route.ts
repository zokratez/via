import { NextRequest } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service-role env vars missing");
  }
  return createSupabaseAdmin(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type ProfileUpdate = {
  stripe_price_id?: string | null;
  subscription_tier?: "free" | "pro";
};

async function applyToProfile(
  customerId: string,
  fallbackUserId: string | null,
  update: ProfileUpdate,
): Promise<void> {
  const admin = getAdminClient();

  const byCustomer = await admin
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id")
    .maybeSingle();

  if (byCustomer.data) return;

  if (fallbackUserId) {
    await admin
      .from("profiles")
      .update({ ...update, stripe_customer_id: customerId })
      .eq("id", fallbackUserId);
  }
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET missing");
    return jsonResponse(500, { error: "generic" });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(400, { error: "missing_signature" });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed", err);
    return jsonResponse(400, { error: "invalid_signature" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        if (!customerId) break;

        const supabaseUserId =
          (session.metadata?.supabase_user_id as string | undefined) ?? null;

        let priceId: string | null = null;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          priceId = priceIdFromSubscription(sub);
        }

        await applyToProfile(customerId, supabaseUserId, {
          stripe_price_id: priceId,
          subscription_tier: "pro",
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = priceIdFromSubscription(sub);
        const isActive = sub.status === "active" || sub.status === "trialing";
        await applyToProfile(customerId, null, {
          stripe_price_id: priceId,
          subscription_tier: isActive ? "pro" : "free",
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await applyToProfile(customerId, null, {
          stripe_price_id: null,
          subscription_tier: "free",
        });
        break;
      }
      default: {
        console.log("[stripe/webhook] unhandled event", event.type);
      }
    }
  } catch (err) {
    console.error("[stripe/webhook] handler error", err);
    Sentry.captureException(err);
    return jsonResponse(500, { error: "generic" });
  }

  return jsonResponse(200, { received: true });
}
