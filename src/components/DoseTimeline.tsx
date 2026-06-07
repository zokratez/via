"use client";

import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
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
  taken_at: string;
  dose: number;
  peptide: string;
  unit: string;
};

type DoseSeries = {
  key: string;
  name: string;
  color: string;
  dash: string;
  points: ChartPoint[];
};

type TooltipDose = {
  name: string;
  dose: number;
  unit: string;
  color: string;
  dash: string;
};

type ChartRow = {
  x: number;
  dateKey: string;
  present: Record<string, TooltipDose>;
  [key: string]: number | string | Record<string, TooltipDose> | null;
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";
const DAY_MS = 24 * 60 * 60 * 1000;

// Documented exception: the global dose metric stays brass, but this chart
// needs per-peptide series colors so overlapping dose histories remain legible.
const DOSE_SERIES_COLORS = [
  "var(--pp-dose-series-1)",
  "var(--pp-dose-series-2)",
  "var(--pp-dose-series-3)",
  "var(--pp-dose-series-4)",
  "var(--pp-dose-series-5)",
  "var(--pp-dose-series-6)",
] as const;
const DASH_PATTERNS = ["", "7 4", "2 4", "9 3 2 3"] as const;

const hashPeptideName = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getSeriesStyle = (name: string) => {
  const hash = hashPeptideName(name.trim().toLowerCase());
  return {
    color: DOSE_SERIES_COLORS[hash % DOSE_SERIES_COLORS.length],
    dash: DASH_PATTERNS[hash % DASH_PATTERNS.length],
  };
};

const getPeptideName = (dose: DosePoint, fallback: string) =>
  (dose.medication_name?.trim() || dose.generic_name?.trim() || fallback).trim();

const getDateKey = (takenAt: string) => takenAt.slice(0, 10);

const formatDose = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 3,
  }).format(value);

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return "0%";
  const formatted = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0,
  }).format(Math.abs(value));
  if (value > 0) return `+${formatted}%`;
  if (value < 0) return `−${formatted}%`;
  return "0%";
};

function SeriesSwatch({
  color,
  dash,
  width = 28,
}: {
  color: string;
  dash: string;
  width?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={width}
      height="10"
      viewBox={`0 0 ${width} 10`}
      style={{ flex: "0 0 auto" }}
    >
      <line
        x1="0"
        y1="5"
        x2={width}
        y2="5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={dash || undefined}
      />
    </svg>
  );
}

