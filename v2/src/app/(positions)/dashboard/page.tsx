"use client";

import { useState, useEffect } from "react";
import { useHedgeBook, useSites, useSiteGroups, useCommodities } from "@/hooks/usePositions";
import { useBudgetStore } from "@/store/budgetStore";
import { useCommodityContext } from "@/contexts/CommodityContext";
import Link from "next/link";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-faint">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color ?? "text-primary"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function QuickActions() {
  const links = [
    { href: "/trades", label: "Book Trade", icon: "M12 4v16m8-8H4" },
    { href: "/hedge-book", label: "Hedge Book", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { href: "/budget", label: "Budget", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { href: "/coverage", label: "Coverage", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { href: "/roll-candidates", label: "Roll Candidates", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
    { href: "/import", label: "Import Data", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  ];

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex flex-col items-center gap-2 rounded-lg border border-b-default bg-input-bg px-3 py-4 text-center text-xs font-medium text-muted hover:bg-hover hover:text-secondary transition-colors"
          >
            <svg className="h-5 w-5 text-action" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
            </svg>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { commodityId } = useCommodityContext();
  const { data: hedgeBook, loading: hbLoading } = useHedgeBook(ORG_ID, commodityId ?? undefined);
  const { data: sites } = useSites(ORG_ID);
  const { data: commodities } = useCommodities();
  const { periods, coverage, fetchPeriods, fetchCoverage, loading: budgetLoading } = useBudgetStore();

  useEffect(() => {
    fetchPeriods(ORG_ID);
    fetchCoverage(ORG_ID, commodityId ?? undefined);
  }, [fetchPeriods, fetchCoverage, commodityId]);

  const isLoading = hbLoading || budgetLoading;

  // KPIs
  const entries = hedgeBook?.entries ?? [];
  const openEntries = entries.filter((e) => e.status === "open");
  const totalOpenVolume = openEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);
  const efpEntries = entries.filter((e) => e.status === "efp_closed");
  const lockedVolume = efpEntries.reduce((s, e) => s + (e.allocated_volume ?? 0), 0);

  const coveragePct = coverage?.overallCoveragePct ?? 0;
  const totalBudgeted = coverage?.totalBudgeted ?? 0;
  const totalOpen = coverage?.totalOpen ?? 0;

  const activePeriods = periods.filter((p) => p.status !== "approved").length;

  const selectedCommodityName = commodities?.find((c) => c.id === commodityId)?.name ?? "All";

  if (isLoading && !hedgeBook) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-primary">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface border border-b-default rounded-lg p-5 space-y-3 animate-pulse">
              <div className="h-3 w-24 bg-hover rounded" />
              <div className="h-7 w-16 bg-hover rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Dashboard</h1>
          <p className="mt-0.5 text-xs text-faint">
            {selectedCommodityName} overview &middot; {sites?.length ?? 0} sites
          </p>
        </div>
        <span className="text-sm text-muted tabular-nums">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Hedge Coverage"
          value={`${Number(coveragePct).toFixed(1)}%`}
          sub={`${Number(totalBudgeted).toLocaleString()} budgeted`}
          color={Number(coveragePct) >= 80 ? "text-profit" : Number(coveragePct) >= 50 ? "text-warning" : "text-loss"}
        />
        <KPICard
          label="Open Volume"
          value={totalOpenVolume.toLocaleString()}
          sub={`${openEntries.length} open allocations`}
        />
        <KPICard
          label="Locked Volume"
          value={lockedVolume.toLocaleString()}
          sub={`${efpEntries.length} EFP positions`}
          color="text-profit"
        />
        <KPICard
          label="Unhedged Volume"
          value={Number(totalOpen).toLocaleString()}
          sub={`${activePeriods} budget period${activePeriods !== 1 ? "s" : ""} in progress`}
          color={Number(totalOpen) > 0 ? "text-warning" : "text-profit"}
        />
      </div>

      {/* Coverage by month */}
      {coverage && coverage.byMonth && coverage.byMonth.length > 0 && (
        <div className="bg-surface border border-b-default rounded-lg p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Coverage by Month</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-b-default">
                  <th className="px-3 py-2 text-left text-xs font-medium text-faint">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-faint">Budgeted</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-faint">Committed</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-faint">Hedged</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-faint">Open</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-faint">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-b-default">
                {coverage.byMonth.map((m: { month: string; budgeted: number; committed: number; hedged: number; open: number }) => {
                  const pct = Number(m.budgeted) > 0
                    ? ((Number(m.committed) + Number(m.hedged)) / Number(m.budgeted) * 100)
                    : 0;
                  return (
                    <tr key={m.month} className="hover:bg-row-hover">
                      <td className="px-3 py-2 font-mono text-secondary">{m.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-secondary">{Number(m.budgeted).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-secondary">{Number(m.committed).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-secondary">{Number(m.hedged).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-warning">{Number(m.open).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`tabular-nums font-medium ${pct >= 80 ? "text-profit" : pct >= 50 ? "text-warning" : "text-loss"}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="bg-surface border border-b-default rounded-lg p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Alerts</h2>
        <div className="space-y-2">
          {Number(totalOpen) > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-warning-30 bg-warning-10 px-4 py-3 text-sm">
              <svg className="h-4 w-4 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-warning">{Number(totalOpen).toLocaleString()} unhedged volume remaining</span>
              <Link href="/coverage" className="ml-auto text-xs font-medium text-action hover:underline">View Coverage</Link>
            </div>
          )}
          {activePeriods > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-action-20 bg-action-10 px-4 py-3 text-sm">
              <svg className="h-4 w-4 text-action shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-action">{activePeriods} budget period{activePeriods !== 1 ? "s" : ""} pending approval</span>
              <Link href="/budget" className="ml-auto text-xs font-medium text-action hover:underline">View Budget</Link>
            </div>
          )}
          {Number(totalOpen) === 0 && activePeriods === 0 && (
            <p className="text-sm text-faint py-2">No alerts at this time.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}
