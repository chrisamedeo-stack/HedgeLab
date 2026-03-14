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
import { chartColors, tooltipStyle, legendStyle, axisStyle } from "@/lib/chartTheme";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { BasisByMonth } from "@/types/positions";

interface BasisByMonthChartProps {
  data: BasisByMonth[];
  height?: number;
}

export function BasisByMonthChart({ data, height = 260 }: BasisByMonthChartProps) {
  const chartData = data.map((d) => ({
    month: d.delivery_month,
    lockedBasis: d.locked_basis,
    physicalBasis: d.physical_basis,
    lockedVolume: d.locked_volume,
    physicalVolume: d.physical_volume,
  }));

  if (chartData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Basis by Delivery Month</h2>
        <div className="flex flex-col items-center justify-center py-6">
          <svg className="h-5 w-5 text-faint mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <span className="text-xs text-faint">No basis data by month</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Basis by Delivery Month</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            formatter={(value, name) => {
              if (value == null) return ["-", String(name)];
              return [`$${Number(value).toFixed(4)}`, String(name)];
            }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Bar
            dataKey="lockedBasis"
            name="Locked Basis"
            fill={chartColors.chart1}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            dataKey="physicalBasis"
            name="Physical Basis"
            fill={chartColors.chart3}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
