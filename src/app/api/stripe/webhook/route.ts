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

type ProfileTier = "free" | "pro" | "trialing" | "past_due_grace";

type ProfileUpdate = {
  stripe_price_id?: string | null;
  subscription_tier?: ProfileTier;
};

/**
 * Map a Stripe subscription status to the corresponding DB tier.
 *
 *   trialing                                    → 'trialing'
 *   active                                      → 'pro'
 *   past_due                                    → 'past_due_grace'
 *   unpaid | canceled | incomplete |
 *   incomplete_expired | paused                 → 'free'
 *
 * The DB CHECK constraint added in 0004_subscription_tier_extended.sql
 * enforces this set at write time.
 */
function tierFromSubscriptionStatus(
  status: Stripe.Subscription.Status,
): ProfileTier {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "pro";
    case "past_due":
      return "past_due_grace";
    default:
      return "free";
  }
}

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
        // Tier derived from the subscription's status (trialing for the
        // 7-day reverse trial; active for immediate-pay or post-trial).
        // Fallback to "pro" only if for some reason the session has no
        // subscription attached (defensive — every Checkout we create is
        // mode:subscription so this branch should not be reachable).
        let tier: ProfileTier = "pro";
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          priceId = priceIdFromSubscription(sub);
          tier = tierFromSubscriptionStatus(sub.status);
        } else {
          console.warn(
            "[stripe/webhook] checkout.session.completed without subscription",
            { sessionId: session.id, customerId },
          );
        }

        await applyToProfile(customerId, supabaseUserId, {
          stripe_price_id: priceId,
          subscription_tier: tier,
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = priceIdFromSubscription(sub);
        await applyToProfile(customerId, null, {
          stripe_price_id: priceId,
          subscription_tier: tierFromSubscriptionStatus(sub.status),
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
      case "invoice.payment_failed": {
        // Defense-in-depth: Stripe will also emit customer.subscription.updated
        // with status='past_due' alongside this event. Either handler reaching
        // the DB first lands the user in past_due_grace; the second is a
        // no-op write of the same value. Stays in grace until either:
        //   • next charge attempt succeeds → subscription.updated active → 'pro'
        //   • dunning gives up             → subscription.deleted        → 'free'
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        if (!customerId) break;
        await applyToProfile(customerId, null, {
          subscription_tier: "past_due_grace",
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
