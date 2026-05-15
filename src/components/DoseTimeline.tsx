"use client";

import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DosePoint = {
  taken_at: string;
  dose_mg: number;
  injection_site: string | null;
  medication_name: string | null;
  generic_name: string | null;
};

type ChartPoint = {
  x: number;
  y: number;
  taken_at: string;
  site: string | null;
  medication: string | null;
  generic: string | null;
};

const COLORS_BY_GENERIC: Record<string, string> = {
  semaglutide: "#c9966b",
  tirzepatide: "#7c9968",
  liraglutide: "#d4a050",
};
const FALLBACK_COLOR = "#a89788";

const SITE_KEY_MAP: Record<string, string> = {
  abdomen_left: "site_abdomen_left",
  abdomen_right: "site_abdomen_right",
  thigh_left: "site_thigh_left",
  thigh_right: "site_thigh_right",
  arm_left: "site_arm_left",
  arm_right: "site_arm_right",
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

export function DoseTimeline({
  doses,
  locale,
}: {
  doses: DosePoint[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");
  const tDose = useTranslations("dose");

  if (doses.length === 0) {
    return (
      <p
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: "15px",
          color: "var(--pp-text-secondary)",
          margin: 0,
        }}
      >
        {t("dose_timeline_empty")}
      </p>
    );
  }

  const intl = locale === "es" ? "es-MX" : "en-US";
  const tickFmt = new Intl.DateTimeFormat(intl, {
    month: "short",
    day: "numeric",
  });
  const tooltipFmt = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const byGeneric = new Map<string, ChartPoint[]>();
  for (const d of doses) {
    const generic = d.generic_name ?? "_unknown";
    const list = byGeneric.get(generic) ?? [];
    list.push({
      x: new Date(d.taken_at).getTime(),
      y: Number(d.dose_mg),
      taken_at: d.taken_at,
      site: d.injection_site,
      medication: d.medication_name,
      generic: d.generic_name,
    });
    byGeneric.set(generic, list);
  }

  function TooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartPoint }>;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0].payload;
    const dateStr = tooltipFmt.format(new Date(p.taken_at));
    const siteLabel =
      p.site && SITE_KEY_MAP[p.site] ? tDose(SITE_KEY_MAP[p.site]) : null;
    return (
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "4px",
          padding: "8px 12px",
          boxShadow: "none",
        }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--pp-text-secondary)",
            margin: "0 0 4px",
          }}
        >
          {dateStr}
        </p>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "14px",
            color: "var(--pp-accent)",
            margin: "0 0 2px",
          }}
        >
          {p.y} mg{p.medication ? ` — ${p.medication}` : ""}
        </p>
        {siteLabel && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "12px",
              color: "var(--pp-text-secondary)",
              margin: 0,
            }}
          >
            {siteLabel}
          </p>
        )}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid
          strokeDasharray="2 2"
          stroke="var(--pp-border)"
          opacity={0.4}
          vertical={false}
        />
        <XAxis
          dataKey="x"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => tickFmt.format(new Date(v))}
          tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          dataKey="y"
          type="number"
          tickFormatter={(v) => `${v}mg`}
          tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          content={<TooltipContent />}
          cursor={{
            stroke: "var(--pp-text-tertiary)",
            strokeWidth: 1,
            strokeDasharray: "2 2",
          }}
        />
        {Array.from(byGeneric.entries()).map(([generic, points]) => (
          <Scatter
            key={generic}
            name={generic}
            data={points}
            fill={COLORS_BY_GENERIC[generic] ?? FALLBACK_COLOR}
            isAnimationActive
            animationDuration={600}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
