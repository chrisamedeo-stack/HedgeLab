"use client";

import { useState } from "react";
import { useBudgetPeriods, useCoverage } from "@/hooks/useBudget";
import { useCommodities, useSites } from "@/hooks/usePositions";
import { useCommodityContext } from "@/contexts/CommodityContext";
import { useBudgetStore } from "@/store/budgetStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KPICard } from "@/components/ui/KPICard";
import { Modal } from "@/components/ui/Modal";
import { CoverageChart } from "@/components/budget/CoverageChart";
import { BudgetVsCommittedChart } from "@/components/budget/BudgetVsCommittedChart";
import Link from "next/link";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const DEFAULT_USER = "00000000-0000-0000-0000-000000000001";

type ChartMode = "coverage" | "budget-vs-committed";

export default function BudgetPage() {
  const { commodityId } = useCommodityContext();
  const { data: commodities } = useCommodities();
  const { data: sites } = useSites(DEFAULT_ORG);
  const [filterSite, setFilterSite] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("coverage");
  const [showNew, setShowNew] = useState(false);

  const filters = {
    commodityId: commodityId ?? undefined,
    siteId: filterSite ?? undefined,
    budgetYear: filterYear ?? undefined,
  };
  const { data: periods, loading } = useBudgetPeriods(DEFAULT_ORG, filters);
  const { data: coverage } = useCoverage(DEFAULT_ORG, commodityId ?? undefined, filterSite ?? undefined);
  const { createPeriod } = useBudgetStore();

  // New period form state
  const [newSite, setNewSite] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newSite || !commodityId) return;
    setCreating(true);
    try {
      await createPeriod({
        orgId: DEFAULT_ORG,
        userId: DEFAULT_USER,
        siteId: newSite,
        commodityId,
        budgetYear: newYear,
        notes: newNotes || undefined,
      });
      setShowNew(false);
      setNewNotes("");
    } catch {
      // error shown via store
    } finally {
      setCreating(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const inputCls = "w-full border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Budget & Forecast</h1>
          <p className="text-sm text-faint mt-1">Manage budget periods, track coverage, and update forecasts</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Budget
        </button>
      </div>

      {/* KPIs */}
      {coverage && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KPICard label="Total Budget" value={`${coverage.totalBudgeted.toLocaleString()} MT`} />
          <KPICard label="Committed" value={`${coverage.totalCommitted.toLocaleString()} MT`} />
          <KPICard label="Hedged" value={`${coverage.totalHedged.toLocaleString()} MT`} />
          <KPICard
            label="Coverage"
            value={`${coverage.overallCoveragePct}%`}
            trend={coverage.overallCoveragePct >= 80 ? "up" : coverage.overallCoveragePct >= 50 ? "neutral" : "down"}
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

      {/* Filters */}
      <div className="flex items-center gap-3">
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
        <select
          value={filterYear ?? ""}
          onChange={(e) => setFilterYear(e.target.value ? Number(e.target.value) : null)}
          className="border border-b-input bg-input-bg rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Period list */}
      {loading ? (
        <div className="text-center py-12 text-faint">Loading budget periods...</div>
      ) : periods.length === 0 ? (
        <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
          <p className="text-faint">No budget periods found.</p>
          <p className="text-xs text-ph mt-1">Create a new budget period to get started.</p>
        </div>
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
                  <td className="px-4 py-2">
                    <Link href={`/budget/${p.id}`} className="text-secondary hover:text-primary transition-colors">
                      {p.site_name ?? p.site_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{p.commodity_name ?? "—"}</td>
                  <td className="px-4 py-2 text-center text-secondary tabular-nums">{p.budget_year}</td>
                  <td className="px-4 py-2 text-center">
                    <StatusBadge status={p.locked_at ? "locked" : p.status} />
                  </td>
                  <td className="px-4 py-2 text-faint text-xs truncate max-w-[200px]">{p.notes ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-faint text-xs">{new Date(p.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Budget Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Budget Period">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Site</label>
            <select value={newSite} onChange={(e) => setNewSite(e.target.value)} className={inputCls}>
              <option value="">Select site...</option>
              {sites?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Commodity</label>
            <input
              type="text"
              value={commodities?.find((c) => c.id === commodityId)?.name ?? "Select from sidebar"}
              disabled
              className={`${inputCls} opacity-50`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Budget Year</label>
            <select value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} className={inputCls}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Notes</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className={`${inputCls} h-16 resize-none`}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-faint hover:text-secondary transition-colors">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={creating || !newSite || !commodityId}
              className="px-4 py-2 text-sm font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Period"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
