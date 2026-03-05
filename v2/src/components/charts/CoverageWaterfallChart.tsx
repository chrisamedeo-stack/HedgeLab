"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, legendStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import type { CoverageDataPoint } from "@/types/budget";
import type { TimeRange } from "@/types/dashboard";

interface CoverageWaterfallChartProps {
  data: CoverageDataPoint[];
  height?: number;
}

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: "3Mo", value: "3" },
  { label: "6Mo", value: "6" },
  { label: "12Mo", value: "12" },
  { label: "All", value: "all" },
];

export function CoverageWaterfallChart({ data, height = 360 }: CoverageWaterfallChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("12");

  const filtered = useMemo(() => {
    if (timeRange === "all") return data;
    const now = new Date();
    const months = Number(timeRange);
    const cutoff = new Date(now.getFullYear(), now.getMonth() + months, 1);
    return data.filter((d) => {
      const date = new Date(d.month + "-01");
      return date >= now && date < cutoff;
    });
  }, [data, timeRange]);

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Coverage Waterfall</h2>
        </div>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg className="h-10 w-10 text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm text-faint">No coverage data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Coverage Waterfall</h2>
        <div className="flex gap-1">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                timeRange === opt.value
                  ? "bg-action text-primary"
                  : "bg-input-bg text-muted hover:bg-hover hover:text-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={filtered} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="month"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
          />
          <YAxis
            yAxisId="volume"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#B3C0D3" }}
            formatter={(value, name) => {
              const v = Number(value ?? 0);
              if (name === "Coverage %") return [`${v}%`, name];
              return [v.toLocaleString(), name];
            }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar yAxisId="volume" dataKey="committed" name="Committed" stackId="coverage" fill={chartTheme.committed} />
          <Bar yAxisId="volume" dataKey="hedged" name="Hedged" stackId="coverage" fill={chartTheme.hedged} />
          <Bar yAxisId="volume" dataKey="open" name="Open" stackId="coverage" fill={chartTheme.open} radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="pct"
            dataKey="coveragePct"
            name="Coverage %"
            stroke={chartColors.profit}
            strokeWidth={2}
            dot={{ r: 3, fill: chartColors.profit }}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
