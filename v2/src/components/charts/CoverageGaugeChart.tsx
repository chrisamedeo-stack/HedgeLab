"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { chartColors } from "@/lib/chartTheme";

interface CoverageGaugeChartProps {
  coveragePct: number;
  height?: number;
}

function gaugeColor(pct: number): string {
  if (pct >= 80) return chartColors.profit;
  if (pct >= 40) return chartColors.warning;
  return chartColors.loss;
}

export function CoverageGaugeChart({ coveragePct, height = 220 }: CoverageGaugeChartProps) {
  const clamped = Math.min(Math.max(coveragePct, 0), 100);
  const color = gaugeColor(clamped);

  // Semi-circle gauge: filled portion + remaining + invisible bottom half
  const data = [
    { name: "covered", value: clamped },
    { name: "remaining", value: 100 - clamped },
  ];

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">Overall Coverage</h2>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="70%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill={chartColors.grid} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: height * 0.15 }}>
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>
            {clamped.toFixed(1)}%
          </span>
          <span className="text-xs text-faint mt-0.5">hedge coverage</span>
        </div>
      </div>
    </div>
  );
}
