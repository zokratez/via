import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "@/components/CoachChat";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { isActiveSubscriber } from "@/lib/subscription";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

const FREE_TIER_DAILY_LIMIT = 3;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InitialMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type CoachContextCard = {
  title: string;
  body: string;
  prompts: string[];
};

function todayInMexicoCity(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default async function CoachPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ upgraded?: string; thread?: string }>;
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
    .select(
      "subscription_tier, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g, nutrition_goal_type",
    )
    .eq("id", user!.id)
    .maybeSingle();
  const tier = profile?.subscription_tier ?? "free";

  // Paywall gate. ?upgraded=true is the one-shot bypass for the race
  // window between Stripe success redirect and webhook delivery.
  const sp = await searchParams;
  await enforceActiveSubscription({
    tier,
    locale: locale as "es" | "en",
    upgradedBypass: sp.upgraded === "true",
  });

  const isPro = isActiveSubscriber(tier);
  const requestedThreadId =
    typeof sp.thread === "string" && UUID_RE.test(sp.thread)
      ? sp.thread
      : null;

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

  let initialThreadId: string | null = null;
  let initialMessages: InitialMessage[] = [];
  if (requestedThreadId) {
    const { data: thread } = await supabase
      .from("coach_threads")
      .select("id")
      .eq("id", requestedThreadId)
      .eq("user_id", user!.id)
      .maybeSingle();

    if (thread) {
      const { data: rows } = await supabase
        .from("coach_messages")
        .select("id, role, content, created_at")
        .eq("thread_id", requestedThreadId)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });

      initialThreadId = thread.id;
      initialMessages = ((rows ?? []) as Array<{
        id: string;
        role: string;
        content: string;
      }>)
        .filter((m): m is InitialMessage =>
          m.role === "user" || m.role === "assistant",
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
    }
  }

  const t = await getTranslations("coach");
  const today = todayInMexicoCity();
  const [foodTodayRes, waterTodayRes, dosesTodayRes] = await Promise.all([
    supabase
      .from("food_photos")
      .select("eaten_at, calories_estimate, protein_g, carbs_g, fat_g")
      .gte("eaten_at", today),
    supabase
      .from("water_entries")
      .select("drank_at, amount_ml")
      .gte("drank_at", today),
    supabase.from("doses").select("taken_at, peptide_name").gte("taken_at", today),
  ]);

  const foodRows = ((foodTodayRes.data ?? []) as Array<{
    eaten_at: string;
    calories_estimate: number | string | null;
    protein_g: number | string | null;
    carbs_g: number | string | null;
    fat_g: number | string | null;
  }>).filter((row) => row.eaten_at.startsWith(today));
  const foodTotals = foodRows.reduce(
    (totals, row) => {
      totals.calories += numberOrNull(row.calories_estimate) ?? 0;
      totals.protein += numberOrNull(row.protein_g) ?? 0;
      totals.carbs += numberOrNull(row.carbs_g) ?? 0;
      totals.fat += numberOrNull(row.fat_g) ?? 0;
      return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const waterTotalMl = ((waterTodayRes.data ?? []) as Array<{
    drank_at: string;
    amount_ml: number | string | null;
  }>)
    .filter((row) => row.drank_at.startsWith(today))
    .reduce((sum, row) => sum + (numberOrNull(row.amount_ml) ?? 0), 0);
  const dosesToday = ((dosesTodayRes.data ?? []) as Array<{
    taken_at: string;
    peptide_name: string | null;
  }>).filter((row) => row.taken_at.startsWith(today));

  const calorieTarget = numberOrNull(profile?.daily_calorie_target);
  const proteinTarget = numberOrNull(profile?.protein_target_g);
  const contextPrompts: string[] = [];

  if (!calorieTarget && !proteinTarget) {
    contextPrompts.push(t("context_prompt_set_goal"));
  }

  if (proteinTarget && foodTotals.protein < proteinTarget) {
    contextPrompts.push(
      t("context_prompt_protein_gap", {
        current: Math.round(foodTotals.protein),
        target: Math.round(proteinTarget),
      }),
    );
  }

  if (dosesToday.length > 0 && waterTotalMl < 1500) {
    contextPrompts.push(
      t("context_prompt_dose_hydration", {
        water: Math.round(waterTotalMl),
      }),
    );
  }

  if (foodRows.length > 0 || waterTotalMl > 0 || dosesToday.length > 0) {
    contextPrompts.push(
      t("context_prompt_daily_map", {
        calories: Math.round(foodTotals.calories),
        protein: Math.round(foodTotals.protein),
        water: Math.round(waterTotalMl),
        doses: dosesToday.length,
      }),
    );
  }

  const contextCard: CoachContextCard = {
    title: t("context_card_title"),
    body: t("context_card_body"),
    prompts: Array.from(new Set(contextPrompts)).slice(0, 3),
  };

  return (
    <CoachChat
      locale={locale as "es" | "en"}
      isPro={isPro}
      initialQuotaRemaining={initialQuotaRemaining}
      initialThreadId={initialThreadId}
      initialMessages={initialMessages}
      contextCard={contextCard}
    />
  );
}
