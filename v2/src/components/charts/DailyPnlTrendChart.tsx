"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import type { MtmSnapshot } from "@/types/risk";
import type { TimeRange } from "@/types/dashboard";

interface DailyPnlTrendChartProps {
  data: MtmSnapshot[];
  height?: number;
}

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: "7D", value: "3" },
  { label: "30D", value: "6" },
  { label: "90D", value: "12" },
  { label: "All", value: "all" },
];

const DAY_MAP: Record<string, number> = { "3": 7, "6": 30, "12": 90 };

export function DailyPnlTrendChart({ data, height = 320 }: DailyPnlTrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("6");

  const filtered = useMemo(() => {
    if (timeRange === "all") return data;
    const days = DAY_MAP[timeRange] ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter((d) => new Date(d.snapshot_date) >= cutoff);
  }, [data, timeRange]);

  const chartData = filtered.map((d) => ({
    date: d.snapshot_date,
    pnl: Number(d.total_pnl),
  }));

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Daily P&L Trend</h2>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg className="h-10 w-10 text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <span className="text-sm text-faint">Run MTM to generate P&L data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Daily P&L Trend</h2>
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
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartTheme.pnlPositive} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartTheme.pnlPositive} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartTheme.pnlNegative} stopOpacity={0} />
              <stop offset="100%" stopColor={chartTheme.pnlNegative} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="date"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
          />
          <YAxis
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#B3C0D3" }}
            formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, "P&L"]}
          />
          <ReferenceLine y={0} stroke={chartColors.muted} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={chartTheme.pnlPositive}
            fill="url(#pnlGradientPos)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
