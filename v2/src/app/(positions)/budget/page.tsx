"use client";

import { useState, useMemo } from "react";
import { useBudgetPeriods, useCoverage } from "@/hooks/useBudget";
import { useCommodities, useSites, type Commodity } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBudgetStore } from "@/store/budgetStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KPICard } from "@/components/ui/KPICard";
import { TabGroup } from "@/components/ui/TabGroup";
import { SkeletonTable, SkeletonKPIGrid } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CoverageChart } from "@/components/budget/CoverageChart";
import { BudgetVsCommittedChart } from "@/components/budget/BudgetVsCommittedChart";
import { FiscalYearGrid } from "@/components/budget/FiscalYearGrid";
import { btnPrimary, btnCancel, selectCls } from "@/lib/ui-classes";
import Link from "next/link";

type ChartMode = "coverage" | "budget-vs-committed";
type TabMode = "periods" | "forecast" | "scenarios";

export default function BudgetPage() {
  const { orgId } = useOrgContext();
  const { commodityId } = useCommodityContext();
  const { user } = useAuth();
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(orgId);
  const [filterSite, setFilterSite] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("coverage");
  const [activeTab, setActiveTab] = useState<TabMode>("periods");

  // Inline new budget form state
  const [showNewBudget, setShowNewBudget] = useState(false);
  const [newSite, setNewSite] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  const filters = {
    commodityId: commodityId ?? undefined,
    siteId: filterSite ?? undefined,
    budgetYear: filterYear ?? undefined,
  };
  const { data: periods, loading, refetch } = useBudgetPeriods(orgId, filters);
  const { data: coverage } = useCoverage(orgId, commodityId ?? undefined, filterSite ?? undefined);
  const { createPeriod } = useBudgetStore();

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const selectedCommodity = useMemo((): Commodity | null => {
    return commodities?.find((c) => c.id === commodityId) ?? null;
  }, [commodities, commodityId]);

  // Create period + open fiscal year grid inline
  const handleCreatePeriod = async () => {
    if (!newSite || !commodityId) return;
    setCreating(true);
    try {
      const period = await createPeriod({
        orgId,
        userId: user!.id,
        siteId: newSite,
        commodityId,
        budgetYear: newYear,
      });
      // After creating, the grid will be shown inline for this period
      setCreating(false);
      setShowNewBudget(false);
      refetch();
      // Redirect to the period detail page with the grid
      window.location.href = `/budget/${period.id}`;
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Budget & Forecast</h1>
          <p className="mt-0.5 text-xs text-faint">Manage budget periods, track coverage, and run scenarios</p>
        </div>
        <button
          onClick={() => setShowNewBudget(!showNewBudget)}
          className={btnPrimary}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Budget
        </button>
      </div>

      {/* Inline New Budget Form */}
      {showNewBudget && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4 space-y-4">
          <h3 className="text-sm font-medium text-secondary">Create Budget Period</h3>
          <div className="grid grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Site</span>
              <select
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                className="w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
              >
                <option value="">Select site...</option>
                {sites?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Commodity</span>
              <input
                type="text"
                value={selectedCommodity?.name ?? "Select from sidebar"}
                disabled
                className="w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none opacity-50"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Budget Year</span>
              <select
                value={newYear}
                onChange={(e) => setNewYear(Number(e.target.value))}
                className="w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowNewBudget(false)}
              className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePeriod}
              disabled={creating || !newSite || !commodityId}
              className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create & Open Grid"}
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {coverage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Budget"
            value={`${coverage.totalBudgeted.toLocaleString()} MT`}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
          />
          <KPICard
            label="Committed"
            value={`${coverage.totalCommitted.toLocaleString()} MT`}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <KPICard
            label="Hedged"
            value={`${coverage.totalHedged.toLocaleString()} MT`}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>}
          />
          <KPICard
            label="Coverage"
            value={`${coverage.overallCoveragePct}%`}
            trend={coverage.overallCoveragePct >= 80 ? "up" : coverage.overallCoveragePct >= 50 ? "neutral" : "down"}
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
          />
        </div>
      )}

      {/* Chart toggle + chart */}
      {coverage && coverage.byMonth.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setChartMode("coverage")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                chartMode === "coverage" ? "bg-action-10 text-secondary" : "text-muted hover:text-secondary"
              }`}
            >
              Coverage Stack
            </button>
            <button
              onClick={() => setChartMode("budget-vs-committed")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                chartMode === "budget-vs-committed" ? "bg-action-10 text-secondary" : "text-muted hover:text-secondary"
              }`}
            >
              Budget vs Committed
            </button>
          </div>
          {chartMode === "coverage" ? (
            <CoverageChart data={coverage.byMonth} />
          ) : (
            <BudgetVsCommittedChart data={coverage.byMonth} />
          )}
        </div>
      )}

      {/* Tabs: Periods | Forecast | Scenarios */}
      <TabGroup
        tabs={[
          { key: "periods", label: "Periods" },
          { key: "forecast", label: "Forecast" },
          { key: "scenarios", label: "Scenarios" },
        ]}
        active={activeTab}
        onChange={(key) => setActiveTab(key as TabMode)}
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterSite ?? ""}
          onChange={(e) => setFilterSite(e.target.value || null)}
          className={selectCls + " w-auto"}
        >
          <option value="">All Sites</option>
          {sites?.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterYear ?? ""}
          onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : null)}
          className={selectCls + " w-auto"}
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Tab Content */}
      {activeTab === "periods" && (
        <>
          {loading ? (
            <SkeletonTable rows={4} />
          ) : periods.length === 0 ? (
            <EmptyState
              title="No budget periods found"
              description="Create a new budget period to get started."
              actionLabel="New Budget"
              onAction={() => setShowNewBudget(true)}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-b-default bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-tbl-border bg-tbl-header">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Site</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Commodity</th>
                    <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted">Year</th>
                    <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted">Notes</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b border-tbl-border hover:bg-row-hover transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/budget/${p.id}`} className="text-secondary hover:text-primary transition-colors">
                          {p.site_name ?? p.site_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.commodity_name ?? "—"}</td>
                      <td className="px-4 py-3 text-center text-secondary tabular-nums">{p.budget_year}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={p.locked_at ? "locked" : p.status} />
                      </td>
                      <td className="px-4 py-3 text-faint text-xs truncate max-w-[200px]">{p.notes ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-faint text-xs tabular-nums">{new Date(p.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "forecast" && (
        <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
          <p className="text-faint">Select a budget period to view its forecast tab.</p>
          <p className="text-xs text-ph mt-1">Click on any period above to access forecast details.</p>
        </div>
      )}

      {activeTab === "scenarios" && (
        <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
          <p className="text-faint">Scenario analysis is available from the forecast page.</p>
          <Link href="/forecast" className="text-xs text-action hover:text-action-hover mt-1 inline-block">
            Open Scenario Manager
          </Link>
        </div>
      )}
    </div>
  );
}
