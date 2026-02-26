"use client";

import { useState, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  Plus,
  X,
  TrendingUp,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  usePositions,
  useSites,
  useHedgesByBook,
  HedgeTradeResponse,
} from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportButton } from "@/components/ui/ExportButton";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import { cn } from "@/lib/utils";

import type { Book } from "./_components/shared";
import { usePermissions } from "./_components/permissions";
import { SettlePublisher } from "./_components/settle-publisher";
import { BookHedgeForm } from "./_components/book-hedge-form";
import { PortfolioSummary } from "./_components/portfolio-summary";
import { MtmPnlChart } from "./_components/mtm-pnl-chart";
import { DeliveryMonthTable } from "./_components/delivery-month-table";
import { BudgetMonthTable } from "./_components/budget-month-table";

export default function PositionsPage() {
  const { can } = usePermissions();
  const [book, setBook] = useState<Book>("CANADA");
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const { hedges, mutate: hedgesMutate } = useHedgesByBook(book);
  const toast = useToast();

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [settleOpen, setSettleOpen] = useState(false);
  const [hedgeFormOpen, setHedgeFormOpen] = useState(false);
  const [editing, setEditing] = useState<HedgeTradeResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [undoTarget, setUndoTarget] = useState<{ id: number; tradeRef: string } | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const hedgeBook   = positions?.hedgeBook        ?? [];
  const allocations = positions?.siteAllocations   ?? [];
  const monthAllocs = positions?.monthAllocations  ?? [];
  const settles     = positions?.latestSettles     ?? {};
  const siteOptions = sites
    .filter((s) => book === "CANADA" ? s.country === "Canada" : s.country === "US")
    .map((s) => ({ code: s.code, name: s.name }));
  const bookLabel   = book === "CANADA" ? "Canada" : "US";

  const allFuturesMonths = useMemo(() => {
    const months = new Set<string>();
    hedgeBook.forEach((h) => months.add(h.futuresMonth));
    allocations.forEach((a) => months.add(a.futuresMonth));
    return Array.from(months).sort();
  }, [hedgeBook, allocations]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  function handleHedgeFormDone() {
    setHedgeFormOpen(false);
    setEditing(null);
    mutate();
    hedgesMutate();
  }

  function handleEdit(tradeId: number) {
    const trade = hedges.find((h) => h.id === tradeId);
    if (trade) { setEditing(trade); setHedgeFormOpen(true); }
  }

  async function handleDeleteConfirm() {
    if (deleteTarget === null) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/v1/corn/hedges/${deleteTarget}`);
      toast.toast("Hedge trade deleted", "success");
      mutate();
      hedgesMutate();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Delete failed", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  }

  async function handleUndoConfirm() {
    if (!undoTarget) return;
    setUndoLoading(true);
    try {
      await api.delete(`/api/v1/corn/hedges/allocations/${undoTarget.id}`);
      toast.toast("Allocation removed", "success");
      mutate();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to remove allocation", "error");
    } finally {
      setUndoLoading(false);
      setUndoTarget(null);
    }
  }

  function handleUndoAllocation(allocationId: number, tradeRef: string) {
    setUndoTarget({ id: allocationId, tradeRef });
  }

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Position Manager</h1>
        <SkeletonTable rows={3} cols={8} />
        <SkeletonTable rows={4} cols={8} />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={AlertCircle} title="Failed to load positions" description={error.message} />;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-action" />
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Position Manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={() => {
              const headers = ["Ref", "Side", "Futures Month", "Lots", "Open Lots", "Price ($/bu)", "MTM P&L", "Status"];
              const rows = hedgeBook.map((h) => [
                h.tradeRef, h.side, h.futuresMonth, h.lots, h.openLots,
                h.entryPrice != null ? h.entryPrice.toFixed(4) : "",
                h.mtmPnlUsd != null ? h.mtmPnlUsd.toFixed(2) : "",
                h.status,
              ]);
              downloadCsv("positions.csv", toCsv(headers, rows));
            }}
            disabled={hedgeBook.length === 0}
          />
          {can("book-hedge") && (
            <button
              onClick={() => { setEditing(null); setHedgeFormOpen((o) => !o); }}
              className="flex items-center gap-2 px-4 py-2 bg-action hover:bg-action-hover text-white text-sm rounded-lg font-medium transition-colors"
            >
              {hedgeFormOpen && !editing ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {hedgeFormOpen && !editing ? "Cancel" : "Book Hedge"}
            </button>
          )}
          {can("publish-settle") && (
            <button
              onClick={() => setSettleOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-input-bg hover:bg-hover text-secondary text-sm rounded-lg font-medium border border-b-input transition-colors"
            >
              <TrendingUp className="h-4 w-4 text-action" />
              Publish Settle Prices
              {settleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Book Hedge form */}
      {hedgeFormOpen && (
        <div className="animate-fade-in">
          <BookHedgeForm
            book={book}
            editing={editing}
            onDone={handleHedgeFormDone}
            onCancel={() => { setHedgeFormOpen(false); setEditing(null); }}
          />
        </div>
      )}

      {/* Settle publisher */}
      {settleOpen && (
        <SettlePublisher
          futuresMonths={allFuturesMonths.length > 0 ? allFuturesMonths : ["ZCH26", "ZCK26", "ZCN26"]}
          existingSettles={settles}
          onDone={() => { setSettleOpen(false); mutate(); }}
        />
      )}

      {/* Book toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => setBook(b)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                book === b ? "bg-action text-white shadow" : "text-muted hover:text-secondary"
              )}
            >
              {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio MTM Summary */}
      <PortfolioSummary
        hedgeBook={hedgeBook}
        bookLabel={bookLabel}
        siteAllocations={allocations}
        unassignedBu={monthAllocs.reduce((s, a) => s + a.allocatedBushels, 0)}
      />

      {/* MTM P&L Chart */}
      <MtmPnlChart hedgeBook={hedgeBook} />

      {/* ═══════════════ DELIVERY MONTH SECTION ═══════════════ */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-secondary">
              Delivery Month &middot; {bookLabel}
            </h2>
            <p className="text-xs text-faint mt-0.5">
              Unallocated trades &middot; grouped by futures month
            </p>
          </div>
          <span className="text-xs text-ph">Click to expand</span>
        </div>
        <DeliveryMonthTable
          hedgeBook={hedgeBook.filter((h) => h.unallocatedLots > 0)}
          sites={siteOptions}
          can={can}
          onRefresh={() => mutate()}
          onEdit={handleEdit}
          onDelete={(id) => setDeleteTarget(id)}
        />
      </div>

      {/* ═══════════════ BUDGET MONTH SECTION ═══════════════ */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">
            Budget Month &middot; {bookLabel}
          </h2>
          <p className="text-xs text-faint mt-0.5">
            Hedge allocations grouped by budget month
          </p>
        </div>
        <BudgetMonthTable
          monthAllocations={monthAllocs}
          siteAllocations={allocations}
          sites={siteOptions}
          can={can}
          onRefresh={() => mutate()}
          onUndoAllocation={handleUndoAllocation}
        />
      </div>

      {/* Delete Hedge Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Hedge Trade"
        description="This will permanently delete this hedge trade and all its allocations. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      {/* Undo Allocation Confirm */}
      <ConfirmDialog
        open={undoTarget !== null}
        title="Remove Allocation"
        description={undoTarget ? `Remove allocation from ${undoTarget.tradeRef}? The lots will return to unallocated.` : ""}
        confirmLabel="Remove"
        variant="warning"
        onConfirm={handleUndoConfirm}
        onCancel={() => setUndoTarget(null)}
        loading={undoLoading}
      />
    </div>
  );
}
