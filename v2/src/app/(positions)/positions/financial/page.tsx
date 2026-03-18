"use client";

import { useState, useCallback, useEffect } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePmTradeStore } from "@/store/pmTradeStore";
import { NewFinancialPositionForm } from "@/components/positions/NewFinancialPositionForm";
import { BulkActionDialog } from "@/components/positions/BulkActionDialog";
import { PositionDetailPanel } from "@/components/positions/PositionDetailPanel";
import { OrgBreadcrumb } from "@/components/positions/OrgBreadcrumb";
import { PortfolioSelector } from "@/components/positions/PortfolioSelector";
import { PositionToggle } from "@/components/positions/PositionToggle";
import { PositionFilters } from "@/components/positions/PositionFilters";
import { PositionBulkActionMenu } from "@/components/positions/PositionBulkActionMenu";
import { FinancialPositionsTable } from "@/components/positions/FinancialPositionsTable";
import type { PmTradeFilters, PmTrade } from "@/types/pm";

export default function FinancialPositionsPage() {
  const { orgId } = useOrgContext();
  const { user } = useAuth();
  const { activeNodeId } = useOrgScope();
  const { trades, total, loading, fetchTrades } = usePmTradeStore();

  const [filters, setFilters] = useState<PmTradeFilters>({ category: "financial" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<string | null>(null);
  const [detailTrade, setDetailTrade] = useState<PmTrade | null>(null);

  const effectiveFilters: PmTradeFilters = {
    ...filters,
    category: "financial",
    orgNodeId: activeNodeId ?? undefined,
    portfolioId: portfolioId ?? undefined,
  };

  useEffect(() => {
    if (orgId) fetchTrades(orgId, effectiveFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(effectiveFilters), fetchTrades]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, activeNodeId, portfolioId]);

  const refetch = useCallback(() => {
    fetchTrades(orgId, effectiveFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, JSON.stringify(effectiveFilters), fetchTrades]);

  const handleScopeAwareFilters = useCallback((newFilters: PmTradeFilters) => {
    setFilters({ ...newFilters, category: "financial" });
  }, []);

  const handleAction = useCallback((action: string, trade: PmTrade) => {
    if (action === "View Details") {
      setDetailTrade(trade);
      return;
    }
    // Map context menu actions to bulk action types for single-row actions
    const actionMap: Record<string, string> = {
      "Define Site": "define-site",
      "Define Budget Month": "define-budget-month",
    };
    const mapped = actionMap[action];
    if (mapped) {
      setSelectedIds(new Set([trade.id]));
      setBulkActionType(mapped);
    }
  }, []);

  const handleBulkAction = useCallback(
    (action: string) => {
      if (selectedIds.size === 0) return;
      setBulkActionType(action);
    },
    [selectedIds]
  );

  return (
    <div className="space-y-4 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Positions</h1>
          <p className="mt-0.5 text-xs text-faint">
            {total} financial position{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PositionBulkActionMenu
            category="financial"
            selectedCount={selectedIds.size}
            onAction={handleBulkAction}
          />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action-hover transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Position
          </button>
        </div>
      </div>

      {/* Breadcrumb + Portfolio + Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <OrgBreadcrumb />
          <PortfolioSelector value={portfolioId} onChange={setPortfolioId} />
        </div>
        <PositionToggle />
      </div>

      {/* New Position Form */}
      {showForm && (
        <NewFinancialPositionForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); refetch(); }}
        />
      )}

      {/* Bulk Action Dialog */}
      {bulkActionType && (
        <BulkActionDialog
          action={bulkActionType}
          selectedIds={Array.from(selectedIds)}
          onClose={() => setBulkActionType(null)}
          onSuccess={() => { setBulkActionType(null); setSelectedIds(new Set()); refetch(); }}
        />
      )}

      {/* Filters */}
      <PositionFilters tab="financial" filters={filters} onChange={handleScopeAwareFilters} />

      {/* Table */}
      <FinancialPositionsTable
        trades={trades}
        loading={loading}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onAction={handleAction}
      />

      {/* Pagination */}
      {total > 100 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Showing {Math.min(trades.length, 100)} of {total}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
              disabled={!filters.page || filters.page <= 1}
              className="px-2 py-1 rounded border border-b-input text-secondary hover:bg-hover disabled:opacity-30"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              disabled={trades.length < 100}
              className="px-2 py-1 rounded border border-b-input text-secondary hover:bg-hover disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {detailTrade && (
        <PositionDetailPanel trade={detailTrade} onClose={() => setDetailTrade(null)} />
      )}
    </div>
  );
}
