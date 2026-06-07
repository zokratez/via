import { NextRequest, NextResponse } from "next/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  hasConsumedOnboardingFirstLog,
  ONBOARDING_FIRST_LOG_COOKIE,
  onboardingFirstLogCookiePath,
  type OnboardingLogKind,
} from "@/lib/onboarding/first-log";

const KINDS = new Set(["dose", "weight"]);
const LOCALES = new Set(["es", "en"]);

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "";
  const locale = req.nextUrl.searchParams.get("locale") ?? "es";
  const safeKind = (KINDS.has(kind) ? kind : "weight") as OnboardingLogKind;
  const safeLocale = LOCALES.has(locale) ? locale : "es";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale: safeLocale });
  }

  const alreadyConsumed = await hasConsumedOnboardingFirstLog(
    supabase,
    user!.id,
  );
  if (alreadyConsumed) {
    redirect({ href: "/today", locale: safeLocale });
  }

  const url = new URL(`/${safeLocale}/log/${safeKind}`, req.nextUrl.origin);
  url.searchParams.set("from", "onboarding");

  const response = NextResponse.redirect(url);
  response.cookies.set(ONBOARDING_FIRST_LOG_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: onboardingFirstLogCookiePath(safeLocale, safeKind),
    maxAge: 10 * 60,
  });
  return response;
}
