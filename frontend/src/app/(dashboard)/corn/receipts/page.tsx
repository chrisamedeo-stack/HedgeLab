"use client";

import { useState, useEffect } from "react";
import { useReceipts, useContracts, useSites, ReceiptResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { Package, Plus, X, Edit2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExportButton } from "@/components/ui/ExportButton";
import { toCsv, downloadCsv } from "@/lib/csv-export";

const BUSHELS_PER_MT = 39.3683;

// Shrink calculation: standard 15.5% moisture base
function calcNetMt(grossMt: number, moisturePct: number): number {
  if (!grossMt || !moisturePct) return grossMt;
  const shrink = Math.max(0, moisturePct - 15.5) * 1.183 / 100;
  return grossMt * (1 - shrink);
}

export default function ReceiptsPage() {
  const { sites } = useSites();
  const [siteFilter, setSiteFilter] = useState("");
  const { receipts, isLoading, mutate } = useReceipts(siteFilter || undefined);
  const { contracts } = useContracts();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<ReceiptResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; ref: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const defaultForm = {
    physicalContractId: "",
    siteCode: "",
    receiptDate: new Date().toISOString().slice(0, 10),
    grossMt: "",
    moisturePct: "15.5",
    deliveredCostPerMt: "",
    vehicleRef: "",
    notes: "",
  };

  const [form, setForm] = useState(defaultForm);

  // Set default site code when sites load
  useEffect(() => {
    if (sites.length > 0 && !form.siteCode && !editing) {
      setForm((f) => ({ ...f, siteCode: sites[0].code }));
    }
  }, [sites, form.siteCode, editing]);

  function field(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(r: ReceiptResponse) {
    setEditing(r);
    // Find contract id from contractRef
    const contract = contracts.find((c) => c.contractRef === r.contractRef);
    setForm({
      physicalContractId: contract ? String(contract.id) : "",
      siteCode: r.siteCode,
      receiptDate: r.receiptDate,
      grossMt: r.grossMt != null ? String(r.grossMt) : "",
      moisturePct: r.moisturePct != null ? String(r.moisturePct) : "15.5",
      deliveredCostPerMt: r.deliveredCostPerMt != null ? String(r.deliveredCostPerMt) : "",
      vehicleRef: r.vehicleRef ?? "",
      notes: r.notes ?? "",
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...defaultForm, siteCode: sites.length > 0 ? sites[0].code : "" });
  }

  const gross  = parseFloat(form.grossMt) || 0;
  const moist  = parseFloat(form.moisturePct) || 15.5;
  const netMt  = calcNetMt(gross, moist);
  const shrinkMt = gross - netMt;
  const netBu = netMt * BUSHELS_PER_MT;
  const costPerMt = parseFloat(form.deliveredCostPerMt) || 0;
  const totalCost = netMt * costPerMt;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        physicalContractId: parseInt(form.physicalContractId),
        siteCode: form.siteCode,
        receiptDate: form.receiptDate,
        grossMt: parseFloat(form.grossMt),
        moisturePct: parseFloat(form.moisturePct),
        deliveredCostPerMt: form.deliveredCostPerMt ? parseFloat(form.deliveredCostPerMt) : null,
        vehicleRef: form.vehicleRef || null,
        notes: form.notes || null,
      };
      if (editing) {
        await api.put(`/api/v1/corn/receipts/${editing.id}`, payload);
        toast("Receipt updated", "success");
      } else {
        await api.post("/api/v1/corn/receipts", payload);
        toast("Receipt logged", "success");
      }
      cancelForm();
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Failed to save receipt", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/corn/receipts/${deleteTarget.id}`);
      toast("Receipt deleted", "success");
      mutate();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Delete failed", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const openContracts = contracts.filter((c) => c.status === "OPEN" || c.status === "PARTIALLY_DELIVERED");

  // Totals
  const totalGross   = receipts.reduce((s, r) => s + (r.grossMt ?? 0), 0);
  const totalNet     = receipts.reduce((s, r) => s + (r.netMt ?? 0), 0);
  const totalCostSum = receipts.reduce((s, r) => s + (r.totalCostUsd ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Receipt Ledger</h1>
          <p className="text-sm text-muted mt-0.5">Physical corn deliveries received at plant</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onClick={() => {
              const headers = ["Ticket", "Site", "Date", "Supplier", "Gross (MT)", "Shrink %", "Net (MT)", "Contract Ref"];
              const rows = receipts.map((r) => [
                r.ticketRef, r.siteCode, r.receiptDate, "",
                r.grossMt?.toFixed(3) ?? "", r.moisturePct?.toFixed(1) ?? "",
                r.netMt?.toFixed(3) ?? "", r.contractRef,
              ]);
              downloadCsv("receipts.csv", toCsv(headers, rows));
            }}
            disabled={receipts.length === 0}
          />
          <button
            onClick={() => showForm ? cancelForm() : setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-action hover:bg-action-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Log Receipt"}
          </button>
        </div>
      </div>

      {/* Totals */}
      {receipts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Gross Received", value: `${formatNumber(Math.round(totalGross * BUSHELS_PER_MT))} bu` },
            { label: "Net Received",   value: `${formatNumber(Math.round(totalNet * BUSHELS_PER_MT))} bu` },
            { label: "Total Cost",     value: `$${formatNumber(Math.round(totalCostSum))}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface border border-b-default rounded-lg p-4">
              <p className="text-xs text-faint uppercase tracking-wider mb-1">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-b-default rounded-lg p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-secondary">
            {editing ? `Edit ${editing.ticketRef}` : "Log Delivery Receipt"}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Physical Contract</label>
              <select
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action"
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
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Site</label>
              <select
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action"
                value={form.siteCode}
                onChange={(e) => field("siteCode", e.target.value)}
                required
              >
                {sites.length === 0 && <option value="">No sites configured</option>}
                {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Receipt Date</label>
              <input
                type="date"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action"
                value={form.receiptDate}
                onChange={(e) => field("receiptDate", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Gross Weight (MT)</label>
              <input
                type="number"
                step="0.001"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
                placeholder="e.g. 25.450"
                value={form.grossMt}
                onChange={(e) => field("grossMt", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Moisture %</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
                placeholder="15.5"
                value={form.moisturePct}
                onChange={(e) => field("moisturePct", e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Delivered Cost ($/MT)</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
                placeholder="e.g. 244.87"
                value={form.deliveredCostPerMt}
                onChange={(e) => field("deliveredCostPerMt", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Vehicle / Truck Ref</label>
              <input
                type="text"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
                placeholder="e.g. ON-123456"
                value={form.vehicleRef}
                onChange={(e) => field("vehicleRef", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted">Notes</label>
              <input
                type="text"
                className="w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-action placeholder:text-ph"
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => field("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Shrink / net preview */}
          {gross > 0 && (
            <div className="p-4 bg-input-bg/50 rounded-lg">
              <p className="text-xs text-faint mb-2">Net Weight Calculation</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-faint">Gross</p>
                  <p className="text-sm font-semibold tabular-nums text-secondary">{formatNumber(Math.round(gross * BUSHELS_PER_MT))} bu</p>
                </div>
                <div>
                  <p className="text-xs text-faint">Shrink</p>
                  <p className="text-sm font-semibold tabular-nums text-warning">-{formatNumber(Math.round(shrinkMt * BUSHELS_PER_MT))} bu</p>
                </div>
                <div>
                  <p className="text-xs text-faint">Net</p>
                  <p className="text-sm font-semibold tabular-nums text-profit">{formatNumber(Math.round(netBu))} bu</p>
                </div>
              </div>
              {totalCost > 0 && (
                <div className="mt-3 pt-3 border-t border-b-input">
                  <p className="text-xs text-faint">Total Cost</p>
                  <p className="text-sm font-semibold tabular-nums text-secondary">${formatNumber(Math.round(totalCost))}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {editing && (
              <button type="button" onClick={cancelForm} className="px-4 py-2 text-muted hover:text-secondary text-sm transition-colors">
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting ? "Saving…" : editing ? "Update Receipt" : "Log Receipt"}
            </button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted">Site:</label>
        <select
          className="bg-input-bg border border-b-input text-primary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-action"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">All Sites</option>
          {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} cols={8} />
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No receipts"
            description="Log a delivery receipt when corn arrives at the plant."
            action={{ label: "Log Receipt", onClick: () => setShowForm(true) }}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input-bg/50 border-b border-b-default">
                {["Ticket", "Contract", "Site", "Date", "Gross (bu)", "Moisture", "Net (bu)", "Cost/MT", "Total Cost", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-action">{r.ticketRef}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{r.contractRef}</td>
                  <td className="px-4 py-3 text-secondary">{r.siteCode}</td>
                  <td className="px-4 py-3 text-muted">{r.receiptDate}</td>
                  <td className="px-4 py-3 tabular-nums text-secondary">{r.grossMt != null ? formatNumber(Math.round(r.grossMt * BUSHELS_PER_MT)) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">{r.moisturePct?.toFixed(1)}%</td>
                  <td className="px-4 py-3 tabular-nums text-profit">{r.netMt != null ? formatNumber(Math.round(r.netMt * BUSHELS_PER_MT)) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {r.deliveredCostPerMt != null ? `$${r.deliveredCostPerMt.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-secondary">
                    {r.totalCostUsd != null && r.totalCostUsd > 0
                      ? `$${formatNumber(Math.round(r.totalCostUsd))}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => startEdit(r)}
                        className="text-ph hover:text-action transition-colors"
                        title="Edit receipt"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: r.id, ref: r.ticketRef })}
                        className="text-ph hover:text-destructive transition-colors"
                        title="Delete receipt"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Receipt"
        description={`This will permanently delete ${deleteTarget?.ref ?? "this receipt"}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
