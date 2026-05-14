"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeightPoint = {
  date: string;
  weight: number;
  waist: number | null;
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

const RANGES = [30, 60, 90] as const;
type Range = (typeof RANGES)[number];

const DELTA_LOSS_COLOR = "#7c9968";
const DELTA_GAIN_COLOR = "#c0735c";
const WAIST_COLOR = "#a89788";

function deltaSign(n: number): string {
  if (n > 0) return "+";
  if (n < 0) return "−";
  return "±";
}

function deltaColor(n: number): string {
  if (n > 0) return DELTA_GAIN_COLOR;
  if (n < 0) return DELTA_LOSS_COLOR;
  return "var(--pp-text-secondary)";
}

export function WeightChart({
  data,
  locale,
  goalWeight,
}: {
  data: WeightPoint[];
  locale: string;
  goalWeight?: number | null;
}) {
  const t = useTranslations("dashboard");
  const [range, setRange] = useState<Range>(30);

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

  const filtered = useMemo(() => {
    if (data.length === 0) return [] as WeightPoint[];
    const cutoffMs = Date.now() - range * 86_400_000;
    return data.filter((p) => new Date(p.date).getTime() >= cutoffMs);
  }, [data, range]);

  const hasWaist = filtered.some((p) => p.waist !== null);

  const delta =
    filtered.length >= 2
      ? filtered[filtered.length - 1].weight - filtered[0].weight
      : null;

  function TooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: WeightPoint }>;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0].payload;
    const idx = filtered.findIndex((x) => x.date === p.date);
    const prev = idx > 0 ? filtered[idx - 1] : null;
    const stepDelta = prev ? p.weight - prev.weight : null;
    const dateStr = tooltipFmt.format(new Date(p.date));
    return (
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "4px",
          padding: "8px 12px",
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
          {p.weight.toFixed(1)} kg
        </p>
        {stepDelta !== null && (
          <p
            style={{
              fontFamily: SANS,
              fontSize: "11px",
              color: deltaColor(stepDelta),
              margin: 0,
            }}
          >
            {deltaSign(stepDelta)}
            {Math.abs(stepDelta).toFixed(1)} kg
          </p>
        )}
        {p.waist !== null && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "12px",
              color: "var(--pp-text-secondary)",
              margin: "2px 0 0",
            }}
          >
            {t("weight_chart_waist")}: {p.waist.toFixed(1)} cm
          </p>
        )}
      </div>
    );
  }

  if (data.length === 0) {
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
        {t("chart_empty")}
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                fontFamily: SANS,
                fontSize: "11px",
                letterSpacing: "0.16em",
                padding: "6px 10px",
                borderRadius: "4px",
                border: `0.5px solid ${
                  range === r ? "var(--pp-accent)" : "var(--pp-border)"
                }`,
                background: range === r ? "var(--pp-accent)" : "transparent",
                color: range === r ? "var(--pp-bg)" : "var(--pp-text-secondary)",
                cursor: "pointer",
                fontWeight: range === r ? 600 : 500,
              }}
            >
              {r}D
            </button>
          ))}
        </div>
        {delta !== null && (
          <span
            style={{
              fontFamily: SANS,
              fontSize: "11px",
              letterSpacing: "0.16em",
              fontWeight: 600,
              color: deltaColor(delta),
            }}
          >
            {deltaSign(delta)}
            {Math.abs(delta).toFixed(1)} kg
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          data={filtered}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--pp-accent)"
                stopOpacity={0.2}
              />
              <stop
                offset="100%"
                stopColor="var(--pp-accent)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="2 2"
            stroke="var(--pp-border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => tickFmt.format(new Date(v))}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
          />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            content={<TooltipContent />}
            cursor={{
              stroke: "var(--pp-text-tertiary)",
              strokeWidth: 1,
              strokeDasharray: "2 2",
            }}
          />
          {goalWeight !== null && goalWeight !== undefined && (
            <ReferenceLine
              y={goalWeight}
              stroke="var(--pp-accent)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{
                value: `${t("weight_chart_goal")}: ${goalWeight} kg`,
                fontSize: 10,
                fill: "var(--pp-text-secondary)",
                fontFamily: "var(--pp-font-sans)",
                position: "insideTopRight",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--pp-accent)"
            strokeWidth={2}
            fill="url(#weightGrad)"
            dot={{ r: 3, fill: "var(--pp-accent)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {hasWaist && (
            <Line
              type="monotone"
              dataKey="waist"
              stroke={WAIST_COLOR}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
