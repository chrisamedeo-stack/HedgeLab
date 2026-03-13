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
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, axisStyle } from "@/lib/chartTheme";
import type { BasisBySite } from "@/types/positions";

interface BasisBySiteChartProps {
  data: BasisBySite[];
  height?: number;
}

export function BasisBySiteChart({ data, height = 260 }: BasisBySiteChartProps) {
  const chartData = data.map((d) => ({
    name: d.name,
    code: d.code,
    basis: d.avg_basis,
    volume: d.total_volume,
    min: d.min_basis,
    max: d.max_basis,
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Basis by Site</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <svg className="h-5 w-5 text-faint mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
          </svg>
          <span className="text-xs text-faint">No basis data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Basis by Site</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#B3C0D3" }}
            formatter={(value, _name, props) => {
              const v = Number(value ?? 0);
              const p = (props as unknown as { payload: { volume: number; min: number; max: number } }).payload;
              return [
                `$${v.toFixed(4)} avg | Vol: ${p.volume.toLocaleString()} | Range: $${p.min.toFixed(4)} – $${p.max.toFixed(4)}`,
                "Basis",
              ];
            }}
          />
          <Bar dataKey="basis" name="Avg Basis" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.basis >= 0 ? chartTheme.basisPositive : chartTheme.basisNegative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
