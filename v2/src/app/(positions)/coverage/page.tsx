"use client";

import { useState } from "react";
import { useCoverage } from "@/hooks/useBudget";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useSites } from "@/hooks/usePositions";
import { KPICard } from "@/components/ui/KPICard";
import { CoverageChart } from "@/components/budget/CoverageChart";
import type { CoverageDataPoint } from "@/types/budget";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

type TimeRange = "3" | "6" | "12" | "all";

export default function CoveragePage() {
  const { commodityId } = useCommodityContext();
  const { data: sites } = useSites(DEFAULT_ORG);
  const [filterSite, setFilterSite] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("12");

  const { data: coverage, loading } = useCoverage(DEFAULT_ORG, commodityId ?? undefined, filterSite ?? undefined);

  // Filter by time range
  const filteredData: CoverageDataPoint[] = (() => {
    if (!coverage?.byMonth) return [];
    if (timeRange === "all") return coverage.byMonth;
    const limit = Number(timeRange);
    return coverage.byMonth.slice(0, limit);
  })();

  // Coverage color
  const coverageTrend = coverage
    ? coverage.overallCoveragePct >= 80
      ? "up" as const
      : coverage.overallCoveragePct >= 50
      ? "neutral" as const
      : "down" as const
    : undefined;

  return (
    <div className="space-y-6 page-fade">
      <div>
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">Coverage Overview</h1>
        <p className="mt-0.5 text-xs text-faint">Track budget coverage across sites and months</p>
      </div>

      {/* KPIs */}
      {coverage && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KPICard
            label="Total Budget"
            value={`${coverage.totalBudgeted.toLocaleString()} MT`}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
          />
          <KPICard
            label="Committed"
            value={`${coverage.totalCommitted.toLocaleString()} MT`}
            subtitle={coverage.totalBudgeted > 0
              ? `${Math.round((coverage.totalCommitted / coverage.totalBudgeted) * 100)}% of budget`
              : undefined}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KPICard
            label="Hedged"
            value={`${coverage.totalHedged.toLocaleString()} MT`}
            subtitle={coverage.totalBudgeted > 0
              ? `${Math.round((coverage.totalHedged / coverage.totalBudgeted) * 100)}% of budget`
              : undefined}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
          />
          <KPICard
            label="Overall Coverage"
            value={`${coverage.overallCoveragePct}%`}
            trend={coverageTrend}
            subtitle={`${coverage.totalOpen.toLocaleString()} MT open`}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterSite ?? ""}
            onChange={(e) => setFilterSite(e.target.value || null)}
            className="border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
          >
            <option value="">All Sites</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          {(["3", "6", "12", "all"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                timeRange === r
                  ? "bg-action-10 text-secondary"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {r === "all" ? "All" : `${r}mo`}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="text-center py-12 text-faint">Loading coverage data...</div>
      ) : (
        <CoverageChart data={filteredData} height={400} />
      )}

      {/* Per-site breakdown */}
      {sites && sites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-secondary">Site Breakdown</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => {
              // We don't have per-site data in the current coverage query
              // but we provide a link to the budget filtered by site
              return (
                <div
                  key={site.id}
                  onClick={() => setFilterSite(filterSite === site.id ? null : site.id)}
                  className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                    filterSite === site.id
                      ? "border-action-20 bg-action-5"
                      : "border-b-default bg-surface hover:bg-row-hover"
                  }`}
                >
                  <div className="text-sm font-medium text-secondary">{site.name}</div>
                  <div className="text-xs text-faint">{site.code} · {site.site_type_name}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
