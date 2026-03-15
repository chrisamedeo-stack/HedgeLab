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

interface PositionLifecycleFunnelProps {
  total: number;
  open: number;
  locked: number;
  offset: number;
  rolled: number;
  height?: number;
}

const STAGE_COLORS: Record<string, string> = {
  Total: chartColors.chart3,
  Open: chartTheme.statusOpen,
  Locked: chartTheme.statusLocked,
  Offset: chartTheme.statusOffset,
  Rolled: chartTheme.statusRolled,
};

export function PositionLifecycleFunnel({
  total,
  open,
  locked,
  offset,
  rolled,
  height = 200,
}: PositionLifecycleFunnelProps) {
  const data = [
    { stage: "Total", value: total },
    { stage: "Open", value: open },
    { stage: "Locked", value: locked },
    { stage: "Offset", value: offset },
    { stage: "Rolled", value: rolled },
  ];

  if (total === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Position Lifecycle</h2>
        <div className="flex items-center justify-center py-6">
          <span className="text-xs text-faint">No position data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4 h-full">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Position Lifecycle</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
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
            dataKey="stage"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: chartColors.muted }}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), "Volume"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? chartColors.muted} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
