import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const WEEKLY_GENERICS = new Set([
  "semaglutide",
  "tirzepatide",
  "liraglutide",
  "retatrutide",
  "cagrilintide",
  "survodutide",
]);
const DAILY_GENERICS = new Set(["bpc-157", "tb-500", "bpc157", "tb500"]);

function scheduleDays(generic: string | null): number {
  if (!generic) return 7;
  const g = generic.toLowerCase().trim();
  if (DAILY_GENERICS.has(g)) return 1;
  if (WEEKLY_GENERICS.has(g)) return 7;
  return 7;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

function formatDate(d: Date, locale: "es" | "en"): string {
  return d.toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

type AlertLevel = "tomorrow" | "today" | "overdue";

type Alert = {
  medicationId: string;
  medicationName: string;
  lastDoseDate: Date;
  nextDoseDate: Date;
  level: AlertLevel;
  daysOverdue?: number;
};

export type MedicationWithLastDose = {
  id: string;
  name: string;
  generic_name: string | null;
  last_dose_at: string | null;
};

export async function AlertBanner({
  medications,
  locale,
}: {
  medications: MedicationWithLastDose[];
  locale: "es" | "en";
}) {
  const t = await getTranslations("alerts");
  const now = new Date();
  const alerts: Alert[] = [];

  for (const med of medications) {
    if (!med.last_dose_at) continue;
    const lastDose = new Date(med.last_dose_at);
    if (Number.isNaN(lastDose.getTime())) continue;
    const cycle = scheduleDays(med.generic_name);
    const nextDose = new Date(lastDose);
    nextDose.setDate(nextDose.getDate() + cycle);
    const delta = daysBetween(now, nextDose);

    if (delta === 1) {
      alerts.push({
        medicationId: med.id,
        medicationName: med.name,
        lastDoseDate: lastDose,
        nextDoseDate: nextDose,
        level: "tomorrow",
      });
    } else if (delta === 0) {
      alerts.push({
        medicationId: med.id,
        medicationName: med.name,
        lastDoseDate: lastDose,
        nextDoseDate: nextDose,
        level: "today",
      });
    } else if (delta < 0) {
      alerts.push({
        medicationId: med.id,
        medicationName: med.name,
        lastDoseDate: lastDose,
        nextDoseDate: nextDose,
        level: "overdue",
        daysOverdue: -delta,
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem" }}>
      {alerts.map((alert) => {
        const isOverdue = alert.level === "overdue";
        const accent = isOverdue ? "#c0735c" : "var(--pp-accent)";
        const headlineKey =
          alert.level === "tomorrow"
            ? "tomorrow"
            : alert.level === "today"
              ? "today"
              : "overdue";
        const headline =
          alert.level === "overdue"
            ? t("overdue", { count: alert.daysOverdue ?? 0 })
            : t(headlineKey);
        return (
          <div
            key={alert.medicationId}
            style={{
              background: "var(--pp-surface)",
              border: "0.5px solid var(--pp-border)",
              borderLeft: `3px solid ${accent}`,
              borderRadius: "6px",
              padding: "1rem 1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "200px" }}>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: accent,
                  fontWeight: alert.level === "today" ? 700 : 600,
                  margin: 0,
                }}
              >
                {headline}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  fontStyle: "italic",
                  fontSize: "18px",
                  color: "var(--pp-text)",
                  margin: "0.25rem 0 0",
                }}
              >
                {alert.medicationName}
              </p>
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: "13px",
                  color: "var(--pp-text-secondary)",
                  margin: "0.25rem 0 0",
                }}
              >
                {t("last_dose", { date: formatDate(alert.lastDoseDate, locale) })}{" "}
                ·{" "}
                {t("next_dose", { date: formatDate(alert.nextDoseDate, locale) })}
              </p>
            </div>
            <Link
              href="/log/dose"
              style={{
                fontFamily: SANS,
                fontSize: "11px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 600,
                background: accent,
                color: "var(--pp-bg)",
                padding: "10px 16px",
                borderRadius: "6px",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {t("log_dose_cta")}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
