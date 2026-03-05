"use client";

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { chartTheme, chartColors, tooltipStyle } from "@/lib/chartTheme";
import type { CounterpartyExposure } from "@/types/risk";

interface CounterpartyExposureChartProps {
  data: CounterpartyExposure[];
  height?: number;
}

interface TreemapContentProps {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  index: number;
}

function TreemapContent({ x, y, width, height: h, name, index }: TreemapContentProps) {
  const colors = chartTheme.counterparty;
  const fill = colors[index % colors.length];

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={h}
        rx={3}
        fill={fill}
        fillOpacity={0.85}
        stroke={chartColors.surface}
        strokeWidth={2}
      />
      {width > 50 && h > 25 && (
        <text
          x={x + width / 2}
          y={y + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={width > 100 ? 11 : 9}
          fontWeight={500}
        >
          {name}
        </text>
      )}
    </g>
  );
}

export function CounterpartyExposureChart({ data, height = 300 }: CounterpartyExposureChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Counterparty Exposure</h2>
        <div className="flex flex-col items-center justify-center" style={{ height }}>
          <svg className="h-10 w-10 text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm text-faint">No counterparty exposure data</span>
        </div>
      </div>
    );
  }

  const treemapData = data.map((d) => ({
    name: d.counterpartyName,
    size: Math.max(d.totalExposure, 1),
    contracts: d.contractCount,
    remaining: d.remainingVolume,
  }));

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">Counterparty Exposure</h2>
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={treemapData}
          dataKey="size"
          aspectRatio={4 / 3}
          content={<TreemapContent x={0} y={0} width={0} height={0} name="" index={0} />}
        >
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => {
              if (name === "size") return [`$${Number(value ?? 0).toLocaleString()}`, "Exposure"];
              return [value, name];
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
