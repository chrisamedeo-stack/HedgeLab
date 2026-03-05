"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { chartTheme, chartColors, tooltipStyle, legendStyle, axisStyle } from "@/lib/chartTheme";
import type { CoverageDataPoint } from "@/types/budget";

interface CoverageChartProps {
  data: CoverageDataPoint[];
  height?: number;
}

export function CoverageChart({ data, height = 320 }: CoverageChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-b-default bg-surface" style={{ height }}>
        <span className="text-sm text-faint">No coverage data available</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="month"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
          />
          <YAxis
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#B3C0D3" }}
          />
          <Legend
            wrapperStyle={legendStyle}
          />
          <Bar dataKey="committed" name="Committed" stackId="coverage" fill={chartTheme.committed} radius={[0, 0, 0, 0]} />
          <Bar dataKey="hedged" name="Hedged" stackId="coverage" fill={chartTheme.hedged} radius={[0, 0, 0, 0]} />
          <Bar dataKey="open" name="Open" stackId="coverage" fill={chartTheme.open} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
