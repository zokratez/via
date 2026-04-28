import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "@/components/CoachChat";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

const FREE_TIER_DAILY_LIMIT = 3;

function todayInMexicoCity(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export default async function CoachPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
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
    .select("subscription_tier")
    .eq("id", user!.id)
    .maybeSingle();
  const tier = profile?.subscription_tier ?? "free";
  const isPro = tier === "pro";

  let initialQuotaRemaining = FREE_TIER_DAILY_LIMIT;
  if (!isPro) {
    const today = todayInMexicoCity();
    const { data: counter } = await supabase
      .from("usage_counters")
      .select("coach_queries")
      .eq("user_id", user!.id)
      .eq("day", today)
      .maybeSingle();
    const used = counter?.coach_queries ?? 0;
    initialQuotaRemaining = Math.max(0, FREE_TIER_DAILY_LIMIT - used);
  }

  return (
    <CoachChat
      locale={locale as "es" | "en"}
      isPro={isPro}
      initialQuotaRemaining={initialQuotaRemaining}
    />
  );
}
