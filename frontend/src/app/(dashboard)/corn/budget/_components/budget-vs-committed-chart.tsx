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
import { CornBudgetLineResponse, CoverageResponse } from "@/hooks/useCorn";
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
  lines: CornBudgetLineResponse[];
  coverage?: CoverageResponse[];
}

export function BudgetVsCommittedChart({ lines, coverage }: Props) {
  const data = useMemo(() => {
    // Sum budget by month
    const budgetByMonth = new Map<string, number>();
    for (const l of lines) {
      const bu = l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT;
      budgetByMonth.set(l.budgetMonth, (budgetByMonth.get(l.budgetMonth) ?? 0) + bu);
    }

    // Sum committed by month from coverage
    const committedByMonth = new Map<string, number>();
    if (coverage) {
      for (const site of coverage) {
        for (const m of site.months ?? []) {
          committedByMonth.set(m.month, (committedByMonth.get(m.month) ?? 0) + (m.committedMt ?? 0) * BUSHELS_PER_MT);
        }
      }
    }

    const months = new Set([...Array.from(budgetByMonth.keys()), ...Array.from(committedByMonth.keys())]);
    return Array.from(months)
      .sort()
      .map((m) => ({
        month: m,
        label: monthLabel(m),
        budget: Math.round(budgetByMonth.get(m) ?? 0),
        committed: Math.round(committedByMonth.get(m) ?? 0),
      }));
  }, [lines, coverage]);

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
          Budget vs Committed (bu)
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
      <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-4">
        Budget vs Committed (bu)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 12 }}
              formatter={(value: number, name: string) => [fmtK(value) + " bu", name]}
              labelFormatter={(label: string) => label}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <Bar dataKey="budget" name="Budget" fill={chartTheme.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="committed" name="Committed" fill={chartTheme.hedged} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
