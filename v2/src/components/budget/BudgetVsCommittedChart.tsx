"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CoverageDataPoint } from "@/types/budget";

interface BudgetVsCommittedChartProps {
  data: CoverageDataPoint[];
  height?: number;
}

export function BudgetVsCommittedChart({ data, height = 320 }: BudgetVsCommittedChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-b-default bg-surface" style={{ height }}>
        <span className="text-sm text-faint">No data available</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-b-default bg-surface p-4">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
