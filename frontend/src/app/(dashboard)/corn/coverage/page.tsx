"use client";

import { useState } from "react";
import { useCoverage } from "@/hooks/useCorn";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber, formatPct } from "@/lib/format";
import { TrendingUp, MapPin, Package, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const BUSHELS_PER_MT = 39.3683;

function pctColor(pct: number) {
  return pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
}
function barColor(pct: number) {
  return pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
}

function CoverageBar({ pct, thin }: { pct: number; thin?: boolean }) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return (
    <div className={cn("relative bg-slate-800 rounded-full overflow-hidden", thin ? "h-1.5" : "h-2")}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", barColor(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function monthLabel(ym: string) {
  if (!ym || ym.length < 7) return ym;
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function fmtBu(mt: number) {
  const bu = mt * BUSHELS_PER_MT;
  return bu >= 1_000_000
    ? `${(bu / 1_000_000).toFixed(2)}M`
    : bu >= 1_000
    ? `${Math.round(bu / 1_000)}K`
    : String(Math.round(bu));
}

export default function CoveragePage() {
  const { coverage, isLoading } = useCoverage();
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  function toggleSite(code: string) {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-7 w-48 mb-1" /><Skeleton className="h-4 w-72" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="space-y-4">
          {[0,1].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (coverage.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No coverage data"
        description="Add budget lines and allocate hedge lots to sites to see coverage."
      />
    );
  }

  // Corporate totals
  const totals = coverage.reduce(
    (acc, s) => ({
      budgetedMt:  acc.budgetedMt  + (s.budgetedMt  ?? 0),
      hedgedMt:    acc.hedgedMt    + (s.hedgedMt    ?? 0),
      committedMt: acc.committedMt + (s.committedMt ?? 0),
      efpdMt:      acc.efpdMt      + (s.efpdMt      ?? 0),
      receivedMt:  acc.receivedMt  + (s.receivedMt  ?? 0),
    }),
    { budgetedMt: 0, hedgedMt: 0, committedMt: 0, efpdMt: 0, receivedMt: 0 }
  );
  const totalHedgePct  = totals.budgetedMt > 0 ? (totals.hedgedMt  / totals.budgetedMt) * 100 : 0;
  const totalEfpPct    = totals.budgetedMt > 0 ? (totals.efpdMt    / totals.budgetedMt) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Coverage Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Corn procurement hedge coverage by site and month · click a site to expand monthly detail
        </p>
      </div>

      {/* Corporate KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Budget",        value: `${fmtBu(totals.budgetedMt)} bu`,  icon: Package },
          { label: "Committed",           value: `${fmtBu(totals.committedMt)} bu`, icon: Layers },
          { label: "Hedge Coverage",      value: formatPct(totalHedgePct),  icon: TrendingUp },
          { label: "EFP Coverage",        value: formatPct(totalEfpPct),    icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-100 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Per-site cards */}
      <div className="space-y-4">
        {coverage.map((site) => {
          const pct      = site.coveragePct ?? 0;
          const expanded = expandedSites.has(site.siteCode);
          const hasMonths = site.months && site.months.length > 0;

          return (
            <div key={site.siteCode} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Site header — clickable */}
              <button
                className="w-full text-left px-6 py-5 hover:bg-slate-800/30 transition-colors"
                onClick={() => toggleSite(site.siteCode)}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-slate-500">
                      {expanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">{site.siteName}</h2>
                      <p className="text-xs text-slate-500">{site.siteCode}</p>
                    </div>
                  </div>
                  <span className={cn("text-3xl font-bold tabular-nums", pctColor(pct))}>
                    {formatPct(pct)}
                  </span>
                </div>

                {/* Site-level progress bar */}
                <div className="space-y-1.5">
                  <CoverageBar pct={pct} />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Hedge coverage: {formatPct(pct)}</span>
                    <span>{fmtBu(site.hedgedMt ?? 0)} / {fmtBu(site.budgetedMt ?? 0)} bu</span>
                  </div>
                </div>

                {/* Site KPI chips */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                  {[
                    { label: "Budgeted",  value: `${fmtBu(site.budgetedMt  ?? 0)} bu` },
                    { label: "Committed", value: `${fmtBu(site.committedMt ?? 0)} bu` },
                    { label: "Hedged",    value: `${fmtBu(site.hedgedMt    ?? 0)} bu` },
                    { label: "EFP'd",     value: `${fmtBu(site.efpdMt      ?? 0)} bu` },
                    { label: "Received",  value: `${fmtBu(site.receivedMt  ?? 0)} bu` },
                    { label: "Open Lots", value: formatNumber(Math.round(site.openHedgeLots  ?? 0)) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-800/50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-slate-200 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </button>

              {/* Monthly breakdown — expanded */}
              {expanded && hasMonths && (
                <div className="border-t border-slate-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/40 border-b border-slate-800">
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Month</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Budget</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Committed</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Hedged</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">EFP'd</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Received</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-48">Hedge Coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {site.months.map((m) => {
                        const mPct   = m.coveragePct ?? 0;
                        const budMt  = m.budgetedMt  ?? 0;
                        const hedMt  = m.hedgedMt    ?? 0;
                        const comMt  = m.committedMt ?? 0;
                        const efpMt  = m.efpdMt      ?? 0;
                        const recMt  = m.receivedMt  ?? 0;

                        return (
                          <tr key={m.month} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-3 font-medium text-slate-300 whitespace-nowrap">
                              {monthLabel(m.month)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-slate-300">
                              {fmtBu(budMt)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={comMt > 0 ? "text-blue-400" : "text-slate-600"}>
                                {comMt > 0 ? fmtBu(comMt) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={hedMt > 0 ? "text-emerald-400" : "text-slate-600"}>
                                {hedMt > 0 ? fmtBu(hedMt) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={efpMt > 0 ? "text-blue-300" : "text-slate-600"}>
                                {efpMt > 0 ? fmtBu(efpMt) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              <span className={recMt > 0 ? "text-slate-300" : "text-slate-600"}>
                                {recMt > 0 ? fmtBu(recMt) : "—"}
                              </span>
                            </td>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <CoverageBar pct={mPct} thin />
                                </div>
                                <span className={cn("text-xs font-semibold tabular-nums w-12 text-right", pctColor(mPct))}>
                                  {formatPct(mPct)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Month subtotals */}
                    <tfoot>
                      <tr className="border-t border-slate-700 bg-slate-800/30">
                        <td className="px-6 py-2 text-xs text-slate-500 font-medium">Total</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-200 text-xs">
                          {fmtBu(site.budgetedMt ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-300 text-xs">
                          {fmtBu(site.committedMt ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-400 text-xs">
                          {fmtBu(site.hedgedMt ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold text-blue-300 text-xs">
                          {fmtBu(site.efpdMt ?? 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-400 text-xs">
                          {fmtBu(site.receivedMt ?? 0)}
                        </td>
                        <td className="px-6 py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex-1"><CoverageBar pct={site.coveragePct ?? 0} thin /></div>
                            <span className={cn("text-xs font-bold tabular-nums w-12 text-right", pctColor(site.coveragePct ?? 0))}>
                              {formatPct(site.coveragePct ?? 0)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {expanded && !hasMonths && (
                <div className="px-6 py-4 border-t border-slate-800 text-sm text-slate-500 italic">
                  No budget lines found for this site — add budget lines to see the monthly breakdown.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
