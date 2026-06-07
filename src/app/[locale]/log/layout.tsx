/**
 * Server-component layout for /log/* routes.
 *
 * The page components (dose, weight, symptom) are "use client" forms
 * with no server-side guard. This layout runs server-side BEFORE those
 * pages render, performing the auth + paywall check and redirecting
 * away if needed. If the user is allowed, {children} renders normally.
 *
 * Why a layout (not a refactor of the three pages):
 *   - Pages stay untouched (small diff, low risk).
 *   - One auth + tier check covers all three log surfaces.
 *   - Layouts in App Router run server-side regardless of whether their
 *     children are client components.
 */

import { redirect } from "@/i18n/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  hasConsumedOnboardingFirstLog,
  ONBOARDING_FIRST_LOG_COOKIE,
} from "@/lib/onboarding/first-log";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

export default async function LogLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user!.id)
    .maybeSingle();

  const cookieStore = await cookies();
  const hasBypassCookie =
    cookieStore.get(ONBOARDING_FIRST_LOG_COOKIE)?.value === "1";
  const canUseOnboardingFirstLog =
    hasBypassCookie &&
    !(await hasConsumedOnboardingFirstLog(supabase, user!.id));

  if (!canUseOnboardingFirstLog) {
    await enforceActiveSubscription({
      tier: profile?.subscription_tier,
      locale: locale as "es" | "en",
    });
  }

  return <>{children}</>;
}
