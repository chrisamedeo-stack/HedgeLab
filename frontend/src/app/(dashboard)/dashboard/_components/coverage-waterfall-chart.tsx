"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { CoverageResponse } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";
import { fmtK } from "@/lib/chart-utils";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const BUSHELS_PER_MT = 39.3683;

type TimeRange = "3" | "6" | "12" | "all";

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

interface Props {
  coverage: CoverageResponse[];
  filterSiteCodes?: string[];
}

export function CoverageWaterfallChart({ coverage, filterSiteCodes }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  const allData = useMemo(() => {
    const buckets = new Map<string, { month: string; hedged: number; gap: number; budget: number }>();
    const filtered = filterSiteCodes
      ? coverage.filter((c) => filterSiteCodes.includes(c.siteCode))
      : coverage;

    for (const site of filtered) {
      for (const m of site.months ?? []) {
        const existing = buckets.get(m.month) ?? { month: m.month, hedged: 0, gap: 0, budget: 0 };
        const budBu = (m.budgetedMt ?? 0) * BUSHELS_PER_MT;
        const hedBu = (m.hedgedMt ?? 0) * BUSHELS_PER_MT;
        existing.hedged += hedBu;
        existing.budget += budBu;
        existing.gap += Math.max(0, budBu - hedBu);
        buckets.set(m.month, existing);
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        ...d,
        label: monthLabel(d.month),
        coveragePct: d.budget > 0 ? Math.round((d.hedged / d.budget) * 100) : 0,
      }));
  }, [coverage, filterSiteCodes]);

  const data = useMemo(() => {
    if (timeRange === "all") return allData;
    const cur = currentMonth();
    const end = addMonths(cur, parseInt(timeRange));
    return allData.filter((d) => d.month >= cur && d.month < end);
  }, [allData, timeRange]);

  if (allData.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          Coverage by Month
        </h3>
        <div className="h-48 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-8 w-8 mb-2" />
          <p className="text-sm">No coverage data yet</p>
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
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="volume"
              tick={{ fontSize: 9, fill: chartTheme.tick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtK}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fontSize: 9, fill: chartTheme.tick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 11 }}
              formatter={(value: number, name: string) => {
                if (name === "Coverage %") return [`${value}%`, name];
                return [formatNumber(Math.round(value)) + " bu", name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: chartTheme.tick }} />
            <Bar yAxisId="volume" dataKey="hedged" name="Hedged" stackId="cov" fill={chartTheme.hedged} radius={[0, 0, 0, 0]} />
            <Bar yAxisId="volume" dataKey="gap" name="Unhedged" stackId="cov" fill={chartTheme.unhedged} radius={[2, 2, 0, 0]} />
            <Line
              yAxisId="pct"
              dataKey="coveragePct"
              name="Coverage %"
              type="monotone"
              stroke={chartTheme.warning}
              strokeWidth={2}
              dot={{ r: 3, fill: chartTheme.warning }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
