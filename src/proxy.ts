import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

const AUTH_SIGN_PATH_RE = /^\/(es|en)\/auth\/sign-(in|up)\/?$/;
const VALID_PLANS = new Set(["annual", "monthly"]);
const INTENT_COOKIE = "pp_intent_plan";
const INTENT_COOKIE_MAX_AGE = 60 * 60; // 1 hour

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request) ?? NextResponse.next();
  const response = await updateSession(request, intlResponse);

  // Reverse-trial paywall intent capture.
  // When the user clicks an EMPEZAR / pricing CTA on the homepage with
  // ?plan=annual|monthly, persist that choice in a short-lived cookie
  // so the page guard (commit F) routes the post-signup user into the
  // matching Checkout. Does NOT touch the sign-up page itself per the
  // Day 7-8 constraint.
  const planParam = request.nextUrl.searchParams.get("plan");
  if (
    planParam &&
    VALID_PLANS.has(planParam) &&
    AUTH_SIGN_PATH_RE.test(request.nextUrl.pathname)
  ) {
    response.cookies.set(INTENT_COOKIE, planParam, {
      maxAge: INTENT_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|auth/callback|.*\\..*).*)"],
};
