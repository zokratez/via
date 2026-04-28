import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { WeightChart } from "@/components/WeightChart";

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
  searchParams: Promise<{ ok?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const showSavedToast =
    sp.ok === "dose" || sp.ok === "weight" || sp.ok === "symptom";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect({ href: "/auth/sign-in", locale });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user!.id)
    .maybeSingle();

  const name =
    profile?.display_name?.trim() ||
    (user!.email ? user!.email.split("@")[0] : "");

  const now = new Date();
  const cutoff14 = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const cutoff30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();

  const [
    lastDoseRes,
    weights30Res,
    doses14Res,
    weights14Res,
    symptoms14Res,
  ] = await Promise.all([
    supabase
      .from("doses")
      .select("taken_at, injection_site")
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weight_entries")
      .select("measured_at, weight_kg")
      .gte("measured_at", cutoff30)
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
  ]);

  const t = await getTranslations("dashboard");
  const tApp = await getTranslations("app");
  const tAuth = await getTranslations("auth");
  const tDose = await getTranslations("dose");

  const key = greetingKey(now);
  const greeting =
    key === "morning"
      ? t("greeting_morning", { name })
      : key === "afternoon"
        ? t("greeting_afternoon", { name })
        : t("greeting_evening", { name });

  const lastDose = lastDoseRes.data as
    | { taken_at: string; injection_site: string | null }
    | null;
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

  type WeightRow = { measured_at: string; weight_kg: number | string };
  const weights30 = ((weights30Res.data ?? []) as WeightRow[]).map((w) => ({
    measured_at: w.measured_at,
    weight_kg: Number(w.weight_kg),
  }));
  const chartData = weights30.map((w) => ({
    date: w.measured_at,
    weight: w.weight_kg,
  }));

  let weightLatestStr = t("stat_empty");
  let weightDeltaStr: string | null = null;
  if (weights30.length > 0) {
    const latest = weights30[weights30.length - 1];
    weightLatestStr = `${latest.weight_kg.toFixed(1)} kg`;
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const baseline = [...weights30]
      .reverse()
      .find((w) => new Date(w.measured_at).getTime() <= sevenDaysAgo);
    if (baseline) {
      const delta = latest.weight_kg - baseline.weight_kg;
      const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
      const abs = Math.abs(delta).toFixed(1);
      weightDeltaStr = `${sign}${abs} kg ${t("delta_label")}`;
    }
  }

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
  const streakCount = days.size;

  const actions = [
    { href: "/log/dose", label: t("log_dose") },
    { href: "/log/weight", label: t("log_weight") },
    { href: "/log/symptom", label: t("log_symptom") },
    { href: "/coach", label: t("action_coach") },
  ] as const;

  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          {tApp("name")}
        </Link>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <SignOutButton label={tAuth("sign_out")} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        {showSavedToast && (
          <div
            role="status"
            className="mb-6 rounded-lg border border-border/60 bg-accent/40 px-4 py-3 text-sm"
          >
            {t("toast_saved")}
          </div>
        )}

        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {greeting}
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stat_last_dose")}
              </p>
              <p className="mt-2 text-lg font-medium">{lastDoseStr}</p>
              {lastDoseSubStr && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {lastDoseSubStr}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stat_weight")}
              </p>
              <p className="mt-2 text-lg font-medium">{weightLatestStr}</p>
              {weightDeltaStr && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {weightDeltaStr}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stat_streak")}
              </p>
              <p className="mt-2 text-lg font-medium">
                {streakCount === 0
                  ? t("stat_empty")
                  : t("streak_days", { count: streakCount })}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="block">
              <Card className="border-border/60 transition-colors hover:bg-accent/40">
                <CardContent className="py-6">
                  <CardTitle className="text-center text-sm font-medium">
                    {a.label}
                  </CardTitle>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-8 border-border/60">
          <CardContent className="py-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("chart_weight_title")}
            </p>
            <div className="mt-4 text-foreground">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("chart_empty")}
                </p>
              ) : (
                <WeightChart data={chartData} locale={locale} />
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
