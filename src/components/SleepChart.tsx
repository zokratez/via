"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SleepEntry = {
  slept_at: string;
  hours: number;
  quality: number;
  notes: string | null;
};

const QUALITY_COLORS: Record<number, string> = {
  1: "#c0735c",
  2: "#d4824f",
  3: "#d4a050",
  4: "#7c9968",
  5: "#c9966b",
};
const QUALITY_EMOJI: Record<number, string> = {
  1: "🌑",
  2: "🌒",
  3: "🌓",
  4: "🌔",
  5: "🌕",
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

type ChartPoint = {
  dayMs: number;
  date: string;
  hours: number;
  quality: number;
  notes: string | null;
};

export function SleepChart({
  entries,
  locale,
}: {
  entries: SleepEntry[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");

  const intl = locale === "es" ? "es-MX" : "en-US";
  const tickFmt = useMemo(
    () => new Intl.DateTimeFormat(intl, { month: "short", day: "numeric" }),
    [intl],
  );
  const tooltipFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(intl, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [intl],
  );

  const recent = useMemo(() => {
    const cutoffMs = Date.now() - 30 * 86_400_000;
    return entries.filter(
      (e) => new Date(`${e.slept_at}T00:00:00`).getTime() >= cutoffMs,
    );
  }, [entries]);

  const points: ChartPoint[] = useMemo(
    () =>
      recent.map((e) => {
        const dayMs = new Date(`${e.slept_at}T00:00:00`).getTime();
        return {
          dayMs,
          date: e.slept_at,
          hours: Number(e.hours),
          quality: e.quality,
          notes: e.notes,
        };
      }),
    [recent],
  );

  const avgHours =
    recent.length > 0
      ? recent.reduce((s, e) => s + Number(e.hours), 0) / recent.length
      : 0;
  const avgQuality =
    recent.length > 0
      ? recent.reduce((s, e) => s + e.quality, 0) / recent.length
      : 0;

  if (entries.length === 0) {
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
        {t("sleep_chart_empty")}
      </p>
    );
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
    const dateStr = tooltipFmt.format(new Date(p.dayMs));
    return (
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "4px",
          padding: "8px 12px",
          minWidth: "160px",
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
          {p.hours.toFixed(1)} h {QUALITY_EMOJI[p.quality]}
        </p>
        {p.notes && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "12px",
              color: "var(--pp-text-secondary)",
              margin: "4px 0 0",
              lineHeight: 1.4,
            }}
          >
            {p.notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "0.5px solid var(--pp-border)",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: "10px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-text-secondary)",
              fontWeight: 500,
              margin: "0 0 0.25rem",
            }}
          >
            {t("sleep_chart_avg_hours")}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "18px",
              color: "var(--pp-accent)",
              margin: 0,
            }}
          >
            {avgHours.toFixed(1)} h
          </p>
        </div>
        <div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: "10px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--pp-text-secondary)",
              fontWeight: 500,
              margin: "0 0 0.25rem",
            }}
          >
            {t("sleep_chart_avg_quality")}
          </p>
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "18px",
              color: "var(--pp-accent)",
              margin: 0,
            }}
          >
            {avgQuality.toFixed(1)} / 5
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={points}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="2 2"
            stroke="var(--pp-border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="dayMs"
            tickFormatter={(v) => tickFmt.format(new Date(Number(v)))}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
            width={28}
            tickFormatter={(v) => `${v}h`}
          />
          <Tooltip
            content={<TooltipContent />}
            cursor={{ fill: "var(--pp-text-tertiary)", opacity: 0.08 }}
          />
          <Bar dataKey="hours" isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={QUALITY_COLORS[p.quality] ?? "#a89788"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
