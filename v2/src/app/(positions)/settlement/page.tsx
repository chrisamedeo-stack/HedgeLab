"use client";

import { useState, useEffect, useCallback } from "react";
import { useInvoices, useSettlementStore } from "@/hooks/useSettlement";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";
import type { InvoiceStatus, InvoiceType, InvoiceFilters } from "@/types/settlement";
import type { Delivery } from "@/types/logistics";

const statusStyle: Record<string, string> = {
  draft: "bg-hover text-muted",
  issued: "bg-action-10 text-action",
  paid: "bg-profit-10 text-profit",
  cancelled: "bg-destructive-10 text-destructive",
};

export default function SettlementPage() {
  const { orgId } = useOrgContext();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "">("");
  const [showForm, setShowForm] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState("");
  const [payRef, setPayRef] = useState("");

  const filters: Partial<InvoiceFilters> = {};
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.invoiceType = typeFilter;

  const { data: invoices, loading, error, refetch } = useInvoices(orgId, filters);
  const { createInvoice, issueInvoice, recordPayment, cancelInvoice, generateFromDeliveries } = useSettlementStore();

  // Generate from Deliveries flow
  const [showDeliveryPicker, setShowDeliveryPicker] = useState(false);
  const [deliveredList, setDeliveredList] = useState<Delivery[]>([]);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Set<string>>(new Set());
  const [genType, setGenType] = useState<InvoiceType>("purchase");
  const [genCounterparty, setGenCounterparty] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  const fetchDelivered = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/logistics/deliveries?orgId=${orgId}&status=delivered`);
      if (res.ok) setDeliveredList(await res.json());
    } catch { /* silent */ }
  }, [orgId]);

  useEffect(() => {
    if (showDeliveryPicker) fetchDelivered();
  }, [showDeliveryPicker, fetchDelivered]);

  function toggleDelivery(id: string) {
    setSelectedDeliveryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleGenerateFromDeliveries() {
    if (selectedDeliveryIds.size === 0) return;
    setGenLoading(true);
    try {
      await generateFromDeliveries(
        orgId, user!.id,
        Array.from(selectedDeliveryIds),
        genType,
        undefined,
        genCounterparty || undefined
      );
      setShowDeliveryPicker(false);
      setSelectedDeliveryIds(new Set());
      setGenCounterparty("");
      refetch();
    } catch { /* error handled by store */ }
    finally { setGenLoading(false); }
  }

  const [form, setForm] = useState({
    counterpartyName: "",
    invoiceType: "purchase" as InvoiceType,
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    subtotal: "",
    tax: "",
    freight: "",
    total: "",
    currency: "USD",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createInvoice({
        orgId,
        userId: user!.id,
        counterpartyName: form.counterpartyName || undefined,
        invoiceType: form.invoiceType,
        invoiceNumber: form.invoiceNumber || undefined,
        invoiceDate: form.invoiceDate || undefined,
        dueDate: form.dueDate || undefined,
        subtotal: Number(form.subtotal),
        tax: form.tax ? Number(form.tax) : undefined,
        freight: form.freight ? Number(form.freight) : undefined,
        total: Number(form.total),
        currency: form.currency,
        notes: form.notes || undefined,
      });
      setShowForm(false);
      resetForm();
      refetch();
    } catch {
      // error handled by store
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setForm({
      counterpartyName: "",
      invoiceType: "purchase",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      subtotal: "",
      tax: "",
      freight: "",
      total: "",
      currency: "USD",
      notes: "",
    });
  }

  async function handleIssue(id: string) {
    try {
      await issueInvoice(id, user!.id);
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handlePay() {
    if (!payInvoiceId || !payDate) return;
    try {
      await recordPayment(payInvoiceId, user!.id, payDate, payRef || undefined);
      setPayInvoiceId(null);
      setPayDate("");
      setPayRef("");
      refetch();
    } catch {
      // error handled by store
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this invoice?")) return;
    await cancelInvoice(id, user!.id);
    refetch();
  }

  // KPI calculations
  const totalDraft = invoices.filter((i) => i.status === "draft").length;
  const totalIssued = invoices.filter((i) => i.status === "issued").length;
  const totalOutstanding = invoices
    .filter((i) => i.status === "issued")
    .reduce((sum, i) => sum + Number(i.total), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total), 0);

  const inputClass =
    "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Settlement</h1>
          <p className="text-sm text-muted mt-0.5">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} &middot; invoicing &amp; payments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeliveryPicker(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-b-input px-4 py-2 text-sm text-secondary hover:bg-input-bg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12l-3 7H8m0 0l-1.5 6M8 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3H20" />
            </svg>
            From Deliveries
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Draft", value: totalDraft, color: "text-muted" },
          { label: "Issued", value: totalIssued, color: "text-action" },
          { label: "Outstanding", value: `$${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-warning" },
          { label: "Paid", value: `$${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "text-profit" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-b-default bg-surface px-4 py-3">
            <p className="text-xs text-faint uppercase tracking-wider">{kpi.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as InvoiceType | "")}
          className="bg-input-bg border border-b-input text-sm text-secondary rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All Types</option>
          <option value="purchase">Purchase</option>
          <option value="sale">Sale</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">{error}</div>
      )}

      {loading && invoices.length === 0 && (
        <div className="py-12 text-center text-sm text-faint">Loading invoices...</div>
      )}

      {/* Invoices Table */}
      {invoices.length > 0 ? (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-b-default">
              <tr>
                {["Invoice #", "Type", "Counterparty", "Date", "Due", "Subtotal", "Total", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-faint uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-row-hover">
                  <td className="px-4 py-2.5 text-secondary font-mono text-xs">
                    {inv.invoice_number ?? inv.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5 text-muted capitalize">{inv.invoice_type}</td>
                  <td className="px-4 py-2.5 text-secondary">{inv.counterparty_name ?? "\u2014"}</td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 text-muted text-xs">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "\u2014"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-secondary">
                    ${Number(inv.subtotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-primary font-medium">
                    ${Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[inv.status] ?? "bg-hover text-muted"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleIssue(inv.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-action hover:bg-action-10 transition-colors"
                        >
                          Issue
                        </button>
                      )}
                      {inv.status === "issued" && (
                        <button
                          onClick={() => setPayInvoiceId(inv.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-profit hover:bg-profit-10 transition-colors"
                        >
                          Pay
                        </button>
                      )}
                      {inv.status !== "cancelled" && inv.status !== "paid" && (
                        <button
                          onClick={() => handleCancel(inv.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-loss hover:bg-loss/10 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      {inv.status === "paid" && inv.payment_ref && (
                        <span className="text-xs text-muted">Ref: {inv.payment_ref}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="rounded-lg border border-b-default bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-input-bg text-faint">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary">No invoices yet</p>
          <p className="mt-1 text-xs text-faint">Create your first invoice to start settlement tracking.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors">
            New Invoice
          </button>
        </div>
      )}

      {/* Inline Payment Form */}
      {payInvoiceId && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">Record Payment</h3>
          <div className="flex items-end gap-3">
            <label className="block space-y-1 flex-1 max-w-[200px]">
              <span className="text-xs text-muted">Payment Date *</span>
              <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputClass} autoFocus />
            </label>
            <label className="block space-y-1 flex-1 max-w-[200px]">
              <span className="text-xs text-muted">Reference</span>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className={inputClass} placeholder="Check #, wire ref..." />
            </label>
            <button
              onClick={handlePay}
              disabled={!payDate}
              className="rounded-lg bg-profit px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-colors disabled:opacity-50"
            >
              Record Payment
            </button>
            <button
              onClick={() => setPayInvoiceId(null)}
              className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Generate from Deliveries Panel */}
      {showDeliveryPicker && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-secondary">Generate Invoice from Deliveries</h3>
            <button onClick={() => setShowDeliveryPicker(false)} className="text-faint hover:text-secondary text-xs">Close</button>
          </div>

          {deliveredList.length === 0 ? (
            <p className="text-sm text-faint py-4 text-center">No delivered shipments available for invoicing.</p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto rounded border border-b-default divide-y divide-b-default">
                {deliveredList.map((d) => {
                  const checked = selectedDeliveryIds.has(d.id);
                  return (
                    <label key={d.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-row-hover transition-colors ${checked ? "bg-action-5" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDelivery(d.id)}
                        className="rounded border-b-input text-action focus:ring-focus"
                      />
                      <div className="flex-1 min-w-0 flex items-center gap-4 text-xs">
                        <span className="text-secondary">{new Date(d.delivery_date).toLocaleDateString()}</span>
                        <span className="text-secondary">{d.site_name ?? d.site_id.slice(0, 8)}</span>
                        <span className="text-muted">{d.commodity_name ?? d.commodity_id}</span>
                        <span className="tabular-nums text-secondary font-medium">{Number(d.volume).toLocaleString()} {d.unit}</span>
                        {d.freight_cost != null && (
                          <span className="tabular-nums text-faint">${Number(d.freight_cost).toFixed(2)} freight</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-faint">Invoice Type</label>
                  <select value={genType} onChange={(e) => setGenType(e.target.value as InvoiceType)} className={inputClass + " !w-32"}>
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                  </select>
                </div>
                <div className="space-y-1 flex-1 max-w-[200px]">
                  <label className="text-xs text-faint">Counterparty</label>
                  <input type="text" value={genCounterparty} onChange={(e) => setGenCounterparty(e.target.value)} className={inputClass} placeholder="Optional" />
                </div>
                <button
                  onClick={handleGenerateFromDeliveries}
                  disabled={selectedDeliveryIds.size === 0 || genLoading}
                  className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50"
                >
                  {genLoading ? "Generating..." : `Generate Invoice (${selectedDeliveryIds.size})`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Inline New Invoice Form */}
      {showForm && (
        <div className="animate-fade-in rounded-lg border border-b-default bg-surface p-4">
          <h3 className="text-sm font-medium text-secondary mb-3">New Invoice</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Type *</label>
                <select required value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value as InvoiceType })} className={inputClass}>
                  <option value="purchase">Purchase</option>
                  <option value="sale">Sale</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Counterparty</label>
                <input type="text" value={form.counterpartyName} onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })} className={inputClass} placeholder="e.g. Cargill" />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Invoice #</label>
                <input type="text" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} className={inputClass} placeholder="e.g. INV-2026-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass}>
                  <option value="USD">USD</option>
                  <option value="CAD">CAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Invoice Date</label>
                <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Subtotal *</label>
                <input required type="number" step="any" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Tax</label>
                <input type="number" step="any" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Freight</label>
                <input type="number" step="any" value={form.freight} onChange={(e) => setForm({ ...form, freight: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-faint mb-1">Total *</label>
                <input required type="number" step="any" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-faint mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-b-input px-4 py-2 text-sm text-muted hover:bg-input-bg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50">
                {submitting ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
