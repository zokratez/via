/**
 * Shared Stripe Checkout session creator for the reverse-trial paywall.
 *
 * Two HTTP endpoints call this:
 *   - POST /api/stripe/checkout — JSON contract, used by in-coach upgrade
 *     button (CoachChat.tsx). Returns { url } on success.
 *   - GET  /api/stripe/upgrade  — Redirect contract, used by page guards
 *     (commit F). Returns 302 to Stripe URL.
 *
 * Both flows produce identical Checkout sessions:
 *   - mode: subscription
 *   - 7-day trial (subscription_data.trial_period_days)
 *   - allow_promotion_codes
 *   - payment_method_collection: "always" — required for trial; Stripe
 *     collects the card upfront but does not charge until day 7.
 *   - success_url: /[locale]/coach?upgraded=true (one-shot bypass on the
 *     page guard handles the webhook delivery gap — see SCOPE_PROPOSAL
 *     section 5).
 *   - cancel_url: /[locale]/?canceled=true (homepage, not /coach,
 *     because first-time-signup flow lands here from the homepage).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "./server";

export type CheckoutPlan = "annual" | "monthly";
export type CheckoutLocale = "es" | "en";

export function isCheckoutPlan(v: unknown): v is CheckoutPlan {
  return v === "annual" || v === "monthly";
}

export function isCheckoutLocale(v: unknown): v is CheckoutLocale {
  return v === "es" || v === "en";
}

export type CreateCheckoutSessionInput = {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string | null;
  plan: CheckoutPlan;
  locale: CheckoutLocale;
  origin: string;
};

export type CreateCheckoutSessionFailure =
  | "missing_price_env"
  | "persist_customer_failed"
  | "stripe_failed"
  | "no_url";

export type CreateCheckoutSessionResult =
  | { ok: true; url: string }
  | { ok: false; reason: CreateCheckoutSessionFailure };

function priceForPlan(plan: CheckoutPlan): string | undefined {
  return plan === "annual"
    ? process.env.STRIPE_PRICE_ID_VIA_PRO_ANNUAL
    : process.env.STRIPE_PRICE_ID_VIA_PRO;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const { supabase, userId, userEmail, plan, locale, origin } = input;

  const priceId = priceForPlan(plan);
  if (!priceId) {
    return { ok: false, reason: "missing_price_env" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const stripe = getStripe();
  let stripeCustomerId =
    (profile as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: userEmail ?? undefined,
      metadata: { supabase_user_id: userId },
    });
    stripeCustomerId = customer.id;
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", userId);
    if (updateErr) {
      console.error("[stripe/checkout-session] persist customer", updateErr);
      return { ok: false, reason: "persist_customer_failed" };
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: stripeCustomerId,
      success_url: `${origin}/${locale}/coach?upgraded=true`,
      cancel_url: `${origin}/${locale}/?canceled=true`,
      locale: locale === "es" ? "es" : "en",
      metadata: { supabase_user_id: userId, plan },
      subscription_data: {
        trial_period_days: 7,
        metadata: { supabase_user_id: userId, plan },
      },
      allow_promotion_codes: true,
      payment_method_collection: "always",
    });
    if (!session.url) {
      return { ok: false, reason: "no_url" };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    console.error("[stripe/checkout-session] stripe.create", err);
    return { ok: false, reason: "stripe_failed" };
  }
}
