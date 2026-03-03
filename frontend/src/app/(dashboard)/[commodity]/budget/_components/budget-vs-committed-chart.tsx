"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import { CornBudgetLineResponse, CoverageResponse } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";
import { fmtK } from "@/lib/chart-utils";
import { formatNumber } from "@/lib/format";
import { useCommodity } from "@/contexts/CommodityContext";

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

interface ChartRow {
  month: string;
  label: string;
  committed: number;
  budget: number;
  forecast: number;
  variance: number;
}

interface Props {
  lines: CornBudgetLineResponse[];
  coverage?: CoverageResponse[];
}

function VarianceLabel(props: { x?: number; y?: number; width?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, value } = props;
  if (!value || value === 0) return null;
  const label = value > 0
    ? `+${fmtK(value)}`
    : `−${fmtK(Math.abs(value))}`;
  return (
    <text
      x={x + width / 2}
      y={y - 4}
      textAnchor="middle"
      fontSize={9}
      fontWeight={600}
      fill={value > 0 ? chartTheme.profit : chartTheme.loss}
    >
      {label}
    </text>
  );
}

const LEGEND_ITEMS = [
  { label: "Committed", color: chartTheme.committed },
  { label: "Budget", color: chartTheme.primary },
  { label: "Forecast", color: chartTheme.accent },
];

export function BudgetVsCommittedChart({ lines, coverage }: Props) {
  const { config } = useCommodity();
  const BUSHELS_PER_MT = config.bushelsPerMt;

  const data = useMemo<ChartRow[]>(() => {
    const budgetByMonth = new Map<string, number>();
    const forecastByMonth = new Map<string, number>();

    for (const l of lines) {
      const budgetBu = l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT;
      budgetByMonth.set(l.budgetMonth, (budgetByMonth.get(l.budgetMonth) ?? 0) + budgetBu);

      const forecastBu = l.forecastVolumeBu ?? (l.forecastVolumeMt != null
        ? l.forecastVolumeMt * BUSHELS_PER_MT
        : budgetBu);
      forecastByMonth.set(l.budgetMonth, (forecastByMonth.get(l.budgetMonth) ?? 0) + forecastBu);
    }

    const committedByMonth = new Map<string, number>();
    if (coverage) {
      for (const site of coverage) {
        for (const m of site.months ?? []) {
          committedByMonth.set(m.month, (committedByMonth.get(m.month) ?? 0) + (m.committedMt ?? 0) * BUSHELS_PER_MT);
        }
      }
    }

    const months = new Set([
      ...Array.from(budgetByMonth.keys()),
      ...Array.from(committedByMonth.keys()),
    ]);

    return Array.from(months)
      .sort()
      .map((m) => {
        const budget = Math.round(budgetByMonth.get(m) ?? 0);
        const forecast = Math.round(forecastByMonth.get(m) ?? 0);
        return {
          month: m,
          label: monthLabel(m),
          committed: Math.round(committedByMonth.get(m) ?? 0),
          budget,
          forecast,
          variance: forecast - budget,
        };
      });
  }, [lines, coverage, BUSHELS_PER_MT]);

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          Budget vs Forecast vs Committed (bu)
        </h3>
        <div className="h-64 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No budget data to chart yet</p>
          <p className="text-xs text-ph mt-1">Add budget lines to see budget vs committed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Budget vs Forecast vs Committed (bu)
        </h3>
        <div className="flex items-center gap-4">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color, opacity: item.color === chartTheme.committed ? 0.35 : 1 }}
              />
              <span className="text-[10px] text-faint">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: chartTheme.tick }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTheme.tick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.tooltipBg,
                border: `1px solid ${chartTheme.tooltipBorder}`,
                color: chartTheme.tooltipText,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                formatNumber(Math.round(value)) + " bu",
                name,
              ]}
              labelFormatter={(label: string) => label}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as ChartRow | undefined;
                return (
                  <div
                    className="rounded px-3 py-2 text-xs"
                    style={{
                      backgroundColor: chartTheme.tooltipBg,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      color: chartTheme.tooltipText,
                    }}
                  >
                    <p className="font-medium mb-1">{label}</p>
                    <p>Committed: {formatNumber(row?.committed ?? 0)} bu</p>
                    <p>Budget: {formatNumber(row?.budget ?? 0)} bu</p>
                    <p>Forecast: {formatNumber(row?.forecast ?? 0)} bu</p>
                    {row && row.variance !== 0 && (
                      <p style={{ color: row.variance > 0 ? chartTheme.profit : chartTheme.loss }}>
                        Variance: {row.variance > 0 ? "+" : "−"}{formatNumber(Math.abs(row.variance))} bu
                      </p>
                    )}
                  </div>
                );
              }}
            />

            {/* Committed — wide backdrop bar */}
            <Bar dataKey="committed" name="Committed" barSize={60} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={chartTheme.committed} fillOpacity={0.2} />
              ))}
            </Bar>

            {/* Budget — narrow grouped left */}
            <Bar dataKey="budget" name="Budget" barSize={20} fill={chartTheme.primary} radius={[3, 3, 0, 0]} />

            {/* Forecast — narrow grouped right, with variance labels */}
            <Bar dataKey="forecast" name="Forecast" barSize={20} fill={chartTheme.accent} radius={[3, 3, 0, 0]}>
              <LabelList dataKey="variance" content={<VarianceLabel />} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
