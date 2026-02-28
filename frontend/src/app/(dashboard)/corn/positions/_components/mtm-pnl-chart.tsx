"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import type { HedgeBookItem, SiteAllocationItem } from "@/hooks/useCorn";
import { BarChart3 } from "lucide-react";
import { chartTheme } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";
import { fmtBudgetMonth } from "./shared";

// Colors pulled from theme
const BAR_POS = chartTheme.profit;  // Steel-Lt — gains
const BAR_NEG = chartTheme.loss;    // Steel — losses

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

type View = "budget" | "delivery";

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  hedgeBook: HedgeBookItem[];
  siteAllocations: SiteAllocationItem[];
}

export function MtmPnlChart({ hedgeBook, siteAllocations }: Props) {
  const [view, setView] = useState<View>("budget");

  // Budget month: aggregate P&L from site allocations
  const budgetData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of siteAllocations) {
      if (a.mtmPnlUsd == null) continue;
      map.set(a.budgetMonth, (map.get(a.budgetMonth) ?? 0) + a.mtmPnlUsd);
    }
    return Array.from(map.entries())
      .map(([month, pnl]) => ({ label: fmtBudgetMonth(month), pnl }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [siteAllocations]);

  // Delivery month: aggregate P&L from hedge book by futures month
  const deliveryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of hedgeBook) {
      if (h.mtmPnlUsd == null) continue;
      map.set(h.futuresMonth, (map.get(h.futuresMonth) ?? 0) + h.mtmPnlUsd);
    }
    return Array.from(map.entries())
      .map(([month, pnl]) => ({ label: month, pnl }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [hedgeBook]);

  const data = view === "budget" ? budgetData : deliveryData;
  const title = view === "budget" ? "MTM P&L by Budget Month" : "MTM P&L by Delivery Month";

  if (data.length === 0) {
    return (
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">{title}</h3>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <div className="h-56 flex flex-col items-center justify-center text-ph">
          <BarChart3 className="h-10 w-10 mb-2" />
          <p className="text-sm">No MTM data available</p>
          <p className="text-xs text-ph mt-1">Refresh prices to calculate mark-to-market P&amp;L</p>
        </div>
      </div>
    );
  }

  const totalPnl = data.reduce((s, d) => s + d.pnl, 0);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider">{title}</h3>
          <span className={cn("text-sm font-semibold tabular-nums", totalPnl >= 0 ? "text-action" : "text-loss")}>
            Total: {fmtUsd(totalPnl)}
          </span>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: chartTheme.tick }} axisLine={false} tickLine={false} tickFormatter={fmtUsd} />
            <Tooltip
              contentStyle={{ backgroundColor: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, color: chartTheme.tooltipText, fontSize: 12 }}
              formatter={(value: number) => [fmtUsd(value), "MTM P&L"]}
            />
            <ReferenceLine y={0} stroke={chartTheme.tick} strokeDasharray="3 3" />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.pnl >= 0 ? BAR_POS : BAR_NEG} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── View Toggle ─────────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="flex gap-1 p-0.5 bg-input-bg border border-b-default rounded-lg">
      {([
        { key: "budget" as View, label: "Budget Month" },
        { key: "delivery" as View, label: "Delivery Month" },
      ]).map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-3 py-1 rounded text-xs font-medium transition-colors",
            view === opt.key ? "bg-action text-white shadow-sm" : "text-muted hover:text-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
