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
import { chartTheme, chartColors, tooltipStyle, axisStyle, fmtK } from "@/lib/chartTheme";

interface PnlByCommodityData {
  commodityId: string;
  commodityName: string;
  totalPnl: number;
  futuresPnl: number;
  physicalPnl: number;
  netPosition: number;
}

interface PnlByCommodityChartProps {
  data: PnlByCommodityData[];
  height?: number;
}

export function PnlByCommodityChart({ data, height = 260 }: PnlByCommodityChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">P&L by Commodity</h2>
        <div className="flex items-center justify-center py-6">
          <span className="text-xs text-faint">No P&L data available</span>
        </div>
      </div>
    );
  }

  const chartData = data
    .map((d) => ({
      name: d.commodityName,
      pnl: d.totalPnl,
    }))
    .sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">P&L by Commodity</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            tickFormatter={fmtK}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#B3C0D3" }}
            formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, "P&L"]}
          />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={22}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.pnl >= 0 ? chartTheme.pnlPositive : chartTheme.pnlNegative}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
