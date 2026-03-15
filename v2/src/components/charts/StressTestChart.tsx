"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { chartColors, chartTheme, tooltipStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import type { FctScenarioResult } from "@/types/forecast";

interface StressTestChartProps {
  data: FctScenarioResult[];
  height?: number;
}

export function StressTestChart({ data, height = 360 }: StressTestChartProps) {
  const chartData = data.map((r) => ({
    label: r.label ?? `${Number(r.price_change) >= 0 ? "+" : ""}${Number(r.price_change).toFixed(2)}`,
    pnlChange: Number(r.pnl_change ?? 0),
    projectedPnl: Number(r.projected_mtm_pnl ?? 0),
    priceChange: Number(r.price_change ?? 0),
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Stress Test Results</h2>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg className="h-10 w-10 text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm text-faint">Run a stress test to see results</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Stress Test — P&L Impact by Price Delta</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="label"
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
            labelStyle={{ color: chartColors.muted }}
            formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, "P&L Change"]}
            labelFormatter={(label) => `Price Δ: ${label}`}
          />
          <ReferenceLine y={0} stroke={chartColors.faint} strokeDasharray="3 3" />
          <Bar dataKey="pnlChange" name="P&L Change" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.pnlChange >= 0 ? chartTheme.pnlPositive : chartTheme.pnlNegative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
