"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SymptomEntry = {
  occurred_at: string;
  category: string;
  severity: number;
  notes: string | null;
};

const CATEGORIES = [
  "nausea",
  "fatigue",
  "constipation",
  "headache",
  "injection_site",
  "other",
] as const;

const COLORS: Record<string, string> = {
  nausea: "#c0735c",
  fatigue: "#d4a050",
  constipation: "#c9966b",
  headache: "#a87c5c",
  injection_site: "#7c9968",
  other: "#a89788",
};

const SERIF = "var(--pp-font-serif)";
const SANS = "var(--pp-font-sans)";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  const offset = (day + 6) % 7; // Monday-start
  out.setDate(out.getDate() - offset);
  out.setHours(0, 0, 0, 0);
  return out;
}

type WeekBucket = {
  weekMs: number;
  weekStart: string;
} & { [cat: string]: number | string };

export function SymptomChart({
  entries,
  locale,
}: {
  entries: SymptomEntry[];
  locale: "es" | "en";
}) {
  const t = useTranslations("dashboard");
  const tSymptom = useTranslations("symptom");

  const intl = locale === "es" ? "es-MX" : "en-US";
  const weekFmt = useMemo(
    () => new Intl.DateTimeFormat(intl, { month: "short", day: "numeric" }),
    [intl],
  );

  const { buckets, severityByWeekCat, categoryTotals, avgSeverity } =
    useMemo(() => {
      const bucketMap = new Map<number, WeekBucket>();
      const sevMap = new Map<string, { sum: number; n: number }>();
      const totals = new Map<string, number>();

      for (const e of entries) {
        const dt = new Date(e.occurred_at);
        const ws = startOfWeek(dt).getTime();
        let bucket = bucketMap.get(ws);
        if (!bucket) {
          bucket = {
            weekMs: ws,
            weekStart: new Date(ws).toISOString(),
          } as WeekBucket;
          for (const cat of CATEGORIES) bucket[cat] = 0;
          bucketMap.set(ws, bucket);
        }
        const cat = CATEGORIES.includes(
          e.category as (typeof CATEGORIES)[number],
        )
          ? e.category
          : "other";
        bucket[cat] = (Number(bucket[cat]) || 0) + 1;
        totals.set(cat, (totals.get(cat) ?? 0) + 1);
        const k = `${ws}|${cat}`;
        const acc = sevMap.get(k) ?? { sum: 0, n: 0 };
        acc.sum += e.severity;
        acc.n += 1;
        sevMap.set(k, acc);
      }

      const sortedBuckets = Array.from(bucketMap.values()).sort(
        (a, b) => a.weekMs - b.weekMs,
      );

      const totalSeverity = entries.reduce((s, e) => s + e.severity, 0);
      const avg = entries.length > 0 ? totalSeverity / entries.length : 0;

      return {
        buckets: sortedBuckets,
        severityByWeekCat: sevMap,
        categoryTotals: totals,
        avgSeverity: avg,
      };
    }, [entries]);

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
        {t("symptom_chart_empty")}
      </p>
    );
  }

  const mostFrequentEntry = Array.from(categoryTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const mostFrequentLabel = mostFrequentEntry
    ? `${tSymptom(`category_${mostFrequentEntry[0]}`)} (${mostFrequentEntry[1]})`
    : "—";

  function TooltipContent({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: WeekBucket }>;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    const bucket = payload[0].payload;
    const weekStartDate = new Date(bucket.weekMs);
    const weekEndDate = new Date(bucket.weekMs + 6 * 86_400_000);
    const dateStr = `${weekFmt.format(weekStartDate)} – ${weekFmt.format(weekEndDate)}`;

    const presentCategories = CATEGORIES.filter(
      (cat) => Number(bucket[cat]) > 0,
    );

    return (
      <div
        style={{
          background: "var(--pp-surface)",
          border: "0.5px solid var(--pp-border)",
          borderRadius: "4px",
          padding: "8px 12px",
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
          {dateStr}
        </p>
        {presentCategories.map((cat) => {
          const count = Number(bucket[cat]);
          const sev = severityByWeekCat.get(`${bucket.weekMs}|${cat}`);
          const avg = sev ? (sev.sum / sev.n).toFixed(1) : null;
          return (
            <p
              key={cat}
              style={{
                fontFamily: SERIF,
                fontSize: "13px",
                color: COLORS[cat],
                margin: "0 0 2px",
                lineHeight: 1.4,
              }}
            >
              {tSymptom(`category_${cat}`)}: {count}
              {avg && (
                <span
                  style={{
                    color: "var(--pp-text-secondary)",
                    fontSize: "11px",
                    marginLeft: "0.5rem",
                  }}
                >
                  · {t("symptom_chart_severity_short")} {avg}
                </span>
              )}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={buckets}
          margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="2 2"
            stroke="var(--pp-border)"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="weekMs"
            tickFormatter={(v) => weekFmt.format(new Date(Number(v)))}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--pp-text-tertiary)" }}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            content={<TooltipContent />}
            cursor={{ fill: "var(--pp-text-tertiary)", opacity: 0.08 }}
          />
          {CATEGORIES.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="symptoms"
              fill={COLORS[cat]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "0.5px solid var(--pp-border)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem",
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
            {t("symptom_chart_most_frequent")}
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
            {mostFrequentLabel}
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
            {t("symptom_chart_avg_severity")}
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
            {avgSeverity.toFixed(1)} / 5
          </p>
        </div>
      </div>
    </div>
  );
}
