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
import { fmtK } from "@/lib/chart-utils";
import { formatNumber } from "@/lib/format";

const BUSHELS_PER_MT = 39.3683;

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

interface Props {
  coverage: CoverageResponse[];
}

export function CoverageStackedChart({ coverage }: Props) {
  const data = useMemo(() => {
    const buckets = new Map<string, { month: string; budget: number; board: number; basis: number }>();

    for (const site of coverage) {
      for (const m of site.months ?? []) {
        const existing = buckets.get(m.month) ?? { month: m.month, budget: 0, board: 0, basis: 0 };
        existing.budget += (m.budgetedMt ?? 0) * BUSHELS_PER_MT;
        existing.board += (m.hedgedMt ?? 0) * BUSHELS_PER_MT;
        existing.basis += (m.efpdMt ?? 0) * BUSHELS_PER_MT;
        buckets.set(m.month, existing);
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        ...d,
        open: Math.max(0, d.budget - d.board - d.basis),
        label: monthLabel(d.month),
      }));
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
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 12 }}
              formatter={(value: number, name: string) => [formatNumber(Math.round(value)) + " bu", name]}
              labelFormatter={(label: string) => label}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.tick }} />
            <Bar dataKey="board" name="Board Price" stackId="cov" fill={chartTheme.board} />
            <Bar dataKey="basis" name="Basis" stackId="cov" fill={chartTheme.basis} />
            <Bar dataKey="open" name="Open" stackId="cov" fill={chartTheme.unhedged} fillOpacity={0.25} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
