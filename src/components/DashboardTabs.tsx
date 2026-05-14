"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DoseTimeline, type DosePoint } from "@/components/DoseTimeline";
import { WeightChart, type WeightPoint } from "@/components/WeightChart";
import {
  SymptomChart,
  type SymptomEntry,
} from "@/components/SymptomChart";
import { SleepChart, type SleepEntry } from "@/components/SleepChart";
import {
  CoachHistory,
  type CoachThread,
} from "@/components/CoachHistory";

type TabKey = "doses" | "weight" | "symptoms" | "sleep" | "coach";
const TABS: readonly TabKey[] = [
  "doses",
  "weight",
  "symptoms",
  "sleep",
  "coach",
] as const;

const SANS = "var(--pp-font-sans)";

export function DashboardTabs({
  doses,
  weights,
  goalWeight,
  symptoms,
  sleep,
  threads,
  locale,
}: {
  doses: DosePoint[];
  weights: WeightPoint[];
  goalWeight: number | null;
  symptoms: SymptomEntry[];
  sleep: SleepEntry[];
  threads: CoachThread[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");
  const [active, setActive] = useState<TabKey>("doses");

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: "1.5rem",
          overflowX: "auto",
          marginBottom: "1.5rem",
          borderBottom: "0.5px solid var(--pp-border)",
          paddingBottom: 0,
        }}
        className="pp-scroll"
      >
        {TABS.map((key) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(key)}
              style={{
                background: "transparent",
                border: "none",
                padding: "0.5rem 0",
                marginBottom: "-1px",
                fontFamily: SANS,
                fontSize: "12px",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: isActive ? 600 : 500,
                color: isActive
                  ? "var(--pp-accent)"
                  : "var(--pp-text-secondary)",
                borderBottom: isActive
                  ? "2px solid var(--pp-accent)"
                  : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t(`tab_${key}`)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "doses" && (
          <DoseTimeline doses={doses} locale={locale} />
        )}
        {active === "weight" && (
          <WeightChart
            data={weights}
            locale={locale}
            goalWeight={goalWeight}
          />
        )}
        {active === "symptoms" && (
          <SymptomChart entries={symptoms} locale={locale} />
        )}
        {active === "sleep" && (
          <SleepChart entries={sleep} locale={locale} />
        )}
        {active === "coach" && (
          <CoachHistory threads={threads} locale={locale} />
        )}
      </div>
    </div>
  );
}
