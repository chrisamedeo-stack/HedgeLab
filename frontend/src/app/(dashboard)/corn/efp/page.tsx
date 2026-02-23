"use client";

import { useState } from "react";
import { useEFPs, useHedges, useContracts } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20",
  CONFIRMED: "text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20",
  CANCELLED: "text-red-400 bg-red-500/10 ring-1 ring-red-500/20",
};

const BUSHELS_PER_LOT = 5000;
const BUSHELS_PER_MT  = 39.3683;

export default function EFPPage() {
  const { efps, isLoading, mutate } = useEFPs();
  const { hedges } = useHedges();
  const { contracts } = useContracts();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  }

  const lots = parseInt(form.lots) || 0;
  const quantityMt = (lots * BUSHELS_PER_LOT) / BUSHELS_PER_MT;

  // Get selected hedge details for display
  const selectedHedge = hedges.find((h) => h.id === parseInt(form.hedgeTradeId));
  const openLotsOnHedge = selectedHedge?.openLots ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New EFP"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
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
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Hedge Trade</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Physical Contract</label>
              <select
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.physicalContractId}
                onChange={(e) => field("physicalContractId", e.target.value)}
                required
              >
                <option value="">— select —</option>
                {openContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractRef} ({c.siteCode}, {formatNumber(Math.round(c.quantityMt))} MT)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">
                Lots {openLotsOnHedge > 0 && (
                  <span className="text-slate-500 ml-1">
                    (max {openLotsOnHedge})
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                max={openLotsOnHedge || undefined}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. 20"
                value={form.lots}
                onChange={(e) => field("lots", e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Board Price ($/bu)</label>
              <input
                type="number"
                step="0.0025"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                placeholder="e.g. 4.41"
                value={form.boardPrice}
                onChange={(e) => field("boardPrice", e.target.value)}
                required
              />
            </div>

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
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Lots</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{lots}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Bushels</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(lots * BUSHELS_PER_LOT)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">MT Equivalent</p>
                  <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatNumber(Math.round(quantityMt))} MT</p>
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
                {["Ticket", "Hedge", "Contract", "Site", "Lots", "Board ($/bu)", "Qty (MT)", "Date", "Status"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {efps.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400">{e.ticketRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.hedgeTradeRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{e.contractRef}</td>
                  <td className="px-4 py-3 text-slate-300">{e.siteName}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">{e.lots}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-200">{e.boardPrice != null ? (e.boardPrice / 100).toFixed(4) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-400">{formatNumber(Math.round(e.quantityMt ?? 0))}</td>
                  <td className="px-4 py-3 text-slate-400">{e.efpDate}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      STATUS_COLORS[e.status] ?? "text-slate-400"
                    )}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
