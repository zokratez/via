/**
 * GET /api/stripe/upgrade?plan=annual|monthly&locale=es|en
 *
 * Server-side redirect target for the reverse-trial paywall page guards
 * (commit F). Creates a Stripe Checkout session and 302s to the hosted
 * Stripe URL. Used when a logged-in free-tier user hits /coach,
 * /dashboard, or /log/* — the page guard reads their cookie/default
 * plan and forwards them here.
 *
 * Why a GET endpoint that 302s, instead of reusing POST /checkout:
 *   - POST returns JSON { url } — useful for client-side fetches (the
 *     in-coach upgrade button) but not for server-component redirects.
 *   - Server components call `redirect()` with a URL; that URL has to
 *     itself respond with the Stripe redirect, not JSON.
 *
 * Auth: must be logged in. Page guards already verify this before
 * forwarding here; defensive redirect to /auth/sign-in on missing user.
 *
 * Errors all redirect to homepage with `?error=...` so the user is
 * never stuck on an API endpoint.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCheckoutSession,
  isCheckoutLocale,
  isCheckoutPlan,
} from "@/lib/stripe/checkout-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const planParam = url.searchParams.get("plan");
  const localeParam = url.searchParams.get("locale");

  const plan = isCheckoutPlan(planParam) ? planParam : "annual";
  const locale = isCheckoutLocale(localeParam) ? localeParam : "es";
  const origin = url.origin;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/auth/sign-in`, origin));
  }

  const result = await createCheckoutSession({
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    plan,
    locale,
    origin,
  });

  if (!result.ok) {
    console.error("[stripe/upgrade] session failed", { reason: result.reason });
    return NextResponse.redirect(
      new URL(`/${locale}/?error=checkout_failed`, origin),
    );
  }

  return NextResponse.redirect(result.url, { status: 302 });
}
