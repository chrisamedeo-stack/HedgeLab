"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useBudgetPeriod, useBudgetVersions } from "@/hooks/useBudget";
import { useBudgetStore } from "@/store/budgetStore";
import { Modal } from "@/components/ui/Modal";
import { LineItemTable } from "@/components/budget/LineItemTable";
import { ForecastTab } from "@/components/budget/ForecastTab";
import { ForecastUpdateGrid } from "@/components/budget/ForecastUpdateGrid";
import { FiscalYearGrid } from "@/components/budget/FiscalYearGrid";
import { BudgetLineForm } from "@/components/budget/BudgetLineForm";
import { CoverageChart } from "@/components/budget/CoverageChart";
import { ApprovalBar } from "@/components/budget/ApprovalBar";
import { VersionPanel } from "@/components/budget/VersionPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import type { BudgetLineItem, CoverageDataPoint } from "@/types/budget";

const DEFAULT_USER = "00000000-0000-0000-0000-000000000001";

type Tab = "budget" | "forecast" | "coverage" | "versions";

export default function BudgetDetailPage() {
  const params = useParams();
  const periodId = params.periodId as string;
  const { data: period, loading } = useBudgetPeriod(periodId);
  const { data: versions } = useBudgetVersions(periodId);
  const { deleteLineItem } = useBudgetStore();

  const [tab, setTab] = useState<Tab>("budget");
  const [showAddMonth, setShowAddMonth] = useState(false);
  const [showFYGrid, setShowFYGrid] = useState(false);
  const [showForecastGrid, setShowForecastGrid] = useState(false);
  const [editItem, setEditItem] = useState<BudgetLineItem | null>(null);

  if (loading || !period) {
    return <div className="text-center py-12 text-faint">{loading ? "Loading..." : "Period not found"}</div>;
  }

  const items = period.line_items ?? [];
  const isLocked = !!period.locked_at;

  // Build coverage data from line items
  const coverageData: CoverageDataPoint[] = items.map((li) => ({
    month: li.budget_month,
    budgeted: Number(li.budgeted_volume),
    committed: Number(li.committed_volume),
    hedged: Number(li.hedged_volume),
    open: Number(li.open_volume),
    coveragePct: Number(li.coverage_pct),
  }));

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
          {period.site_name} — {period.commodity_name} — {period.budget_year}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">
            {period.site_name} · {period.budget_year}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted">{period.commodity_name}</span>
            <StatusBadge status={isLocked ? "locked" : period.status} />
          </div>
        </div>
        {!isLocked && tab === "budget" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddMonth(true)}
              className="px-3 py-1.5 text-xs text-muted border border-b-input rounded-lg hover:bg-hover hover:text-secondary transition-colors"
            >
              + Add Month
            </button>
            <button
              onClick={() => setShowFYGrid(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors"
            >
              Fiscal Year Grid
            </button>
          </div>
        )}
        {!isLocked && tab === "forecast" && (
          <button
            onClick={() => setShowForecastGrid(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-action rounded-lg hover:bg-action-hover transition-colors"
          >
            Bulk Update Forecasts
          </button>
        )}
      </div>

      {/* Approval Bar */}
      <ApprovalBar period={period} userId={DEFAULT_USER} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-b-default">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-action text-secondary"
                : "border-transparent text-muted hover:text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "budget" && (
        <LineItemTable
          items={items}
          locked={isLocked}
          onEdit={!isLocked ? (li) => setEditItem(li) : undefined}
          onDelete={!isLocked ? (id) => {
            if (confirm("Delete this line item?")) {
              deleteLineItem(periodId, id, DEFAULT_USER);
            }
          } : undefined}
        />
      )}

      {tab === "forecast" && (
        <ForecastTab periodId={periodId} items={items} userId={DEFAULT_USER} locked={isLocked} />
      )}

      {tab === "coverage" && (
        <CoverageChart data={coverageData} height={400} />
      )}

      {tab === "versions" && (
        <VersionPanel periodId={periodId} versions={versions} userId={DEFAULT_USER} locked={isLocked} />
      )}

      {/* Add Month Modal */}
      <Modal open={showAddMonth} onClose={() => setShowAddMonth(false)} title="Add Budget Month">
        <BudgetLineForm periodId={periodId} userId={DEFAULT_USER} onClose={() => setShowAddMonth(false)} />
      </Modal>

      {/* Edit Item Modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Budget Month">
        {editItem && (
          <BudgetLineForm
            periodId={periodId}
            userId={DEFAULT_USER}
            onClose={() => setEditItem(null)}
            existing={{
              budgetMonth: editItem.budget_month,
              budgetedVolume: Number(editItem.budgeted_volume),
              budgetPrice: editItem.budget_price ? Number(editItem.budget_price) : null,
              forecastVolume: editItem.forecast_volume ? Number(editItem.forecast_volume) : null,
              forecastPrice: editItem.forecast_price ? Number(editItem.forecast_price) : null,
              notes: editItem.notes,
            }}
          />
        )}
      </Modal>

      {/* Fiscal Year Grid Modal */}
      <Modal open={showFYGrid} onClose={() => setShowFYGrid(false)} title="Fiscal Year Grid" width="max-w-3xl">
        <FiscalYearGrid
          periodId={periodId}
          budgetYear={period.budget_year}
          userId={DEFAULT_USER}
          onDone={() => setShowFYGrid(false)}
        />
      </Modal>

      {/* Forecast Update Grid Modal */}
      <Modal open={showForecastGrid} onClose={() => setShowForecastGrid(false)} title="Update Forecasts" width="max-w-3xl">
        <ForecastUpdateGrid
          periodId={periodId}
          items={items}
          userId={DEFAULT_USER}
          onDone={() => setShowForecastGrid(false)}
        />
      </Modal>
    </div>
  );
}
