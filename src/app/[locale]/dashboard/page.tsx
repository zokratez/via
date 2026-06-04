import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ManageSubscriptionLink } from "@/components/ManageSubscriptionLink";
import { SignOutButton } from "@/components/SignOutButton";
import { type WeightPoint } from "@/components/WeightChart";
import { type DosePoint } from "@/components/DoseTimeline";
import { type SymptomEntry } from "@/components/SymptomChart";
import { type SleepEntry } from "@/components/SleepChart";
import { type CoachThread } from "@/components/CoachHistory";
import { BukowskiObservation } from "@/components/BukowskiObservation";
import { DashboardTabs, type TabKey } from "@/components/DashboardTabs";
import { DoseStrip, type DoseStripDose } from "@/components/DoseStrip";
import {
  AlertBanner,
  type MedicationWithLastDose,
} from "@/components/AlertBanner";
import { MiMeta } from "@/components/MiMeta";
import { MetricTile } from "@/components/MetricTile";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { getMiMetaSignalState } from "@/lib/mimeta/signals";
import { isActiveSubscriber } from "@/lib/subscription";
import { enforceActiveSubscription } from "@/lib/subscription-guard";

function greetingKey(now = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

const SITE_KEYS = {
  abdomen_left: "site_abdomen_left",
  abdomen_right: "site_abdomen_right",
  thigh_left: "site_thigh_left",
  thigh_right: "site_thigh_right",
  arm_left: "site_arm_left",
  arm_right: "site_arm_right",
} as const;

type SiteKey = keyof typeof SITE_KEYS;

function isKnownSite(s: string | null | undefined): s is SiteKey {
  return !!s && s in SITE_KEYS;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const showSavedToast =
    sp.ok === "dose" ||
    sp.ok === "weight" ||
    sp.ok === "symptom" ||
    sp.ok === "sleep";
  const VALID_TABS: readonly TabKey[] = [
    "doses",
    "weight",
    "symptoms",
    "sleep",
    "coach",
  ];
  const initialTab = (VALID_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as TabKey)
    : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, subscription_tier, goal_weight_kg")
    .eq("id", user!.id)
    .maybeSingle();

  // Paywall gate. Dashboard is not the Stripe success_url target so no
  // ?upgraded=true bypass is needed here (success_url goes to /coach).
  await enforceActiveSubscription({
    tier: profile?.subscription_tier,
    locale: locale as "es" | "en",
  });

  const name =
    profile?.display_name?.trim() ||
    (user!.email ? user!.email.split("@")[0] : "");
  const hasStripeSubscription = isActiveSubscriber(profile?.subscription_tier);

  const now = new Date();
  const cutoff14 = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const [
    lastDoseRes,
    weights90Res,
    doses14Res,
    weights14Res,
    symptoms14Res,
    doses90Res,
    symptoms90Res,
    sleep90Res,
    threadsRes,
    medsForAlertsRes,
    lastDosePerMedRes,
    anyWeightRes,
    anyCoachMsgRes,
    food14Res,
    progress14Res,
  ] = await Promise.all([
    supabase
      .from("doses")
      .select("taken_at, injection_site, peptide_name")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_entries")
      .select("measured_at, weight_kg, waist_cm")
      .gte("measured_at", cutoff90)
      .order("measured_at", { ascending: true }),
    supabase.from("doses").select("taken_at").gte("taken_at", cutoff14),
    supabase
      .from("weight_entries")
      .select("measured_at")
      .gte("measured_at", cutoff14),
    supabase
      .from("side_effects")
      .select("occurred_at")
      .gte("occurred_at", cutoff14),
    supabase
      .from("doses")
      .select(
        "taken_at, dose_mg, injection_site, peptide_name, medications(name, generic_name)",
      )
      .gte("taken_at", cutoff90)
      .order("taken_at", { ascending: true }),
    supabase
      .from("side_effects")
      .select("occurred_at, category, severity, notes")
      .gte("occurred_at", cutoff90)
      .order("occurred_at", { ascending: true }),
    supabase
      .from("sleep_entries")
      .select("slept_at, hours, quality, notes")
      .gte("slept_at", cutoff90.slice(0, 10))
      .order("slept_at", { ascending: true }),
    supabase
      .from("coach_threads")
      .select(
        "id, title, created_at, updated_at, coach_messages(role, content, created_at)",
      )
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("medications")
      .select("id, name, generic_name")
      .eq("is_active", true),
    supabase
      .from("doses")
      .select("medication_id, taken_at")
      .order("taken_at", { ascending: false }),
    supabase
      .from("weight_entries")
      .select("id")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("coach_messages")
      .select("id")
      .eq("role", "user")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("food_photos")
      .select("eaten_at, calories_estimate, protein_g, carbs_g, fat_g")
      .gte("eaten_at", cutoff14),
    supabase
      .from("progress_photos")
      .select("captured_at, angle")
      .gte("captured_at", cutoff14)
      .order("captured_at", { ascending: false }),
  ]);

  const t = await getTranslations("dashboard");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");
  const tDose = await getTranslations("dose");
  const tMiMeta = await getTranslations("mimeta");
  const miMetaSignal = await getMiMetaSignalState({
    supabase,
    userId: user!.id,
    locale: locale as "es" | "en",
    now,
  });
  const miMetaActionLabel = (href: string) => {
    if (href === "/log/weight") return tMiMeta("action_log_weight");
    if (href === "/log/dose") return tMiMeta("action_log_dose");
    if (href === "/log/sleep") return tMiMeta("action_log_sleep");
    if (href === "/calculadora" || href === "/calculator") {
      return tMiMeta("action_calculator");
    }
    if (href === "/diario" || href === "/journal") {
      return tMiMeta("action_journal");
    }
    if (href === "/coach") return tMiMeta("action_coach");
    return "";
  };
  const signalState = {
    ...miMetaSignal,
    statusSentence:
      miMetaSignal.statusSentence.trim().length > 0
        ? miMetaSignal.statusSentence
        : tMiMeta("empty_state_sentence"),
    nextActions: miMetaSignal.nextActions.map((action) => ({
      ...action,
      label: miMetaActionLabel(action.href) || action.label,
    })),
  };

  const key = greetingKey(now);
  const greeting =
    key === "morning"
      ? t("greeting_morning", { name })
      : key === "afternoon"
        ? t("greeting_afternoon", { name })
        : t("greeting_evening", { name });

  const lastDose = lastDoseRes.data as DoseStripDose;
  let lastDoseStr: string;
  let lastDoseSubStr: string | null = null;
  if (!lastDose) {
    lastDoseStr = t("stat_empty");
  } else {
    const minutes = Math.floor(
      (Date.now() - new Date(lastDose.taken_at).getTime()) / 60_000,
    );
    if (minutes < 1) lastDoseStr = t("time_just_now");
    else if (minutes < 60)
      lastDoseStr = t("time_minutes_short", { count: minutes });
    else if (minutes < 60 * 24)
      lastDoseStr = t("time_hours_short", { count: Math.floor(minutes / 60) });
    else
      lastDoseStr = t("time_days_short", {
        count: Math.floor(minutes / (60 * 24)),
      });
    if (isKnownSite(lastDose.injection_site)) {
      lastDoseSubStr = tDose(SITE_KEYS[lastDose.injection_site]);
    }
  }

  type WeightRow = {
    measured_at: string;
    weight_kg: number | string;
    waist_cm: number | string | null;
  };
  const weights90 = ((weights90Res.data ?? []) as WeightRow[]).map((w) => ({
    measured_at: w.measured_at,
    weight_kg: Number(w.weight_kg),
    waist_cm: w.waist_cm === null ? null : Number(w.waist_cm),
  }));
  const chartData: WeightPoint[] = weights90.map((w) => ({
    date: w.measured_at,
    weight: w.weight_kg,
    waist: w.waist_cm,
  }));
  const goalWeight =
    profile?.goal_weight_kg === null || profile?.goal_weight_kg === undefined
      ? null
      : Number(profile.goal_weight_kg);

  let weightLatestStr = t("stat_empty");
  let weightDeltaStr: string | null = null;
  if (weights90.length > 0) {
    const latest = weights90[weights90.length - 1];
    weightLatestStr = `${latest.weight_kg.toFixed(1)} kg`;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const baseline = [...weights90]
      .reverse()
      .find((w) => new Date(w.measured_at).getTime() <= sevenDaysAgo);
    if (baseline) {
      const delta = latest.weight_kg - baseline.weight_kg;
      const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
      const abs = Math.abs(delta).toFixed(1);
      weightDeltaStr = `${sign}${abs} kg ${t("delta_label")}`;
    }
  }

  type DoseRow = {
    taken_at: string;
    dose_mg: number | string;
    injection_site: string | null;
    peptide_name: string | null;
    medications:
      | { name: string | null; generic_name: string | null }
      | { name: string | null; generic_name: string | null }[]
      | null;
  };
  type ThreadRow = {
    id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
    coach_messages:
      | Array<{
          role: "user" | "assistant" | "system";
          content: string;
          created_at: string;
        }>
      | null;
  };
  const coachThreads: CoachThread[] = (
    (threadsRes.data ?? []) as ThreadRow[]
  ).map((th) => ({
    id: th.id,
    title: th.title,
    created_at: th.created_at,
    updated_at: th.updated_at,
    messages: (th.coach_messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    })),
  }));

  const sleepEntries: SleepEntry[] = (
    (sleep90Res.data ?? []) as Array<{
      slept_at: string;
      hours: number | string;
      quality: number;
      notes: string | null;
    }>
  ).map((s) => ({
    slept_at: s.slept_at,
    hours: Number(s.hours),
    quality: s.quality,
    notes: s.notes,
  }));

  const symptomEntries: SymptomEntry[] = (
    (symptoms90Res.data ?? []) as Array<{
      occurred_at: string;
      category: string;
      severity: number;
      notes: string | null;
    }>
  ).map((s) => ({
    occurred_at: s.occurred_at,
    category: s.category,
    severity: s.severity,
    notes: s.notes,
  }));

  const dosePoints: DosePoint[] = ((doses90Res.data ?? []) as DoseRow[]).map(
    (d) => {
      const med = Array.isArray(d.medications)
        ? d.medications[0] ?? null
        : d.medications;
      return {
        taken_at: d.taken_at,
        dose_mg: Number(d.dose_mg),
        injection_site: d.injection_site,
        medication_name: d.peptide_name ?? med?.name ?? null,
        generic_name: med?.generic_name ?? null,
      };
    },
  );

  type MedRow = { id: string; name: string; generic_name: string | null };
  const medsForAlerts = (medsForAlertsRes.data ?? []) as MedRow[];
  const lastDoseByMed = new Map<string, string>();
  for (const r of (lastDosePerMedRes.data ?? []) as {
    medication_id: string | null;
    taken_at: string;
  }[]) {
    if (!r.medication_id) continue;
    if (!lastDoseByMed.has(r.medication_id)) {
      lastDoseByMed.set(r.medication_id, r.taken_at);
    }
  }
  const alertMedications: MedicationWithLastDose[] = medsForAlerts.map((m) => ({
    id: m.id,
    name: m.name,
    generic_name: m.generic_name,
    last_dose_at: lastDoseByMed.get(m.id) ?? null,
  }));

  const hasDose = lastDose !== null;
  const hasWeight = (anyWeightRes.data as { id: string } | null) !== null;
  const hasCoach = (anyCoachMsgRes.data as { id: string } | null) !== null;

  const todayKey = now.toISOString().slice(0, 10);
  const cutoff7Time = now.getTime() - 7 * 86_400_000;
  const recentSleep = sleepEntries.filter(
    (s) => new Date(s.slept_at).getTime() >= cutoff7Time,
  );
  const averageSleepHours =
    recentSleep.length > 0
      ? recentSleep.reduce((sum, s) => sum + s.hours, 0) / recentSleep.length
      : null;
  const symptomCount14 = (symptoms14Res.data ?? []).length;
  const coachQuestionCount = coachThreads.reduce(
    (sum, thread) =>
      sum + thread.messages.filter((message) => message.role === "user").length,
    0,
  );
  type FoodRow = {
    eaten_at: string;
    calories_estimate: number | string | null;
    protein_g: number | string | null;
    carbs_g: number | string | null;
    fat_g: number | string | null;
  };
  const foodRows14 = ((food14Res.data ?? []) as FoodRow[]).map((food) => ({
    eaten_at: food.eaten_at,
    calories: food.calories_estimate === null ? 0 : Number(food.calories_estimate),
    protein: food.protein_g === null ? 0 : Number(food.protein_g),
    carbs: food.carbs_g === null ? 0 : Number(food.carbs_g),
    fat: food.fat_g === null ? 0 : Number(food.fat_g),
  }));
  const foodToday = foodRows14.filter((food) => food.eaten_at.startsWith(todayKey));
  const foodTodayTotals = foodToday.reduce(
    (totals, food) => {
      totals.calories += Number.isFinite(food.calories) ? food.calories : 0;
      totals.protein += Number.isFinite(food.protein) ? food.protein : 0;
      totals.carbs += Number.isFinite(food.carbs) ? food.carbs : 0;
      totals.fat += Number.isFinite(food.fat) ? food.fat : 0;
      return totals;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  type ProgressRow = {
    captured_at: string;
    angle: string | null;
  };
  const progressRows14 = (progress14Res.data ?? []) as ProgressRow[];
  const latestProgressPhoto = progressRows14[0] ?? null;
  const progressDaysAgo = latestProgressPhoto
    ? Math.floor(
        (now.getTime() - new Date(latestProgressPhoto.captured_at).getTime()) /
          86_400_000,
      )
    : null;
  const latestWeightDate =
    weights90.length > 0 ? weights90[weights90.length - 1].measured_at : null;
  const lastSleepDate =
    sleepEntries.length > 0
      ? sleepEntries[sleepEntries.length - 1].slept_at
      : null;

  const nextAction =
    !hasWeight
      ? {
          href: "/check-in",
          label: t("today_next_weight"),
          detail: t("today_next_weight_detail"),
        }
      : lastSleepDate !== todayKey
        ? {
            href: "/check-in",
            label: t("today_next_sleep"),
            detail: t("today_next_sleep_detail"),
          }
        : latestWeightDate !== todayKey
          ? {
              href: "/check-in",
              label: t("today_next_checkin"),
              detail: t("today_next_checkin_detail"),
            }
          : foodToday.length === 0
            ? {
                href: "/food",
                label: t("today_next_food"),
                detail: t("today_next_food_detail"),
              }
            : {
                href: "/coach",
                label: t("today_next_coach"),
                detail: t("today_next_coach_detail"),
              };

  const days = new Set<string>();
  for (const r of (doses14Res.data ?? []) as { taken_at: string }[]) {
    days.add(r.taken_at.slice(0, 10));
  }
  for (const r of (weights14Res.data ?? []) as { measured_at: string }[]) {
    days.add(r.measured_at.slice(0, 10));
  }
  for (const r of (symptoms14Res.data ?? []) as { occurred_at: string }[]) {
    days.add(r.occurred_at.slice(0, 10));
  }
  for (const r of foodRows14) {
    days.add(r.eaten_at.slice(0, 10));
  }
  for (const r of progressRows14) {
    days.add(r.captured_at.slice(0, 10));
  }
  const streakCount = days.size;

  const makeDayKey = (daysAgo: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  };
  const rhythmDays = Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const key = makeDayKey(daysAgo);
    return {
      key,
      label:
        daysAgo === 0
          ? t("rhythm_today")
          : new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
              new Date(`${key}T12:00:00`),
            ),
      dose: ((doses14Res.data ?? []) as { taken_at: string }[]).some((r) =>
        r.taken_at.startsWith(key),
      ),
      weight: ((weights14Res.data ?? []) as { measured_at: string }[]).some(
        (r) => r.measured_at.startsWith(key),
      ),
      symptoms: (
        (symptoms14Res.data ?? []) as { occurred_at: string }[]
      ).filter((r) => r.occurred_at.startsWith(key)).length,
      sleep: sleepEntries.some((s) => s.slept_at.startsWith(key)),
      food: foodRows14.some((f) => f.eaten_at.startsWith(key)),
      progress: progressRows14.some((p) => p.captured_at.startsWith(key)),
    };
  });
  const rhythmTotals = rhythmDays.reduce(
    (totals, day) => {
      totals.dose += day.dose ? 1 : 0;
      totals.weight += day.weight ? 1 : 0;
      totals.symptoms += day.symptoms;
      totals.sleep += day.sleep ? 1 : 0;
      totals.food += day.food ? 1 : 0;
      totals.progress += day.progress ? 1 : 0;
      return totals;
    },
    { dose: 0, weight: 0, symptoms: 0, sleep: 0, food: 0, progress: 0 },
  );
  const bukowskiObservation = t("bukowski_observation_body", {
    dose: rhythmTotals.dose,
    sleep: rhythmTotals.sleep,
    food: rhythmTotals.food,
  });

  const actions = [
    { href: "/check-in", label: t("action_checkin") },
    { href: "/food", label: t("action_food") },
    { href: "/progress", label: t("action_progress") },
    { href: "/log/dose", label: t("log_dose") },
    { href: "/log/weight", label: t("log_weight") },
    { href: "/log/symptom", label: t("log_symptom") },
    { href: "/log/sleep", label: t("log_sleep") },
    { href: "/coach", label: t("action_coach") },
  ] as const;
  const foodMetricSubLabel =
    foodToday.length === 0
      ? t("metric_food_empty")
      : t("metric_food_today", { count: foodToday.length });
  const metricTiles = [
    {
      metric: "protein",
      icon: "meat",
      value:
        foodTodayTotals.protein > 0
          ? `${Math.round(foodTodayTotals.protein)} g`
          : t("stat_empty"),
      label: t("metric_protein"),
      sublabel: foodMetricSubLabel,
      badge: foodToday.length > 0 ? t("metric_badge_today") : undefined,
      href: "/food",
    },
    {
      metric: "water",
      icon: "droplet",
      value: t("stat_empty"),
      label: t("metric_water"),
      sublabel: t("metric_healthkit_later"),
      badge: undefined,
      href: undefined,
    },
    {
      metric: "steps",
      icon: "walk",
      value: t("metric_coming_soon"),
      label: t("metric_steps"),
      sublabel: t("metric_iphone_app"),
      badge: undefined,
      href: undefined,
      comingSoon: true,
    },
    {
      metric: "calories",
      icon: "flame",
      value:
        foodTodayTotals.calories > 0
          ? `${Math.round(foodTodayTotals.calories)} kcal`
          : t("stat_empty"),
      label: t("metric_calories"),
      sublabel: t("metric_calories_consumed_today"),
      badge: foodToday.length > 0 ? t("metric_badge_today") : undefined,
      href: "/food",
    },
    {
      metric: "sleep",
      icon: "moon-stars",
      value:
        averageSleepHours === null
          ? t("stat_empty")
          : `${averageSleepHours.toFixed(1)} h`,
      label: t("metric_sleep"),
      sublabel: t("today_tile_sleep_sub"),
      badge: undefined,
      href: "/dashboard?tab=sleep#dashboard-tabs",
    },
    {
      metric: "weight",
      icon: "scale",
      value: weightLatestStr,
      label: t("metric_weight"),
      sublabel: weightDeltaStr ?? t("metric_latest_record"),
      badge: undefined,
      href: "/dashboard?tab=weight#dashboard-tabs",
    },
  ] as const;

  const SERIF = "var(--pp-font-serif)";
  const SANS = "var(--pp-font-sans)";

  const navLinkStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "12px",
    letterSpacing: "0.24em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    textDecoration: "none",
  };

  const eyebrowStyle: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "var(--pp-text-secondary)",
    fontWeight: 500,
    margin: 0,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--pp-surface)",
    border: "0.5px solid var(--pp-border)",
    borderRadius: "6px",
    padding: "1.25rem",
  };

  const statValueStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontStyle: "italic",
    fontSize: "22px",
    color: "var(--pp-text)",
    margin: "0.5rem 0 0",
  };

  const statSubStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontSize: "14px",
    color: "var(--pp-text-secondary)",
    margin: "0.25rem 0 0",
  };

  const actionStyle: React.CSSProperties = {
    ...cardStyle,
    textAlign: "center",
    display: "block",
    textDecoration: "none",
    color: "var(--pp-accent)",
    fontFamily: SANS,
    fontSize: "11px",
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    fontWeight: 500,
    padding: "1.25rem 0.75rem",
  };

  const primaryActionStyle: React.CSSProperties = {
    ...actionStyle,
    background: "var(--pp-accent)",
    color: "var(--pp-bg)",
    borderColor: "var(--pp-accent)",
    fontWeight: 600,
    fontSize: "12px",
  };

  const journalHref = locale === "es" ? "/diario" : "/journal";
  const calculatorHref = locale === "es" ? "/calculadora" : "/calculator";

  const commandTileStyle: React.CSSProperties = {
    border: "0.5px solid rgba(201, 150, 107, 0.22)",
    borderRadius: "10px",
    padding: "0.9rem",
    background: "rgba(26, 22, 20, 0.5)",
    minHeight: "92px",
  };

  const commandValueStyle: React.CSSProperties = {
    fontFamily: SERIF,
    fontStyle: "italic",
    color: "var(--pp-text)",
    fontSize: "22px",
    lineHeight: 1.1,
    margin: "0.35rem 0 0",
  };

  const commandSubStyle: React.CSSProperties = {
    fontFamily: SANS,
    color: "var(--pp-text-tertiary)",
    fontSize: "11px",
    lineHeight: 1.5,
    margin: "0.35rem 0 0",
  };

  const metricAccents = {
    dose: "#f0a15f",
    sleep: "#7db9ff",
    symptoms: "#ef7b8a",
    coach: "#88d39f",
    food: "#d6a06f",
    progress: "#c9966b",
  } as const;

  const colorTileStyle = (
    color: string,
    backgroundAlpha = "0.08",
  ): React.CSSProperties => ({
    ...commandTileStyle,
    textDecoration: "none",
    borderColor: `${color}66`,
    background: `linear-gradient(145deg, color-mix(in srgb, ${color} ${Number(backgroundAlpha) * 100}%, transparent), rgba(26, 22, 20, 0.62))`,
    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 36px color-mix(in srgb, ${color} 8%, transparent)`,
  });

  const rhythmDotStyle = (
    active: boolean,
    color: string,
  ): React.CSSProperties => ({
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: active ? color : "rgba(244, 237, 224, 0.12)",
    boxShadow: active ? `0 0 16px ${color}80` : "none",
  });

  return (
    <div
      className="flex flex-col flex-1"
      style={{
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        fontFamily: SERIF,
        minHeight: "100vh",
      }}
    >
      <header
        className="mx-auto w-full"
        style={{
          maxWidth: "880px",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link href="/dashboard" style={navLinkStyle}>
          {tApp("name")}
        </Link>
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <Link href={journalHref} style={navLinkStyle}>
            {t("nav_diario")}
          </Link>
          <Link href={calculatorHref} style={navLinkStyle}>
            {t("nav_calculator")}
          </Link>
          <Link href="/calendar" style={navLinkStyle}>
            {t("nav_calendar")}
          </Link>
          {hasStripeSubscription && (
            <ManageSubscriptionLink locale={locale as "es" | "en"} />
          )}
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main
        className="flex-1 mx-auto w-full"
        style={{ maxWidth: "720px", padding: "2.5rem 2rem 5rem" }}
      >
        {showSavedToast && (
          <div
            role="status"
            style={{
              marginBottom: "1.5rem",
              padding: "0.75rem 1rem",
              border: "0.5px solid var(--pp-accent)",
              borderRadius: "6px",
              color: "var(--pp-accent)",
              fontFamily: SANS,
              fontSize: "12px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            {t("toast_saved")}
          </div>
        )}

        <h1
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(36px, 6vw, 48px)",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            fontWeight: 400,
            color: "var(--pp-text)",
            margin: 0,
          }}
        >
          {greeting}
        </h1>

        <AlertBanner
          medications={alertMedications}
          locale={locale as "es" | "en"}
        />

        <section
          style={{
            ...cardStyle,
            marginTop: "2.25rem",
            padding: "1rem",
            background:
              "linear-gradient(135deg, rgba(201, 150, 107, 0.12), rgba(34, 28, 25, 0.96) 42%, rgba(26, 22, 20, 0.98))",
            borderColor: "rgba(201, 150, 107, 0.28)",
          }}
          className="pp-fade-up"
          aria-label={t("today_title")}
        >
          <div
            className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]"
            style={{ alignItems: "stretch" }}
          >
            <div>
              <p style={eyebrowStyle}>{t("today_eyebrow")}</p>
              <h2
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: "clamp(30px, 7vw, 44px)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  fontWeight: 400,
                  color: "var(--pp-text)",
                  margin: "0.65rem 0 0",
                }}
              >
                {t("today_title")}
              </h2>
              <p
                style={{
                  fontFamily: SERIF,
                  color: "var(--pp-text-secondary)",
                  fontSize: "17px",
                  lineHeight: 1.55,
                  margin: "0.9rem 0 0",
                }}
              >
                {t("today_body")}
              </p>
            </div>

            <Link
              href={nextAction.href}
              style={{
                ...commandTileStyle,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                textDecoration: "none",
                borderColor: "rgba(201, 150, 107, 0.55)",
              }}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_next_label")}</p>
              <div>
                <p style={{ ...commandValueStyle, color: "var(--pp-accent)" }}>
                  {nextAction.label}
                </p>
                <p style={commandSubStyle}>{nextAction.detail}</p>
              </div>
            </Link>
          </div>

          <div className="pp-today-glass-stack">
            <DoseStrip lastDose={lastDose} t={t} tDose={tDose} />

            <BukowskiObservation observation={bukowskiObservation} t={t} />
          </div>

          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
            style={{ marginTop: "1rem" }}
          >
            <Link
              href="/dashboard?tab=doses#dashboard-tabs"
              style={colorTileStyle(metricAccents.dose)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_dose")}</p>
              <p style={{ ...commandValueStyle, color: metricAccents.dose }}>
                {lastDoseStr}
              </p>
              <p style={commandSubStyle}>
                {lastDoseSubStr ?? t("today_tile_dose_empty")}
              </p>
            </Link>

            <Link
              href="/dashboard?tab=sleep#dashboard-tabs"
              style={colorTileStyle(metricAccents.sleep)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_sleep")}</p>
              <p style={{ ...commandValueStyle, color: metricAccents.sleep }}>
                {averageSleepHours === null
                  ? t("stat_empty")
                  : `${averageSleepHours.toFixed(1)} h`}
              </p>
              <p style={commandSubStyle}>{t("today_tile_sleep_sub")}</p>
            </Link>

            <Link
              href="/food"
              style={colorTileStyle(metricAccents.food)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_food")}</p>
              <p style={{ ...commandValueStyle, color: metricAccents.food }}>
                {foodToday.length === 0
                  ? t("stat_empty")
                  : `${Math.round(foodTodayTotals.calories)} kcal`}
              </p>
              <p style={commandSubStyle}>
                {foodToday.length === 0
                  ? t("today_tile_food_empty")
                  : t("today_tile_food_sub", {
                      meals: foodToday.length,
                      protein: Math.round(foodTodayTotals.protein),
                    })}
              </p>
            </Link>

            <Link
              href="/progress"
              style={colorTileStyle(metricAccents.progress)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_progress")}</p>
              <p
                style={{ ...commandValueStyle, color: metricAccents.progress }}
              >
                {progressDaysAgo === null
                  ? t("stat_empty")
                  : progressDaysAgo === 0
                    ? t("today_tile_progress_today")
                    : t("today_tile_progress_days", { days: progressDaysAgo })}
              </p>
              <p style={commandSubStyle}>
                {latestProgressPhoto?.angle
                  ? t("today_tile_progress_sub", {
                      angle: latestProgressPhoto.angle,
                    })
                  : t("today_tile_progress_empty")}
              </p>
            </Link>

            <Link
              href="/dashboard?tab=symptoms#dashboard-tabs"
              style={colorTileStyle(metricAccents.symptoms)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_symptoms")}</p>
              <p
                style={{ ...commandValueStyle, color: metricAccents.symptoms }}
              >
                {symptomCount14}
              </p>
              <p style={commandSubStyle}>{t("today_tile_symptoms_sub")}</p>
            </Link>

            <Link
              href="/dashboard?tab=coach#dashboard-tabs"
              style={colorTileStyle(metricAccents.coach)}
              className="pp-stat-card"
            >
              <p style={eyebrowStyle}>{t("today_tile_coach")}</p>
              <p style={{ ...commandValueStyle, color: metricAccents.coach }}>
                {coachQuestionCount}
              </p>
              <p style={commandSubStyle}>{t("today_tile_coach_sub")}</p>
            </Link>
          </div>

          <div
            style={{
              marginTop: "1rem",
              border: "0.5px solid rgba(244, 237, 224, 0.09)",
              borderRadius: "10px",
              padding: "0.95rem",
              background: "rgba(8, 6, 5, 0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                marginBottom: "0.8rem",
              }}
            >
              <p style={eyebrowStyle}>{t("rhythm_title")}</p>
              <p
                style={{
                  ...commandSubStyle,
                  margin: 0,
                  color: "var(--pp-text-secondary)",
                }}
              >
                {t("rhythm_summary", {
                  dose: rhythmTotals.dose,
                  weight: rhythmTotals.weight,
                  sleep: rhythmTotals.sleep,
                  food: rhythmTotals.food,
                  progress: rhythmTotals.progress,
                  symptoms: rhythmTotals.symptoms,
                })}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: "0.45rem",
              }}
              aria-label={t("rhythm_title")}
            >
              {rhythmDays.map((day) => (
                <Link
                  key={day.key}
                  href={`/calendar?ym=${day.key.slice(0, 7)}&d=${day.key}`}
                  className="pp-rhythm-day"
                  style={{
                    minHeight: "76px",
                    borderRadius: "9px",
                    padding: "0.55rem 0.35rem",
                    background:
                      day.dose || day.weight || day.sleep || day.symptoms > 0
                        ? "rgba(244, 237, 224, 0.055)"
                        : "rgba(244, 237, 224, 0.025)",
                    border: "0.5px solid rgba(244, 237, 224, 0.07)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.45rem",
                    color: "inherit",
                  }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: "9px",
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--pp-text-secondary)",
                    }}
                  >
                    {day.label}
                  </span>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 1fr)",
                      gap: "0.32rem",
                    }}
                  >
                    <span
                      title={t("today_tile_dose")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(day.dose, metricAccents.dose)}
                    />
                    <span
                      title={t("today_tile_sleep")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(day.sleep, metricAccents.sleep)}
                    />
                    <span
                      title={t("today_tile_food")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(day.food, metricAccents.food)}
                    />
                    <span
                      title={t("today_tile_progress")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(day.progress, metricAccents.progress)}
                    />
                    <span
                      title={t("stat_weight")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(day.weight, "var(--pp-accent)")}
                    />
                    <span
                      title={t("today_tile_symptoms")}
                      className="pp-rhythm-dot"
                      style={rhythmDotStyle(
                        day.symptoms > 0,
                        metricAccents.symptoms,
                      )}
                    />
                  </div>
                </Link>
              ))}
            </div>

            <div
              className="grid gap-2 sm:grid-cols-6"
              style={{ marginTop: "0.8rem" }}
            >
              {[
                {
                  href: "/dashboard?tab=doses#dashboard-tabs",
                  label: t("today_tile_dose"),
                  color: metricAccents.dose,
                },
                {
                  href: "/dashboard?tab=sleep#dashboard-tabs",
                  label: t("today_tile_sleep"),
                  color: metricAccents.sleep,
                },
                {
                  href: "/food",
                  label: t("today_tile_food"),
                  color: metricAccents.food,
                },
                {
                  href: "/progress",
                  label: t("today_tile_progress"),
                  color: metricAccents.progress,
                },
                {
                  href: "/dashboard?tab=weight#dashboard-tabs",
                  label: t("stat_weight"),
                  color: "var(--pp-accent)",
                },
                {
                  href: "/dashboard?tab=symptoms#dashboard-tabs",
                  label: t("today_tile_symptoms"),
                  color: metricAccents.symptoms,
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="pp-rhythm-day"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.35rem 0.45rem",
                    borderRadius: "999px",
                    border: "0.5px solid transparent",
                    fontFamily: SANS,
                    fontSize: "10px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--pp-text-tertiary)",
                  }}
                >
                  <span
                    className="pp-rhythm-dot"
                    style={rhythmDotStyle(true, item.color)}
                  />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div
            className="grid gap-3 sm:grid-cols-4"
            style={{ marginTop: "1rem" }}
          >
            <Link href="/food" style={actionStyle} className="pp-action-card">
              {t("today_jump_food")}
            </Link>
            <Link href="/calendar" style={actionStyle} className="pp-action-card">
              {t("today_jump_calendar")}
            </Link>
            <Link
              href={calculatorHref}
              style={actionStyle}
              className="pp-action-card"
            >
              {t("today_jump_calculator")}
            </Link>
            <Link
              href={journalHref}
              style={actionStyle}
              className="pp-action-card"
            >
              {t("today_jump_journal")}
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4" style={{ marginTop: "2.5rem" }}>
          {metricTiles.map((tile) => (
            <MetricTile
              key={tile.metric}
              metric={tile.metric}
              icon={tile.icon}
              value={tile.value}
              label={tile.label}
              sublabel={tile.sublabel}
              badge={tile.badge}
              href={tile.href}
              comingSoon={"comingSoon" in tile ? tile.comingSoon : undefined}
            />
          ))}
        </div>

        <div
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
          style={{ marginTop: "1.5rem" }}
        >
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              style={a.href === "/coach" ? primaryActionStyle : actionStyle}
              className="pp-action-card"
            >
              {a.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <Link
            href="/reviews/submit"
            style={{
              fontFamily: SANS,
              fontSize: "12px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-accent)",
              textDecoration: "none",
            }}
            className="hover:underline"
          >
            {t("leave_review")}
          </Link>
        </div>

        <div style={{ ...cardStyle, marginTop: "2rem", padding: "1.5rem" }}>
          <DashboardTabs
            doses={dosePoints}
            weights={chartData}
            goalWeight={goalWeight}
            symptoms={symptomEntries}
            sleep={sleepEntries}
            threads={coachThreads}
            locale={locale as "es" | "en"}
            initialTab={initialTab}
          />
        </div>
        <MiMeta signal={signalState} />
      </main>

      <WelcomeOverlay
        hasDose={hasDose}
        hasWeight={hasWeight}
        hasCoach={hasCoach}
        journalHref={journalHref}
      />
    </div>
  );
}
