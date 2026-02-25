"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
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

const BUSHELS_PER_MT = 39.3683;

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short" });
}

function fmtK(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));
}

interface Props {
  coverage: CoverageResponse[];
}

export function CoverageWaterfallChart({ coverage }: Props) {
  const data = useMemo(() => {
    const buckets = new Map<string, { month: string; hedged: number; gap: number }>();

    for (const site of coverage) {
      for (const m of site.months ?? []) {
        const existing = buckets.get(m.month) ?? { month: m.month, hedged: 0, gap: 0 };
        const budBu = (m.budgetedMt ?? 0) * BUSHELS_PER_MT;
        const hedBu = (m.hedgedMt ?? 0) * BUSHELS_PER_MT;
        existing.hedged += hedBu;
        existing.gap += Math.max(0, budBu - hedBu);
        buckets.set(m.month, existing);
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({ ...d, label: monthLabel(d.month) }));
  }, [coverage]);

  if (data.length === 0) {
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

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
        Coverage by Month
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 11 }}
              formatter={(value: number, name: string) => [fmtK(value) + " bu", name]}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: chartTheme.tick }} />
            <Bar dataKey="hedged" name="Hedged" stackId="cov" fill={chartTheme.hedged} radius={[0, 0, 0, 0]} />
            <Bar dataKey="gap" name="Unhedged" stackId="cov" fill={chartTheme.unhedged} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
