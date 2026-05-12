/**
 * Server-side paywall guard.
 *
 * If the user's subscription_tier doesn't grant active access, redirect
 * them to /api/stripe/upgrade. The plan defaults to "annual", but if the
 * user clicked a homepage CTA with ?plan=monthly|annual we recorded
 * that in the pp_intent_plan cookie (see proxy.ts) — read it back here
 * so they end up at the Checkout they expected.
 *
 * Page contract: callers pass the tier they already read from the
 * profiles row (coach/dashboard both read it for other reasons). The
 * log layout reads tier itself just to call this helper. Either way,
 * one DB read per request — no duplicate fetches.
 *
 * Race-window bypass: the Stripe Checkout `success_url` points to
 * /[locale]/coach?upgraded=true. If the user lands there before the
 * webhook has flipped their tier, a free-tier check would loop them
 * back to Checkout. Callers pass `upgradedBypass: true` when the
 * incoming request carries ?upgraded=true, and the helper allows the
 * page to render once. Subsequent hits (without the query param) will
 * redirect again until the webhook lands — but by then the user is
 * already inside the app, so the redirect is invisible.
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isActiveSubscriber } from "@/lib/subscription";

export type CheckoutPlan = "annual" | "monthly";

function readPlanCookie(value: string | undefined): CheckoutPlan {
  return value === "monthly" ? "monthly" : "annual";
}

export async function enforceActiveSubscription(opts: {
  tier: string | null | undefined;
  locale: "es" | "en";
  upgradedBypass?: boolean;
}): Promise<void> {
  const { tier, locale, upgradedBypass } = opts;

  if (isActiveSubscriber(tier)) return;
  if (upgradedBypass) return;

  const cookieStore = await cookies();
  const plan = readPlanCookie(cookieStore.get("pp_intent_plan")?.value);

  // /api/stripe/upgrade is NOT i18n-prefixed (matcher excludes /api/*),
  // so use plain next/navigation `redirect`, not @/i18n/navigation.
  redirect(`/api/stripe/upgrade?plan=${plan}&locale=${locale}`);
}
