import type { SupabaseClient } from "@supabase/supabase-js";

export const ONBOARDING_FIRST_LOG_COOKIE = "paco_onboarding_log";

export type OnboardingLogKind = "dose" | "weight";

export function onboardingFirstLogCookiePath(
  locale: string,
  kind: OnboardingLogKind,
) {
  return `/${locale}/log/${kind}`;
}

export async function hasConsumedOnboardingFirstLog(
  supabase: SupabaseClient,
  userId: string,
) {
  const [doseRes, weightRes] = await Promise.all([
    supabase
      .from("doses")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_entries")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
  ]);

  // Fail closed: if the eligibility check cannot run, do not grant bypass.
  if (doseRes.error || weightRes.error) return true;
  return Boolean(doseRes.data || weightRes.data);
}

export function clearOnboardingFirstLogCookie(
  cookieStore: {
    set: (
      name: string,
      value: string,
      options: { path: string; maxAge: number },
    ) => void;
  },
  locale: string,
) {
  for (const kind of ["dose", "weight"] as const) {
    cookieStore.set(ONBOARDING_FIRST_LOG_COOKIE, "", {
      path: onboardingFirstLogCookiePath(locale, kind),
      maxAge: 0,
    });
  }
}
