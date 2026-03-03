"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts";
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
          <CartesianGrid strokeDasharray="3 3" stroke="#1A2A40" />
          <XAxis
            dataKey="month"
            stroke="#5C7495"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#5C7495"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#040C17",
              border: "1px solid #2B4362",
              borderRadius: "4px",
              fontSize: 12,
            }}
            labelStyle={{ color: "#B3C0D3" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#7B90AE" }} />
          <Bar dataKey="budgeted" name="Budget" fill="#66a3ff" radius={[2, 2, 0, 0]} />
          <Bar dataKey="committed" name="Committed" fill="#007acc" radius={[2, 2, 0, 0]} />
          <Bar dataKey="hedged" name="Hedged" fill="#00509e" radius={[2, 2, 0, 0]} />
          {hasForecast && (
            <Bar dataKey="forecast" name="Forecast" fill="#8b5cf6" radius={[2, 2, 0, 0]}>
              <LabelList
                dataKey="varianceLabel"
                position="top"
                style={{ fontSize: 9, fill: "#8b5cf6" }}
              />
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
