"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, legendStyle, axisStyle } from "@/lib/chartTheme";
import { formatContractMonth } from "@/lib/commodity-utils";

interface ForwardCurveChartProps {
  current: { contract_month: string; price: number }[];
  comparison: { contract_month: string; price: number }[] | null;
  compareDate: string | null;
  onCompareChange: (date: string | undefined) => void;
  height?: number;
  presets?: { label: string; days: number }[];
}

const DEFAULT_PRESETS = [
  { label: "vs 30d Ago", days: 30 },
  { label: "vs 90d Ago", days: 90 },
];

function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().split("T")[0];
}

export function ForwardCurveChart({
  current,
  comparison,
  compareDate,
  onCompareChange,
  height = 300,
  presets,
}: ForwardCurveChartProps) {
  const PRESETS = presets ?? DEFAULT_PRESETS;
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const chartData = useMemo(() => {
    const months = new Set<string>();
    current.forEach((p) => months.add(p.contract_month));
    comparison?.forEach((p) => months.add(p.contract_month));

    const currentMap = new Map(current.map((p) => [p.contract_month, p.price]));
    const compareMap = comparison ? new Map(comparison.map((p) => [p.contract_month, p.price])) : null;

    return Array.from(months)
      .sort()
      .map((month) => ({
        month,
        current: currentMap.get(month) ?? null,
        comparison: compareMap?.get(month) ?? null,
      }));
  }, [current, comparison]);

  if (current.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Forward Curve</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <svg className="h-5 w-5 text-faint mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
          </svg>
          <span className="text-xs text-faint">No price data available</span>
          <span className="text-xs text-faint mt-1">Enter settlement prices in Market Data to see the forward curve</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Forward Curve</h2>
        <div className="flex gap-1">
          {PRESETS.map((p, i) => (
            <button
              key={p.days}
              onClick={() => {
                if (activePreset === i) {
                  setActivePreset(null);
                  onCompareChange(undefined);
                } else {
                  setActivePreset(i);
                  onCompareChange(daysAgo(p.days));
                }
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                activePreset === i
                  ? "bg-action text-primary"
                  : "bg-input-bg text-muted hover:bg-hover hover:text-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#8B95A5" }}
            labelFormatter={(label) => formatContractMonth(String(label))}
            formatter={(value, name) => {
              if (value == null) return ["-", name];
              return [`$${Number(value).toFixed(4)}`, name];
            }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Area
            dataKey="current"
            name="Current"
            stroke={chartTheme.forwardCurrent}
            fill={chartTheme.forwardCurrent}
            fillOpacity={0.15}
            strokeWidth={2}
            dot={{ r: 3, fill: chartTheme.forwardCurrent }}
            type="monotone"
            connectNulls
          />
          {comparison && (
            <Line
              dataKey="comparison"
              name={compareDate ? `As of ${compareDate}` : "Comparison"}
              stroke={chartTheme.forwardCompare}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: chartTheme.forwardCompare }}
              type="monotone"
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
