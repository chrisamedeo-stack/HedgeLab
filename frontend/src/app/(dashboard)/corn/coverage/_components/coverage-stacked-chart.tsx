"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Customized,
} from "recharts";
import type { CoverageResponse } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";
import { fmtK } from "@/lib/chart-utils";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BUSHELS_PER_MT } from "@/lib/corn-utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeRange = "3" | "6" | "12" | "all";

interface ChartRow {
  month: string;
  label: string;
  basis: number;
  fixed: number;
  unfixed: number;
  options: number;
  budget: number;
  priceCov: number;
  volCov: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short" });
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Budget dashed line overlay ─────────────────────────────────────────────

function BudgetLineOverlay(props: Record<string, unknown>) {
  const { xAxisMap, yAxisMap, formattedGraphicalItems } = props as {
    xAxisMap?: Record<string, { scale: (v: string) => number; bandSize?: number }>;
    yAxisMap?: Record<string, { scale: (v: number) => number }>;
    formattedGraphicalItems?: { props?: { data?: { payload?: ChartRow }[] } }[];
  };

  if (!xAxisMap || !yAxisMap || !formattedGraphicalItems) return null;

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis || !yAxis) return null;

  const bandSize = xAxis.bandSize ?? 40;
  const firstBarSeries = formattedGraphicalItems[0];
  const dataPoints = firstBarSeries?.props?.data;
  if (!dataPoints) return null;

  return (
    <g>
      {dataPoints.map((point, i) => {
        const row = point.payload;
        if (!row || row.budget <= 0) return null;
        const x = xAxis.scale(row.label);
        const y = yAxis.scale(row.budget);
        if (x == null || y == null || isNaN(x) || isNaN(y)) return null;
        return (
          <line
            key={i}
            x1={x - bandSize * 0.1}
            x2={x + bandSize * 1.1}
            y1={y}
            y2={y}
            stroke={chartTheme.budgetLine}
            strokeWidth={2.5}
            strokeDasharray="6 3"
          />
        );
      })}
    </g>
  );
}

// ─── Custom tick with coverage % labels ─────────────────────────────────────

interface CovTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
  data: ChartRow[];
}

function CoverageTick({ x, y, payload, data }: CovTickProps) {
  if (x == null || y == null || !payload) return null;
  const row = data.find((d) => d.label === payload.value);
  return (
    <g>
      <text x={x} y={y + 2} textAnchor="middle" fontSize={9} fill={chartTheme.tick}>
        {payload.value}
      </text>
      {row && (
        <text x={x} y={y + 14} textAnchor="middle" fontSize={8} fill={chartTheme.tick} opacity={0.7}>
          {row.priceCov}% / {row.volCov}%
        </text>
      )}
    </g>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  coverage: CoverageResponse[];
}

export function CoverageStackedChart({ coverage }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("12");

  const allData = useMemo(() => {
    const buckets = new Map<
      string,
      { budgetedMt: number; committedMt: number; hedgedMt: number; efpdMt: number }
    >();

    for (const site of coverage) {
      for (const m of site.months ?? []) {
        const cur = buckets.get(m.month) ?? { budgetedMt: 0, committedMt: 0, hedgedMt: 0, efpdMt: 0 };
        cur.budgetedMt += m.budgetedMt ?? 0;
        cur.committedMt += m.committedMt ?? 0;
        cur.hedgedMt += m.hedgedMt ?? 0;
        cur.efpdMt += m.efpdMt ?? 0;
        buckets.set(m.month, cur);
      }
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]): ChartRow => {
        const basis = d.efpdMt * BUSHELS_PER_MT;
        const fixed = d.hedgedMt * BUSHELS_PER_MT;
        const unfixed = Math.max(0, d.committedMt - d.hedgedMt) * BUSHELS_PER_MT;
        const budget = d.budgetedMt * BUSHELS_PER_MT;
        const priceCov = d.budgetedMt > 0 ? Math.round((d.hedgedMt / d.budgetedMt) * 100) : 0;
        const volCov = d.budgetedMt > 0 ? Math.round(((d.hedgedMt + d.efpdMt) / d.budgetedMt) * 100) : 0;
        return {
          month,
          label: monthLabel(month),
          basis,
          fixed,
          unfixed,
          options: 0,
          budget,
          priceCov,
          volCov,
        };
      });
  }, [coverage]);

  const data = useMemo(() => {
    if (timeRange === "all") return allData;
    const cur = currentMonth();
    const end = addMonths(cur, parseInt(timeRange));
    return allData.filter((d) => d.month >= cur && d.month < end);
  }, [allData, timeRange]);

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (allData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          Coverage by Month
        </h3>
        <div className="h-48 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No coverage data to chart yet</p>
          <p className="text-xs text-ph mt-1">Add budget lines and hedge trades to see coverage</p>
        </div>
      </div>
    );
  }

  const ranges: { label: string; value: TimeRange }[] = [
    { label: "3 Mo", value: "3" },
    { label: "6 Mo", value: "6" },
    { label: "12 Mo", value: "12" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          Coverage by Month
        </h3>
        <div className="flex gap-0.5 p-0.5 bg-input-bg border border-b-input rounded-lg">
          {ranges.map((r) => (
            <button
              key={r.value}
              onClick={() => setTimeRange(r.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                timeRange === r.value
                  ? "bg-action text-white"
                  : "text-muted hover:text-secondary"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm" style={{ background: chartTheme.basisRatio }} />
          Basis/Ratio
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm" style={{ background: chartTheme.fixed }} />
          Fixed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm" style={{ background: chartTheme.forecast }} />
          Forecast
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1 border-t-2 border-dashed" style={{ borderColor: chartTheme.budgetLine }} />
          Budget
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 20 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={(props: Record<string, unknown>) => (
                <CoverageTick
                  x={props.x as number}
                  y={props.y as number}
                  payload={props.payload as { value: string }}
                  data={data}
                />
              )}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 9, fill: chartTheme.tick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.tooltipBg,
                border: `1px solid ${chartTheme.tooltipBorder}`,
                color: chartTheme.tooltipText,
                fontSize: 11,
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  basis: "Basis/Ratio",
                  fixed: "Fixed",
                  unfixed: "Forecast (Unfixed)",
                  options: "Options",
                };
                return [formatNumber(Math.round(value)) + " bu", labels[name] ?? name];
              }}
            />

            {/* Basis/Ratio — standalone bar (left column) */}
            <Bar dataKey="basis" fill={chartTheme.basisRatio} radius={[2, 2, 0, 0]} barSize={20} />

            {/* Forecast stack (right column): Fixed + Unfixed + Options */}
            <Bar dataKey="fixed" stackId="fc" fill={chartTheme.fixed} barSize={20} />
            <Bar dataKey="unfixed" stackId="fc" fill={chartTheme.forecast} barSize={20} />
            <Bar dataKey="options" stackId="fc" fill={chartTheme.options} radius={[2, 2, 0, 0]} barSize={20} hide />

            {/* Budget dashed line overlay */}
            <Customized component={BudgetLineOverlay} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
