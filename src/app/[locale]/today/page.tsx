import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BukowskiObservation } from "@/components/BukowskiObservation";
import { DoseStrip, type DoseStripDose } from "@/components/DoseStrip";
import { MetricTile } from "@/components/MetricTile";
import { createClient } from "@/lib/supabase/server";
import { isTodayEnabled } from "@/lib/today/flag";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const todayEnabled = await isTodayEnabled(user!.id);
  if (!todayEnabled) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("dashboard");
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const cutoff7 = new Date(now.getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const [
    lastDoseRes,
    doses7Res,
    foodTodayRes,
    food7Res,
    sleep7Res,
    weights90Res,
  ] = await Promise.all([
    supabase
      .from("doses")
      .select("taken_at, injection_site, peptide_name")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("doses").select("taken_at").gte("taken_at", cutoff7),
    supabase
      .from("food_photos")
      .select("eaten_at, calories_estimate, protein_g, carbs_g, fat_g")
      .gte("eaten_at", todayKey),
    supabase.from("food_photos").select("eaten_at").gte("eaten_at", cutoff7),
    supabase
      .from("sleep_entries")
      .select("slept_at, hours")
      .gte("slept_at", cutoff7)
      .order("slept_at", { ascending: true }),
    supabase
      .from("weight_entries")
      .select("measured_at, weight_kg")
      .gte("measured_at", cutoff90)
      .order("measured_at", { ascending: true }),
  ]);
  const lastDose = lastDoseRes.data as DoseStripDose;

  type FoodRow = {
    eaten_at: string;
    calories_estimate: number | string | null;
    protein_g: number | string | null;
    carbs_g: number | string | null;
    fat_g: number | string | null;
  };
  const foodToday = ((foodTodayRes.data ?? []) as FoodRow[]).filter((food) =>
    food.eaten_at.startsWith(todayKey),
  );
  const foodTodayTotals = foodToday.reduce(
    (totals, food) => {
      const calories =
        food.calories_estimate === null ? 0 : Number(food.calories_estimate);
      const protein = food.protein_g === null ? 0 : Number(food.protein_g);
      totals.calories += Number.isFinite(calories) ? calories : 0;
      totals.protein += Number.isFinite(protein) ? protein : 0;
      return totals;
    },
    { calories: 0, protein: 0 },
  );
  const foodMetricSubLabel =
    foodToday.length === 0
      ? t("metric_food_empty")
      : t("metric_food_today", { count: foodToday.length });

  const sleepRows = (sleep7Res.data ?? []) as Array<{
    slept_at: string;
    hours: number | string;
  }>;
  const averageSleepHours =
    sleepRows.length > 0
      ? sleepRows.reduce((sum, sleep) => sum + Number(sleep.hours), 0) /
        sleepRows.length
      : null;

  const foodRows7 = (food7Res.data ?? []) as Array<{ eaten_at: string }>;
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
      dose: ((doses7Res.data ?? []) as { taken_at: string }[]).some((r) =>
        r.taken_at.startsWith(key),
      ),
      sleep: sleepRows.some((s) => s.slept_at.startsWith(key)),
      food: foodRows7.some((f) => f.eaten_at.startsWith(key)),
    };
  });
  const rhythmTotals = rhythmDays.reduce(
    (totals, day) => {
      totals.dose += day.dose ? 1 : 0;
      totals.sleep += day.sleep ? 1 : 0;
      totals.food += day.food ? 1 : 0;
      return totals;
    },
    { dose: 0, sleep: 0, food: 0 },
  );
  const bukowskiObservation = t("bukowski_observation_body", {
    dose: rhythmTotals.dose,
    sleep: rhythmTotals.sleep,
    food: rhythmTotals.food,
  });

  const weights90 = (
    (weights90Res.data ?? []) as Array<{
      measured_at: string;
      weight_kg: number | string;
    }>
  ).map((weight) => ({
    measured_at: weight.measured_at,
    weight_kg: Number(weight.weight_kg),
  }));
  let weightLatestStr = t("stat_empty");
  let weightDeltaStr: string | null = null;
  if (weights90.length > 0) {
    const latest = weights90[weights90.length - 1];
    weightLatestStr = `${latest.weight_kg.toFixed(1)} kg`;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const baseline = [...weights90]
      .reverse()
      .find((weight) => new Date(weight.measured_at).getTime() <= sevenDaysAgo);
    if (baseline) {
      const delta = latest.weight_kg - baseline.weight_kg;
      const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
      const abs = Math.abs(delta).toFixed(1);
      weightDeltaStr = `${sign}${abs} kg ${t("delta_label")}`;
    }
  }

  const loggableEmpty = (isEmpty: boolean) =>
    isEmpty
      ? {
          emptyState: "loggable" as const,
          emptySublabel: t("metric_tap_to_log"),
        }
      : {};

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
      ...loggableEmpty(foodTodayTotals.protein <= 0),
    },
    {
      metric: "water",
      icon: "droplet",
      value: t("metric_coming_soon"),
      label: t("metric_water"),
      sublabel: t("metric_iphone_app"),
      badge: undefined,
      href: undefined,
      comingSoon: true,
      emptyState: "source-gated",
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
      emptyState: "source-gated",
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
      ...loggableEmpty(foodTodayTotals.calories <= 0),
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
      ...loggableEmpty(averageSleepHours === null),
    },
    {
      metric: "weight",
      icon: "scale",
      value: weightLatestStr,
      label: t("metric_weight"),
      sublabel: weightDeltaStr ?? t("metric_latest_record"),
      badge: undefined,
      href: "/dashboard?tab=weight#dashboard-tabs",
      ...loggableEmpty(weights90.length === 0),
    },
  ] as const;

  return (
    <main
      style={{
        background: "var(--pp-bg)",
        color: "var(--pp-text)",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <section style={{ margin: "0 auto", maxWidth: "880px" }}>
        <h1
          style={{
            fontFamily: "var(--pp-font-serif)",
            fontSize: "clamp(42px, 12vw, 72px)",
            fontStyle: "italic",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
            margin: "0 0 2rem",
          }}
        >
          Today
        </h1>

        <div
          className="pp-today-glass-stack"
          style={{ marginBottom: "1.25rem" }}
        >
          <BukowskiObservation observation={bukowskiObservation} t={t} />
          <DoseStrip lastDose={lastDose} t={t} tDose={t} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
              emptyState={"emptyState" in tile ? tile.emptyState : undefined}
              emptySublabel={
                "emptySublabel" in tile ? tile.emptySublabel : undefined
              }
            />
          ))}
        </div>
      </section>
    </main>
  );
}
