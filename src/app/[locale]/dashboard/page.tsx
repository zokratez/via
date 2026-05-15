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
import { DashboardTabs, type TabKey } from "@/components/DashboardTabs";
import {
  AlertBanner,
  type MedicationWithLastDose,
} from "@/components/AlertBanner";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
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
    sp.ok === "dose" || sp.ok === "weight" || sp.ok === "symptom";
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
  ] = await Promise.all([
    supabase
      .from("doses")
      .select("taken_at, injection_site")
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
        "taken_at, dose_mg, injection_site, medications(name, generic_name)",
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
        medication_name: med?.name ?? null,
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
    { href: "/log/sleep", label: t("log_sleep") },
    { href: "/calendar", label: t("action_calendar") },
    { href: "/coach", label: t("action_coach") },
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

        <div
          className="grid gap-4 sm:grid-cols-3"
          style={{ marginTop: "2.5rem" }}
        >
          <Link
            href="/dashboard?tab=doses#dashboard-tabs"
            style={{ ...cardStyle, animationDelay: "0s" }}
            className="pp-stat-card pp-fade-up"
          >
            <p style={eyebrowStyle}>{t("stat_last_dose")}</p>
            <p style={statValueStyle}>{lastDoseStr}</p>
            {lastDoseSubStr && <p style={statSubStyle}>{lastDoseSubStr}</p>}
          </Link>

          <Link
            href="/dashboard?tab=weight#dashboard-tabs"
            style={{ ...cardStyle, animationDelay: "0.1s" }}
            className="pp-stat-card pp-fade-up"
          >
            <p style={eyebrowStyle}>{t("stat_weight")}</p>
            <p style={statValueStyle}>{weightLatestStr}</p>
            {weightDeltaStr && <p style={statSubStyle}>{weightDeltaStr}</p>}
          </Link>

          <Link
            href="/dashboard?tab=doses#dashboard-tabs"
            style={{ ...cardStyle, animationDelay: "0.2s" }}
            className="pp-stat-card pp-fade-up"
          >
            <p style={eyebrowStyle}>{t("stat_streak")}</p>
            <p style={statValueStyle}>
              {streakCount === 0
                ? t("stat_empty")
                : t("streak_days", { count: streakCount })}
            </p>
          </Link>
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
              className="hover:opacity-80 transition-opacity"
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
