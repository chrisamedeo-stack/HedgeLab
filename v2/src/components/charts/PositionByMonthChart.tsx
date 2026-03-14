"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, legendStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { PositionByMonthDataPoint } from "@/types/dashboard";

interface PositionByMonthChartProps {
  data: PositionByMonthDataPoint[];
  height?: number;
}

export function PositionByMonthChart({ data, height = 280 }: PositionByMonthChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Positions by Month</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <svg className="h-5 w-5 text-faint mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs text-faint">No position data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Positions by Month</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="month"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={formatContractMonth}
          />
          <YAxis
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#8B95A5" }}
            formatter={(value, name) => [Number(value ?? 0).toLocaleString(), name]}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="open" name="Open" stackId="positions" fill={chartTheme.statusOpen} />
          <Bar dataKey="locked" name="Locked" stackId="positions" fill={chartTheme.statusLocked} />
          <Bar dataKey="offset" name="Offset" stackId="positions" fill={chartTheme.statusOffset} />
          <Bar dataKey="rolled" name="Rolled" stackId="positions" fill={chartTheme.statusRolled} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
