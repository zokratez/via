import { NextRequest } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { trackServerEvent } from "@/lib/analytics/server";
import type { AnalyticsLocale, AnalyticsProps } from "@/lib/analytics/events";

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
  subscription_expires_at?: string | null;
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
): Promise<string | null> {
  const admin = getAdminClient();

  const byCustomer = await admin
    .from("profiles")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id")
    .maybeSingle();

  if (byCustomer.data) return byCustomer.data.id as string;

  if (fallbackUserId) {
    const fallback = await admin
      .from("profiles")
      .update({ ...update, stripe_customer_id: customerId })
      .eq("id", fallbackUserId)
      .select("id")
      .maybeSingle();
    return fallback.data ? (fallback.data.id as string) : null;
  }

  return null;
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : price.id;
}

function periodEndFromSubscription(sub: Stripe.Subscription): string | null {
  const periodEnd = sub.items?.data?.[0]?.current_period_end;
  return typeof periodEnd === "number"
    ? new Date(periodEnd * 1000).toISOString()
    : null;
}

function localeFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): AnalyticsLocale {
  return metadata?.locale === "en" ? "en" : "es";
}

function analyticsPropsFromMetadata(
  source: string,
  metadata: Stripe.Metadata | null | undefined,
): AnalyticsProps {
  return {
    source,
    plan:
      metadata?.plan === "monthly" || metadata?.plan === "annual"
        ? metadata.plan
        : null,
  };
}

async function trackSubscriptionConversion(input: {
  tier: ProfileTier;
  userId: string | null;
  locale: AnalyticsLocale;
  props: AnalyticsProps;
}) {
  if (!input.userId) return;
  if (input.tier === "trialing") {
    await trackServerEvent({
      eventName: "trial_started",
      locale: input.locale,
      userId: input.userId,
      props: input.props,
    });
  }
  if (input.tier === "pro") {
    await trackServerEvent({
      eventName: "subscription_active",
      locale: input.locale,
      userId: input.userId,
      props: input.props,
    });
  }
}

async function subscriptionFromInvoice(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<Stripe.Subscription | null> {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) return null;
  const subscriptionId =
    typeof subscription === "string" ? subscription : subscription.id;
  return stripe.subscriptions.retrieve(subscriptionId);
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
        // 2-day reverse trial; active for immediate-pay or post-trial).
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
          const profileId = await applyToProfile(customerId, supabaseUserId, {
            stripe_price_id: priceId,
            subscription_tier: tier,
            subscription_expires_at: periodEndFromSubscription(sub),
          });
          await trackSubscriptionConversion({
            tier,
            userId: profileId,
            locale: localeFromMetadata(session.metadata),
            props: analyticsPropsFromMetadata("checkout", session.metadata),
          });
          break;
        } else {
          console.warn(
            "[stripe/webhook] checkout.session.completed without subscription",
            { sessionId: session.id, customerId },
          );
        }

        const profileId = await applyToProfile(customerId, supabaseUserId, {
          stripe_price_id: priceId,
          subscription_tier: tier,
          subscription_expires_at: null,
        });
        await trackSubscriptionConversion({
          tier,
          userId: profileId,
          locale: localeFromMetadata(session.metadata),
          props: analyticsPropsFromMetadata("checkout", session.metadata),
        });
        break;
      }
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = priceIdFromSubscription(sub);
        const supabaseUserId =
          (sub.metadata?.supabase_user_id as string | undefined) ?? null;
        const tier = tierFromSubscriptionStatus(sub.status);
        const profileId = await applyToProfile(customerId, supabaseUserId, {
          stripe_price_id: priceId,
          subscription_tier: tier,
          subscription_expires_at: periodEndFromSubscription(sub),
        });
        await trackSubscriptionConversion({
          tier,
          userId: profileId,
          locale: localeFromMetadata(sub.metadata),
          props: analyticsPropsFromMetadata("subscription_created", sub.metadata),
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const priceId = priceIdFromSubscription(sub);
        const tier = tierFromSubscriptionStatus(sub.status);
        const profileId = await applyToProfile(customerId, null, {
          stripe_price_id: priceId,
          subscription_tier: tier,
          subscription_expires_at: periodEndFromSubscription(sub),
        });
        await trackSubscriptionConversion({
          tier,
          userId: profileId,
          locale: localeFromMetadata(sub.metadata),
          props: analyticsPropsFromMetadata("subscription_updated", sub.metadata),
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
          subscription_expires_at: null,
        });
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        if (!customerId) break;
        const sub = await subscriptionFromInvoice(stripe, invoice);
        if (!sub) break;
        const tier = tierFromSubscriptionStatus(sub.status);
        const profileId = await applyToProfile(customerId, null, {
          stripe_price_id: priceIdFromSubscription(sub),
          subscription_tier: tier,
          subscription_expires_at: periodEndFromSubscription(sub),
        });
        await trackSubscriptionConversion({
          tier,
          userId: profileId,
          locale: localeFromMetadata(sub.metadata),
          props: analyticsPropsFromMetadata("invoice_paid", sub.metadata),
        });
        break;
      }
      case "invoice.payment_failed": {
        // Payment failure keeps access only while Stripe still reports the
        // subscription as past_due. Terminal/non-pro statuses map to free via
        // tierFromSubscriptionStatus so failed dunning cannot leak Pro access.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        if (!customerId) break;
        const sub = await subscriptionFromInvoice(stripe, invoice);
        if (sub) {
          await applyToProfile(customerId, null, {
            stripe_price_id: priceIdFromSubscription(sub),
            subscription_tier: tierFromSubscriptionStatus(sub.status),
            subscription_expires_at: periodEndFromSubscription(sub),
          });
        } else {
          await applyToProfile(customerId, null, {
            subscription_tier: "past_due_grace",
          });
        }
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
