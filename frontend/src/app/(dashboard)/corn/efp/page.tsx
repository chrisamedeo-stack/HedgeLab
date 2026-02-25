"use client";

import { useState } from "react";
import { useCallback } from "react";
import { useEFPs, useHedges, useContracts, EFPTicketResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { ArrowLeftRight, Plus, X, Trash2 } from "lucide-react";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { EfpStatusBadge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportButton } from "@/components/ui/ExportButton";
import { toCsv, downloadCsv } from "@/lib/csv-export";

const BUSHELS_PER_LOT = 5000;

export default function EFPPage() {
  const { efps, isLoading, mutate } = useEFPs();
  const { hedges } = useHedges();
  const { contracts } = useContracts();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; ref: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    hedgeTradeId: "",
    physicalContractId: "",
    lots: "",
    boardPrice: "",
    basisValue: "",
    efpDate: new Date().toISOString().slice(0, 10),
    confirmationRef: "",
    notes: "",
  });

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const { [k]: _, ...rest } = e; return rest; });
  }

  const lots = parseInt(form.lots) || 0;
  const quantityBu = lots * BUSHELS_PER_LOT;

  // Get selected hedge details for display
  const selectedHedge = hedges.find((h) => h.id === parseInt(form.hedgeTradeId));
  const openLotsOnHedge = selectedHedge?.openLots ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.hedgeTradeId) errs.hedgeTradeId = "Hedge trade is required";
    if (!form.physicalContractId) errs.physicalContractId = "Contract is required";
    if (!form.lots || parseInt(form.lots) <= 0) errs.lots = "Lots required";
    if (!form.boardPrice) errs.boardPrice = "Board price is required";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/efp", {
        hedgeTradeId: parseInt(form.hedgeTradeId),
        physicalContractId: parseInt(form.physicalContractId),
        lots: parseInt(form.lots),
        boardPrice: parseFloat(form.boardPrice) * 100,
        basisValue: form.basisValue ? parseFloat(form.basisValue) * 100 : null,
        efpDate: form.efpDate,
        confirmationRef: form.confirmationRef || null,
        notes: form.notes || null,
      });
      toast("EFP ticket created", "success");
      setShowForm(false);
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "EFP creation failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/corn/efp/${deleteTarget.id}`);
      toast("EFP ticket deleted", "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Delete failed", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  type EfpSortKey = "ticketRef" | "hedgeTradeRef" | "contractRef" | "lots" | "boardPrice" | "efpDate" | "status";
  const efpAccessor = useCallback((e: EFPTicketResponse, key: EfpSortKey) => {
    switch (key) {
      case "ticketRef": return e.ticketRef;
      case "hedgeTradeRef": return e.hedgeTradeRef;
      case "contractRef": return e.contractRef;
      case "lots": return e.lots;
      case "boardPrice": return e.boardPrice;
      case "efpDate": return e.efpDate;
      case "status": return e.status;
      default: return null;
    }
  }, []);
  const { sorted: sortedEfps, sort: efpSort, toggleSort: toggleEfpSort } = useTableSort<EFPTicketResponse, EfpSortKey>(efps, "efpDate", efpAccessor, "desc");

  const openHedges = hedges.filter((h) => (h.openLots ?? 0) > 0);
  const openContracts = contracts.filter((c) => c.status === "OPEN" || c.status === "PARTIALLY_DELIVERED");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">EFP Tickets</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Exchange for Physical — convert futures to fixed-price physical
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={() => {
              const headers = ["Ticket", "Hedge Ref", "Contract Ref", "Lots", "Board Price ($/bu)", "Date"];
              const rows = efps.map((e) => [
                e.ticketRef, e.hedgeTradeRef, e.contractRef,
                e.lots, e.boardPrice != null ? (e.boardPrice / 100).toFixed(4) : "", e.efpDate,
              ]);
              downloadCsv("efp-tickets.csv", toCsv(headers, rows));
            }}
            disabled={efps.length === 0}
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "New EFP"}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 animate-fade-in"
        >
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">New EFP Ticket</h2>
          </div>
          <p className="text-xs text-slate-500">
            An EFP exchanges open CBOT lots for physical delivery, locking the board price
            against a physical contract.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <FormField label="Hedge Trade" error={errors.hedgeTradeId}>
              <select
                className={cn("w-full bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1", errors.hedgeTradeId ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-blue-500")}
                value={form.hedgeTradeId}
                onChange={(e) => field("hedgeTradeId", e.target.value)}
                required
              >
                <option value="">— select —</option>
                {openHedges.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.tradeRef} ({h.futuresMonth}, {h.openLots} open lots)
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Physical Contract" error={errors.physicalContractId}>
              <select
                className={cn("w-full bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1", errors.physicalContractId ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-blue-500")}
                value={form.physicalContractId}
                onChange={(e) => field("physicalContractId", e.target.value)}
                required
              >
                <option value="">— select —</option>
                {openContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractRef} ({c.siteCode}, {formatNumber(c.quantityBu ?? 0)} bu)
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label={`Lots${openLotsOnHedge > 0 ? ` (max ${openLotsOnHedge})` : ""}`} error={errors.lots}>
              <input
                type="number"
                min="1"
                max={openLotsOnHedge || undefined}
                className={cn("w-full bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 placeholder:text-slate-500", errors.lots ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-blue-500")}
                placeholder="e.g. 20"
                value={form.lots}
                onChange={(e) => field("lots", e.target.value)}
                required
              />
            </FormField>

            <FormField label="Board Price ($/bu)" error={errors.boardPrice}>
              <input
                type="number"
                step="0.0025"
                className={cn("w-full bg-slate-800 border text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 placeholder:text-slate-500", errors.boardPrice ? "border-red-500 focus:ring-red-500" : "border-slate-700 focus:ring-blue-500")}
                placeholder="e.g. 4.41"
                value={form.boardPrice}
                onChange={(e) => field("boardPrice", e.target.value)}
                required
              />
            </FormField>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Basis Override ($/bu)</label>
              <input
                type="number"
                step="0.0025"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="Leave blank to use contract basis"
                value={form.basisValue}
                onChange={(e) => field("basisValue", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">EFP Date</label>
              <input
                type="date"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.efpDate}
                onChange={(e) => field("efpDate", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Confirmation Ref</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. SX-EFP-2025-001"
                value={form.confirmationRef}
                onChange={(e) => field("confirmationRef", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Notes</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          {lots > 0 && (
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <p className="text-xs text-slate-500 mb-2">EFP Preview</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Lots</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{lots}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bushels</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(quantityBu)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? "Submitting…" : "Create EFP"}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} cols={8} />
        ) : efps.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No EFP tickets"
            description="Execute an EFP to convert open futures lots into fixed-price physical corn."
            action={{ label: "New EFP", onClick: () => setShowForm(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <SortableHeader label="Ticket" sortKey="ticketRef" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <SortableHeader label="Hedge" sortKey="hedgeTradeRef" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <SortableHeader label="Contract" sortKey="contractRef" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Site</th>
                <SortableHeader label="Lots" sortKey="lots" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <SortableHeader label="Board ($/bu)" sortKey="boardPrice" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Qty (bu)</th>
                <SortableHeader label="Date" sortKey="efpDate" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <SortableHeader label="Status" sortKey="status" activeKey={efpSort.key} activeDir={efpSort.dir} onToggle={(k) => toggleEfpSort(k as EfpSortKey)} />
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedEfps.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{e.ticketRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.hedgeTradeRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.contractRef}</td>
                  <td className="px-4 py-3 text-slate-300">{e.siteName}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">{e.lots}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">{e.boardPrice != null ? (e.boardPrice / 100).toFixed(4) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-400">{formatNumber(e.lots * BUSHELS_PER_LOT)}</td>
                  <td className="px-4 py-3 text-slate-400">{e.efpDate}</td>
                  <td className="px-4 py-3">
                    <EfpStatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget({ id: e.id, ref: e.ticketRef })}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Delete EFP"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete EFP Ticket"
        description={`This will delete ${deleteTarget?.ref ?? "this EFP ticket"} and restore the lots back to the hedge trade. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
