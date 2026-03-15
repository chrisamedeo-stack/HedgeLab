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
import { chartColors, chartTheme, tooltipStyle, legendStyle, axisStyle, fmtK } from "@/lib/chartTheme";
import type { FctScenarioResult } from "@/types/forecast";

interface ScenarioComparisonChartProps {
  data: FctScenarioResult[];
  metric?: "coverage" | "pnl" | "price";
  height?: number;
}

export function ScenarioComparisonChart({
  data,
  metric = "pnl",
  height = 320,
}: ScenarioComparisonChartProps) {
  const chartData = data.map((r) => {
    const siteName = r.site_name ?? r.label ?? r.site_id?.slice(0, 8) ?? "Aggregate";
    if (metric === "coverage") {
      return {
        name: siteName,
        current: Number(r.current_coverage_pct ?? 0),
        projected: Number(r.projected_coverage_pct ?? 0),
      };
    }
    if (metric === "price") {
      return {
        name: siteName,
        current: Number(r.current_all_in_price ?? 0),
        projected: Number(r.projected_all_in_price ?? 0),
      };
    }
    return {
      name: siteName,
      current: Number(r.current_mtm_pnl ?? 0),
      projected: Number(r.projected_mtm_pnl ?? 0),
    };
  });

  const labels = {
    coverage: { unit: "%", current: "Current Coverage", projected: "Projected Coverage" },
    pnl: { unit: "$", current: "Current P&L", projected: "Projected P&L" },
    price: { unit: "$", current: "Current Price", projected: "Projected Price" },
  }[metric];

  if (chartData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Scenario Comparison</h2>
        <div className="flex items-center justify-center text-faint text-sm" style={{ height }}>
          No results to compare
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
        Current vs Projected &middot; {metric === "coverage" ? "Coverage %" : metric === "pnl" ? "Mark-to-Market P&L" : "All-In Price"}
      </h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="name"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
          />
          <YAxis
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={metric === "coverage" ? (v) => `${v}%` : fmtK}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: chartColors.muted }}
            formatter={(value) => {
              const v = Number(value ?? 0);
              return metric === "coverage"
                ? [`${v.toFixed(1)}%`, ""]
                : [`$${v.toLocaleString()}`, ""];
            }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="current" name={labels.current} fill={chartTheme.scenarioBase} radius={[3, 3, 0, 0]} />
          <Bar dataKey="projected" name={labels.projected} fill={chartTheme.scenarioProjected} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
