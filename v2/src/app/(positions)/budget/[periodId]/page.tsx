"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useBudgetPeriod, useBudgetVersions } from "@/hooks/useBudget";
import { useCommodities } from "@/hooks/usePositions";
import { useBudgetStore } from "@/store/budgetStore";
import { LineItemTable } from "@/components/budget/LineItemTable";
import { ForecastTab } from "@/components/budget/ForecastTab";
import { ForecastUpdateGrid } from "@/components/budget/ForecastUpdateGrid";
import { FiscalYearGrid } from "@/components/budget/FiscalYearGrid";
import { BudgetLineForm } from "@/components/budget/BudgetLineForm";
import { CoverageChart } from "@/components/budget/CoverageChart";
import { BudgetVsCommittedChart } from "@/components/budget/BudgetVsCommittedChart";
import { ApprovalBar } from "@/components/budget/ApprovalBar";
import { VersionPanel } from "@/components/budget/VersionPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabGroup } from "@/components/ui/TabGroup";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/contexts/AuthContext";
import { btnPrimary, btnSecondary } from "@/lib/ui-classes";
import Link from "next/link";
import type { BudgetLineItem, CoverageDataPoint } from "@/types/budget";
import { formatPriceWithUnit } from "@/lib/commodity-units";

type Tab = "budget" | "forecast" | "coverage" | "versions";
type FormMode = "none" | "add-month" | "edit-month" | "fy-grid" | "forecast-grid";

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDollars(n: number): string {
  if (n === 0) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetDetailPage() {
  const params = useParams();
  const periodId = params.periodId as string;
  const { data: period, loading } = useBudgetPeriod(periodId);
  const { data: versions } = useBudgetVersions(periodId);
  const { data: commodities } = useCommodities();
  const { deleteLineItem } = useBudgetStore();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("budget");
  const [formMode, setFormMode] = useState<FormMode>("none");
  const [editItem, setEditItem] = useState<BudgetLineItem | null>(null);

  if (loading || !period) {
    return (
      <div className="flex items-center justify-center py-12">
        {loading ? <Spinner /> : <span className="text-faint">Period not found</span>}
      </div>
    );
  }

  const items = period.line_items ?? [];
  const isLocked = !!period.locked_at;
  const commodity = commodities?.find((c) => c.id === period.commodity_id) ?? null;

  // Build coverage data from line items
  const coverageData: CoverageDataPoint[] = items.map((li) => ({
    month: li.budget_month,
    budgeted: Number(li.budgeted_volume),
    committed: Number(li.committed_volume),
    hedged: Number(li.hedged_volume),
    open: Number(li.open_volume),
    coveragePct: Number(li.coverage_pct),
  }));

  // Compute KPIs
  let totalBudgetVol = 0;
  let totalNotional = 0;
  let weightedAllIn = 0;
  let forecastVol = 0;
  let overHedgedCount = 0;
  items.forEach((li) => {
    const bv = Number(li.budgeted_volume);
    totalBudgetVol += bv;
    totalNotional += Number(li.total_notional ?? 0);
    const allIn = li.target_all_in_price != null ? Number(li.target_all_in_price) : 0;
    weightedAllIn += bv * allIn;
    forecastVol += li.forecast_volume != null ? Number(li.forecast_volume) : bv;
    if (li.over_hedged) overHedgedCount++;
  });
  const kpis = {
    avgAllInPrice: totalBudgetVol > 0 ? weightedAllIn / totalBudgetVol : 0,
    totalNotional,
    forecastVol,
    overHedgedCount,
  };

  const closeForm = () => {
    setFormMode("none");
    setEditItem(null);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "budget", label: "Budget" },
    { key: "forecast", label: "Forecast" },
    { key: "coverage", label: "Coverage" },
    { key: "versions", label: `Versions (${versions.length})` },
  ];

  return (
    <div className="space-y-6 page-fade">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/budget" className="text-xs text-muted hover:text-secondary transition-colors">
          Budget & Forecast
        </Link>
        <span className="text-xs text-ph mx-1">/</span>
        <span className="text-xs text-faint">
          {period.site_name} &middot; {period.commodity_name} &middot; {period.budget_year}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Budget Period</h1>
          <p className="mt-0.5 text-lg font-semibold text-primary">
            {period.site_name} · {period.budget_year}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-faint">{period.commodity_name}</span>
            <StatusBadge status={isLocked ? "locked" : period.status} />
          </div>
        </div>
        {!isLocked && tab === "budget" && formMode === "none" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFormMode("add-month")}
              className={btnSecondary + " text-xs"}
            >
              + Add Month
            </button>
            <button
              onClick={() => setFormMode("fy-grid")}
              className={btnPrimary + " text-xs"}
            >
              Fiscal Year Grid
            </button>
          </div>
        )}
        {!isLocked && tab === "forecast" && formMode === "none" && (
          <button
            onClick={() => setFormMode("forecast-grid")}
            className={btnPrimary + " text-xs"}
          >
            Bulk Update Forecasts
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Avg All-in Price</div>
          <div className="text-lg font-semibold text-primary tabular-nums">
            {kpis.avgAllInPrice > 0 ? formatPriceWithUnit(kpis.avgAllInPrice, commodity) : "—"}
          </div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Total Notional</div>
          <div className="text-lg font-semibold text-primary tabular-nums">
            {fmtDollars(kpis.totalNotional)}
          </div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Forecast Volume</div>
          <div className="text-lg font-semibold text-primary tabular-nums">{fmt(kpis.forecastVol)}</div>
        </div>
        <div className="rounded-lg border border-b-default bg-surface p-3">
          <div className="text-xs text-muted">Over-hedged</div>
          <div className={`text-lg font-semibold tabular-nums ${kpis.overHedgedCount > 0 ? "text-warning" : "text-muted"}`}>
            {kpis.overHedgedCount}
          </div>
        </div>
      </div>

      {/* Approval Bar */}
      <ApprovalBar period={period} userId={user!.id} />

      {/* Inline form area — replaces all modals */}
      {formMode === "add-month" && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Add Budget Month</h3>
          <BudgetLineForm periodId={periodId} userId={user!.id} onClose={closeForm} commodity={commodity} commodityId={period.commodity_id} />
        </div>
      )}

      {formMode === "edit-month" && editItem && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Edit Budget Month</h3>
          <BudgetLineForm
            periodId={periodId}
            userId={user!.id}
            onClose={closeForm}
            commodity={commodity}
            commodityId={period.commodity_id}
            existing={{
              budgetMonth: editItem.budget_month,
              budgetedVolume: Number(editItem.budgeted_volume),
              budgetPrice: editItem.budget_price ? Number(editItem.budget_price) : null,
              forecastVolume: editItem.forecast_volume ? Number(editItem.forecast_volume) : null,
              forecastPrice: editItem.forecast_price ? Number(editItem.forecast_price) : null,
              futuresMonth: editItem.futures_month,
              components: editItem.components ?? [],
              notes: editItem.notes,
            }}
          />
        </div>
      )}

      {formMode === "fy-grid" && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Fiscal Year Grid</h3>
          <FiscalYearGrid
            periodId={periodId}
            budgetYear={period.budget_year}
            userId={user!.id}
            onDone={closeForm}
            commodity={commodity}
          />
        </div>
      )}

      {formMode === "forecast-grid" && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Update Forecasts</h3>
          <ForecastUpdateGrid
            periodId={periodId}
            items={items}
            userId={user!.id}
            onDone={closeForm}
          />
        </div>
      )}

      {/* Tabs */}
      <TabGroup
        tabs={tabs}
        active={tab}
        onChange={(key) => { setTab(key as Tab); closeForm(); }}
      />

      {/* Tab Content */}
      {tab === "budget" && (
        <LineItemTable
          items={items}
          locked={isLocked}
          onEdit={!isLocked ? (li) => { setEditItem(li); setFormMode("edit-month"); } : undefined}
          onDelete={!isLocked ? (id) => {
            if (confirm("Delete this line item?")) {
              deleteLineItem(periodId, id, user!.id);
            }
          } : undefined}
        />
      )}

      {tab === "forecast" && (
        <ForecastTab periodId={periodId} items={items} userId={user!.id} locked={isLocked} />
      )}

      {tab === "coverage" && (
        <div className="space-y-6">
          <CoverageChart data={coverageData} height={400} />
          <BudgetVsCommittedChart data={coverageData} lineItems={items} height={320} />
        </div>
      )}

      {tab === "versions" && (
        <VersionPanel periodId={periodId} versions={versions} userId={user!.id} locked={isLocked} />
      )}
    </div>
  );
}