export function DoseTimeline({
  doses,
  locale,
}: {
  doses: DosePoint[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");

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
  });
  const unknownPeptide = t("dose_strip_unknown");

  const peptideNames = Array.from(
    new Set(doses.map((dose) => getPeptideName(dose, unknownPeptide))),
  ).sort((a, b) => a.localeCompare(b, intl));

  const series = peptideNames.map<DoseSeries>((name) => {
    const { color, dash } = getSeriesStyle(name);
    return {
      key: `dose_${hashPeptideName(name.toLowerCase()).toString(36)}`,
      name,
      color,
      dash,
      points: doses
        .filter((dose) => getPeptideName(dose, unknownPeptide) === name)
        .map((dose) => ({
          taken_at: dose.taken_at,
          dose: Number(dose.dose_mg),
          peptide: name,
          unit: "mg",
        }))
        .sort(
          (a, b) =>
            new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
        ),
    };
  });

  const seriesByName = new Map(series.map((item) => [item.name, item]));
  const rowsByDate = new Map<string, ChartRow>();
  const chronologicalDoses = [...doses].sort(
    (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
  );

  for (const dose of chronologicalDoses) {
    const peptide = getPeptideName(dose, unknownPeptide);
    const currentSeries = seriesByName.get(peptide);
    if (!currentSeries) continue;

    const dateKey = getDateKey(dose.taken_at);
    const row =
      rowsByDate.get(dateKey) ??
      ({
        x: new Date(`${dateKey}T12:00:00`).getTime(),
        dateKey,
        present: {},
      } as ChartRow);
    const doseValue = Number(dose.dose_mg);
    row[currentSeries.key] = doseValue;
    row.present[currentSeries.key] = {
      name: peptide,
      dose: doseValue,
      unit: "mg",
      color: currentSeries.color,
      dash: currentSeries.dash,
    };
    rowsByDate.set(dateKey, row);
  }

  const chartRows = Array.from(rowsByDate.values()).sort(
    (a, b) => Number(a.x) - Number(b.x),
  );
  const firstX = Number(chartRows[0]?.x ?? Date.now());
  const xDomain =
    chartRows.length === 1
      ? ([firstX - DAY_MS, firstX + DAY_MS] as [number, number])
      : (["dataMin", "dataMax"] as ["dataMin", "dataMax"]);

  function TooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: ChartRow }>;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0].payload;
    const entries = Object.values(row.present).sort((a, b) =>
      a.name.localeCompare(b.name, intl),
    );
    if (entries.length === 0) return null;

    return (
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "4px",
          padding: "8px 12px",
          boxShadow: "none",
          minWidth: "180px",
        }}
      >
        <p
          style={{
            fontFamily: SANS,
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--pp-text-secondary)",
            margin: "0 0 6px",
          }}
        >
          {tooltipFmt.format(new Date(Number(row.x)))}
        </p>
        <div style={{ display: "grid", gap: "6px" }}>
          {entries.map((entry) => (
            <div
              key={entry.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: SERIF,
                fontSize: "14px",
                color: "var(--pp-text-primary)",
              }}
            >
              <SeriesSwatch color={entry.color} dash={entry.dash} width={22} />
              <span>
                {entry.name}: {formatDose(entry.dose)} {entry.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        aria-label="Peptide dose series legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 14px",
          marginBottom: 12,
        }}
      >
        {series.map((item) => (
          <div
            key={item.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              color: "var(--pp-text-secondary)",
              fontFamily: SANS,
              fontSize: 12,
            }}
          >
            <SeriesSwatch color={item.color} dash={item.dash} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>

      <div data-swipe-nav-ignore="true">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chartRows}
            margin={{ top: 14, right: 20, bottom: 8, left: 0 }}
          >
          <CartesianGrid
            strokeDasharray="2 2"
            stroke="var(--pp-border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="x"
            type="number"
            domain={xDomain}
            tickFormatter={(value) => tickFmt.format(new Date(Number(value)))}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            domain={[0, (dataMax: number) => Math.max(dataMax * 1.18, 1)]}
            tickFormatter={(value) => `${formatDose(Number(value))}mg`}
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
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.name}
              stroke={item.color}
              strokeWidth={2.4}
              strokeDasharray={item.dash || undefined}
              connectNulls
              dot={{ r: 3, strokeWidth: 1.5 }}
              activeDot={{ r: 5, strokeWidth: 1.5 }}
              isAnimationActive={false}
            />
          ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {series.map((item) => {
          const first = item.points[0];
          const latest = item.points[item.points.length - 1];
          const previous = item.points[item.points.length - 2];
          const previousChange =
            previous && previous.dose !== 0
              ? ((latest.dose - previous.dose) / previous.dose) * 100
              : null;
          const totalChange =
            first && first.dose !== 0
              ? ((latest.dose - first.dose) / first.dose) * 100
              : 0;
          const totalChangeLabel =
            item.points.length === 1 ? "—" : formatPercent(totalChange);

          return (
            <div
              key={`${item.key}-summary`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                borderTop: "1px solid rgba(245, 239, 231, 0.06)",
                paddingTop: 8,
                color: "var(--pp-text-secondary)",
                fontFamily: SANS,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              <SeriesSwatch color={item.color} dash={item.dash} />
              <strong
                style={{
                  color: "var(--pp-text-primary)",
                  fontWeight: 600,
                }}
              >
                {item.name}
              </strong>
              <span>
                dosis actual{" "}
                <strong style={{ color: item.color, fontWeight: 600 }}>
                  {formatDose(latest.dose)} {latest.unit}
                </strong>
              </span>
              <span>
                {previousChange === null
                  ? "primera dosis"
                  : `${formatPercent(previousChange)} vs anterior`}
              </span>
              <span>
                cambio total{" "}
                <strong
                  style={{
                    color: "var(--pp-text-primary)",
                    fontWeight: 600,
                  }}
                >
                  {totalChangeLabel}
                </strong>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
