import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMiMetaSignalState,
  type NutritionTargets,
} from "@/lib/mimeta/signals";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

type Locale = "es" | "en";

function toLocale(value: string): Locale {
  return value === "en" ? "en" : "es";
}

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string; logged?: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = toLocale(localeParam);
  const search = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, nutrition_goal_type",
    )
    .eq("id", user!.id)
    .maybeSingle();

  const nutritionTargets: NutritionTargets = {
    dailyCalories: profile?.daily_calorie_target ?? null,
    proteinG: profile?.protein_target_g ?? null,
    carbsG: profile?.carbs_target_g ?? null,
    fatG: profile?.fat_target_g ?? null,
    goalType: profile?.nutrition_goal_type ?? null,
  };
  const signal = await getMiMetaSignalState({
    supabase,
    userId: user!.id,
    locale,
    nutritionTargets,
  });
  const t = await getTranslations({ locale, namespace: "onboarding" });
  const logged =
    search.logged === "dose" || search.logged === "weight"
      ? search.logged
      : null;
  const initialStep = search.step === "aha" && logged ? "aha" : "welcome";

  return (
    <OnboardingClient
      locale={locale}
      initialStep={initialStep}
      loggedKind={logged}
      miMetaSentence={signal.statusSentence}
      bukowskiLine={t(logged === "dose" ? "aha_bukowski_dose" : "aha_bukowski_weight")}
    />
  );
}
