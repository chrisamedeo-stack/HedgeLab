"use client";

import { useMemo } from "react";
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

const BUSHELS_PER_MT = 39.3683;

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function fmtK(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : String(Math.round(n));
}

interface Props {
  coverage: CoverageResponse[];
}

export function CoverageStackedChart({ coverage }: Props) {
  const data = useMemo(() => {
    const buckets = new Map<string, { month: string; budget: number; hedged: number; committed: number; efpd: number }>();

    for (const site of coverage) {
      for (const m of site.months ?? []) {
        const existing = buckets.get(m.month) ?? { month: m.month, budget: 0, hedged: 0, committed: 0, efpd: 0 };
        existing.budget += (m.budgetedMt ?? 0) * BUSHELS_PER_MT;
        existing.hedged += (m.hedgedMt ?? 0) * BUSHELS_PER_MT;
        existing.committed += (m.committedMt ?? 0) * BUSHELS_PER_MT;
        existing.efpd += (m.efpdMt ?? 0) * BUSHELS_PER_MT;
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
          Coverage by Month (bu)
        </h3>
        <div className="h-72 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No coverage data to chart yet</p>
          <p className="text-xs text-ph mt-1">Add budget lines and hedge trades to see coverage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
        Coverage by Month (bu)
      </h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 12 }}
              formatter={(value: number, name: string) => [fmtK(value) + " bu", name]}
              labelFormatter={(label: string) => label}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.tick }} />
            <Bar dataKey="hedged" name="Hedged" stackId="cov" fill={chartTheme.hedged} radius={[0, 0, 0, 0]} />
            <Bar dataKey="committed" name="Committed" stackId="cov" fill={chartTheme.committed} radius={[0, 0, 0, 0]} />
            <Bar dataKey="efpd" name="EFP" stackId="cov" fill={chartTheme.accent} radius={[2, 2, 0, 0]} />
            <Line dataKey="budget" name="Budget Target" type="stepAfter" stroke={chartTheme.budget} strokeWidth={2} strokeDasharray="6 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
