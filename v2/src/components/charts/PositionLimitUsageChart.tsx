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
  ReferenceLine,
} from "recharts";
import { chartTheme, chartColors, tooltipStyle, axisStyle } from "@/lib/chartTheme";
import type { PositionLimit, LimitCheck } from "@/types/risk";

interface PositionLimitUsageChartProps {
  limits: PositionLimit[];
  checks: LimitCheck[];
  height?: number;
}

export function PositionLimitUsageChart({ limits, checks, height = 280 }: PositionLimitUsageChartProps) {
  // Build latest check per limit
  const checkByLimit: Record<string, LimitCheck> = {};
  for (const check of checks) {
    if (!checkByLimit[check.limit_id] || check.created_at > checkByLimit[check.limit_id].created_at) {
      checkByLimit[check.limit_id] = check;
    }
  }

  const data = limits
    .filter((l) => checkByLimit[l.id])
    .map((l) => {
      const check = checkByLimit[l.id];
      return {
        name: `${l.commodity_name ?? "All"} (${l.limit_type})`,
        utilization: Number(check.utilization_pct),
        result: check.result,
        threshold: Number(l.alert_threshold),
      };
    });

  if (data.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Position Limit Usage</h2>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
          <XAxis
            type="number"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            domain={[0, 120]}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={axisStyle.stroke}
            fontSize={axisStyle.fontSize}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#8B95A5" }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Utilization"]}
          />
          <ReferenceLine x={100} stroke={chartTheme.limitBreached} strokeDasharray="3 3" strokeWidth={2} />
          <Bar dataKey="utilization" radius={[0, 4, 4, 0]} barSize={18}>
            {data.map((entry, index) => {
              let fill: string = chartTheme.limitOk;
              if (entry.result === "breached") fill = chartTheme.limitBreached;
              else if (entry.result === "warning") fill = chartTheme.limitWarning;
              return <Cell key={index} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
