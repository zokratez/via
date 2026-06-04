import { Link } from "@/i18n/navigation";

const SITE_KEYS = {
  abdomen_left: "site_abdomen_left",
  abdomen_right: "site_abdomen_right",
  thigh_left: "site_thigh_left",
  thigh_right: "site_thigh_right",
  arm_left: "site_arm_left",
  arm_right: "site_arm_right",
} as const;

type SiteKey = keyof typeof SITE_KEYS;
type SiteTranslationKey = (typeof SITE_KEYS)[SiteKey];

type DoseStripTranslationKey =
  | "dose_strip_title"
  | "dose_strip_eyebrow"
  | "dose_strip_unknown"
  | "dose_strip_empty_detail"
  | "dose_strip_action"
  | "stat_empty"
  | "time_just_now"
  | "time_minutes_short"
  | "time_hours_short"
  | "time_days_short";

type DoseStripT = (
  key: DoseStripTranslationKey,
  values?: { count: number },
) => string;

type DoseStripTDose = (key: SiteTranslationKey) => string;

export type DoseStripDose = {
  taken_at: string;
  injection_site: string | null;
  peptide_name: string | null;
} | null;

function isKnownSite(s: string | null | undefined): s is SiteKey {
  return !!s && s in SITE_KEYS;
}

export function DoseStrip({
  lastDose,
  t,
  tDose,
}: {
  lastDose: DoseStripDose;
  t: DoseStripT;
  tDose: DoseStripTDose;
}) {
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
  const lastDoseName = lastDose?.peptide_name ?? t("dose_strip_unknown");
  const doseStripDetail = lastDose
    ? lastDoseSubStr
      ? `${lastDoseName} · ${lastDoseSubStr}`
      : lastDoseName
    : t("dose_strip_empty_detail");

  return (
    <Link
      href="/dashboard?tab=doses#dashboard-tabs"
      className="pp-dose-strip pp-glass-edge-content"
      aria-label={t("dose_strip_title")}
    >
      <span className="pp-dose-strip-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 8h7a4 4 0 1 1 0 8H8a5 5 0 0 1-1-8ZM15 8l3-3M18 5l1 3" />
        </svg>
      </span>
      <span className="pp-dose-strip-copy">
        <span className="pp-dose-strip-eyebrow">
          {t("dose_strip_eyebrow")}
        </span>
        <span className="pp-dose-strip-value">{lastDoseStr}</span>
        <span className="pp-dose-strip-detail">{doseStripDetail}</span>
      </span>
      <span className="pp-dose-strip-action">{t("dose_strip_action")}</span>
    </Link>
  );
}
