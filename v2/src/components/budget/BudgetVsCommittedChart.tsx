"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { chartTheme, chartColors, tooltipStyle, legendStyle, axisStyle } from "@/lib/chartTheme";
import type { CoverageDataPoint } from "@/types/budget";
import type { BudgetLineItem } from "@/types/budget";

interface BudgetVsCommittedChartProps {
  data: CoverageDataPoint[];
  lineItems?: BudgetLineItem[];
  height?: number;
}

export function BudgetVsCommittedChart({ data, lineItems, height = 320 }: BudgetVsCommittedChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-b-default bg-surface" style={{ height }}>
        <span className="text-sm text-faint">No data available</span>
      </div>
    );
  }

  // Merge forecast data from line items if available
  const chartData = data.map((d) => {
    const li = lineItems?.find((l) => l.budget_month === d.month);
    const forecast = li?.forecast_volume != null ? Number(li.forecast_volume) : null;
    const variance = forecast != null ? forecast - d.budgeted : null;
    return {
      ...d,
      forecast,
      varianceLabel: variance != null && variance !== 0
        ? `${variance > 0 ? "+" : ""}${variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : null,
    };
  });

  const hasForecast = chartData.some((d) => d.forecast != null);

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            labelStyle={{ color: "#8B95A5" }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="budgeted" name="Budget" fill={chartTheme.budgeted} radius={[2, 2, 0, 0]} />
          <Bar dataKey="committed" name="Committed" fill={chartTheme.committed} radius={[2, 2, 0, 0]} />
          <Bar dataKey="hedged" name="Hedged" fill={chartTheme.hedged} radius={[2, 2, 0, 0]} />
          {hasForecast && (
            <Bar dataKey="forecast" name="Forecast" fill={chartTheme.forecast} radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="varianceLabel"
                position="top"
                style={{ fontSize: 9, fill: chartTheme.forecast }}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
