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
        <h1 className="text-xl font-bold text-primary">Coverage Overview</h1>
        <p className="text-sm text-faint mt-1">Track budget coverage across sites and months</p>
      </div>

      {/* KPIs */}
      {coverage && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KPICard label="Total Budget" value={`${coverage.totalBudgeted.toLocaleString()} MT`} />
          <KPICard
            label="Committed"
            value={`${coverage.totalCommitted.toLocaleString()} MT`}
            subtitle={coverage.totalBudgeted > 0
              ? `${Math.round((coverage.totalCommitted / coverage.totalBudgeted) * 100)}% of budget`
              : undefined}
          />
          <KPICard
            label="Hedged"
            value={`${coverage.totalHedged.toLocaleString()} MT`}
            subtitle={coverage.totalBudgeted > 0
              ? `${Math.round((coverage.totalHedged / coverage.totalBudgeted) * 100)}% of budget`
              : undefined}
          />
          <KPICard
            label="Overall Coverage"
            value={`${coverage.overallCoveragePct}%`}
            trend={coverageTrend}
            subtitle={`${coverage.totalOpen.toLocaleString()} MT open`}
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
