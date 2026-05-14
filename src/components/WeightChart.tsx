"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; weight: number };

export function WeightChart({
  data,
  locale,
}: {
  data: Point[];
  locale: string;
}) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(d);
  };
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <XAxis
          dataKey="date"
          tickFormatter={fmt}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
        />
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        <Tooltip
          formatter={(v: unknown) => [`${v} kg`, ""]}
          labelFormatter={(label: unknown) => fmt(String(label))}
          contentStyle={{
            background: "var(--pp-surface)",
            border: "0.5px solid var(--pp-border)",
            borderRadius: "4px",
            padding: "8px 12px",
            boxShadow: "none",
          }}
          labelStyle={{
            fontFamily: "var(--pp-font-sans)",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--pp-text-secondary)",
            marginBottom: "4px",
          }}
          itemStyle={{
            fontFamily: "var(--pp-font-serif)",
            fontSize: "14px",
            color: "var(--pp-accent)",
            padding: 0,
          }}
          cursor={{ stroke: "var(--pp-text-tertiary)", strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="currentColor"
          strokeWidth={2}
          dot={{ r: 3, fill: "currentColor" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
