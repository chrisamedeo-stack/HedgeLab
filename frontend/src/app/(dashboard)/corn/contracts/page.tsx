"use client";

import { useState } from "react";
import { useContracts, useSites, PhysicalContractResponse } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/format";
import { FileText, Plus, ChevronDown, ChevronRight, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BUSHELS_PER_MT = 39.3683;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBu(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `${Math.round(n / 1_000)}K`
    : String(Math.round(n));
}
function fmtCents(n: number | null | undefined) {
  if (n == null) return "—";
  const d = n / 100;
  return `${d >= 0 ? "+" : ""}$${Math.abs(d).toFixed(4)}`;
}
function fmtPerMt(n: number | null | undefined) {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function monthLabel(ym: string | null) {
  if (!ym || ym.length < 7) return ym ?? "—";
  return new Date(ym + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" });
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  OPEN:         { label: "Open",         cls: "bg-slate-700 text-slate-300" },
  BASIS_LOCKED: { label: "Basis Locked", cls: "bg-blue-500/20 text-blue-300" },
  EFP_EXECUTED: { label: "EFP'd",        cls: "bg-emerald-500/20 text-emerald-300" },
  PO_ISSUED:    { label: "PO Issued",    cls: "bg-violet-500/20 text-violet-300" },
  CLOSED:       { label: "Closed",       cls: "bg-slate-600 text-slate-400" },
  CANCELLED:    { label: "Cancelled",    cls: "bg-red-500/20 text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, cls: "bg-slate-700 text-slate-300" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

// ─── New Contract Form ────────────────────────────────────────────────────────

function ContractForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { sites } = useSites();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    siteCode: "", supplierName: "", deliveryMonth: "", futuresRef: "",
    quantityBu: "", basisCentsBu: "", freightPerMt: "", currency: "USD",
    contractDate: new Date().toISOString().slice(0, 10), notes: "",
    tradeType: "BASIS" as "INDEX" | "BASIS",
  });

  function f(k: keyof typeof form, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  const buVal = parseFloat(form.quantityBu) || 0;
  const mtVal = buVal > 0 ? buVal / BUSHELS_PER_MT : 0;
  const basis = parseFloat(form.basisCentsBu);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.siteCode) { toast("Select a site", "error"); return; }
    if (!form.deliveryMonth) { toast("Enter delivery month", "error"); return; }
    if (!buVal) { toast("Enter quantity in bushels", "error"); return; }
    setSubmitting(true);
    try {
      await api.post("/api/v1/corn/contracts", {
        siteCode: form.siteCode,
        supplierName: form.supplierName || null,
        deliveryMonth: form.deliveryMonth,
        futuresRef: form.futuresRef || null,
        quantityBu: buVal,
        basisCentsBu: form.tradeType === "BASIS" && !isNaN(basis) ? basis * 100 : null,
        freightPerMt: parseFloat(form.freightPerMt) || null,
        currency: form.currency,
        contractDate: form.contractDate || null,
        notes: form.notes || null,
        tradeType: form.tradeType,
      });
      toast("Contract created", "success");
      onSaved();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Save failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">New Physical Contract</h2>
        <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Trade Type Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">Trade Type:</span>
        <div className="flex gap-1 p-0.5 bg-slate-800 border border-slate-700 rounded-lg">
          {(["BASIS", "INDEX"] as const).map((t) => (
            <button key={t} type="button"
              onClick={() => f("tradeType", t)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                form.tradeType === t
                  ? t === "BASIS" ? "bg-blue-600 text-white" : "bg-amber-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}>{t}</button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {form.tradeType === "INDEX"
            ? "Committed at floating market/index price"
            : "Has basis component relative to futures"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Site</label>
          <select value={form.siteCode} onChange={(e) => f("siteCode", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">— Select —</option>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Supplier</label>
          <input type="text" placeholder="e.g. Grain Farmers of Ontario" value={form.supplierName}
            onChange={(e) => f("supplierName", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Delivery Month</label>
          <input type="month" value={form.deliveryMonth} onChange={(e) => f("deliveryMonth", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400">Volume (bushels)</label>
          <input type="number" step="1" min="0" placeholder="e.g. 50000" value={form.quantityBu}
            onChange={(e) => f("quantityBu", e.target.value)} required
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">MT (auto)</label>
          <div className="bg-slate-800/50 border border-slate-700/50 text-slate-400 rounded-lg px-3 py-2 text-sm tabular-nums">
            {mtVal > 0 ? `${mtVal.toLocaleString("en-US", { maximumFractionDigits: 1 })} MT` : "—"}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Currency</label>
          <select value={form.currency} onChange={(e) => f("currency", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option>USD</option>
            <option>CAD</option>
          </select>
        </div>

        {form.tradeType === "BASIS" && (
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Basis ($/bu)</label>
            <input type="number" step="0.0025" placeholder="e.g. -0.25" value={form.basisCentsBu}
              onChange={(e) => f("basisCentsBu", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
          </div>
        )}
        {form.tradeType === "BASIS" && (
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Against Futures</label>
            <input type="text" placeholder="e.g. ZCN26" value={form.futuresRef}
              onChange={(e) => f("futuresRef", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs text-slate-400">Freight ($/MT)</label>
          <input type="number" step="0.01" min="0" placeholder="Optional" value={form.freightPerMt}
            onChange={(e) => f("freightPerMt", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-400">Contract Date</label>
          <input type="date" value={form.contractDate} onChange={(e) => f("contractDate", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-slate-400">Notes</label>
          <input type="text" placeholder="Optional" value={form.notes} onChange={(e) => f("notes", e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500" />
        </div>
      </div>

      {form.tradeType === "INDEX" && (
        <p className="text-xs text-amber-400/80">
          INDEX contract — priced at floating market/settle price at delivery. No basis component.
        </p>
      )}
      {form.tradeType === "BASIS" && !isNaN(basis) && form.futuresRef && (
        <p className="text-xs text-slate-500">
          Basis: <span className="text-blue-400 font-medium">{fmtCents(basis)}/bu</span> under{" "}
          <span className="text-blue-400 font-medium">{form.futuresRef}</span>
          {" · "}Board price still open — all-in calculates once board is locked via EFP
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">Cancel</button>
        <button type="submit" disabled={submitting}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {submitting ? "Saving…" : "Create Contract"}
        </button>
      </div>
    </form>
  );
}

// ─── Lock Basis Panel ─────────────────────────────────────────────────────────

function LockBasisPanel({ contract, onDone }: { contract: PhysicalContractResponse; onDone: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [basis, setBasis]     = useState(contract.basisCentsBu != null ? String(contract.basisCentsBu / 100) : "");
  const [futures, setFutures] = useState(contract.futuresRef ?? "");
  const [notes, setNotes]     = useState("");

  async function handleLock(e: React.FormEvent) {
    e.preventDefault();
    const basisVal = parseFloat(basis);
    if (isNaN(basisVal)) { toast("Enter a valid basis value", "error"); return; }
    setSubmitting(true);
    try {
      await api.patch(`/api/v1/corn/contracts/${contract.id}/lock-basis`, {
        basisCentsBu: basisVal * 100,
        futuresRef: futures || null,
        notes: notes || null,
      });
      toast("Basis locked", "success");
      onDone();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Lock failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleLock} className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lock Basis</p>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Basis ($/bu)</label>
          <input type="number" step="0.0025" placeholder="-0.25" value={basis}
            onChange={(e) => setBasis(e.target.value)} required
            className="w-28 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Against Futures</label>
          <input type="text" placeholder="ZCN26" value={futures} onChange={(e) => setFutures(e.target.value)}
            className="w-28 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600" />
        </div>
        <div className="space-y-1 flex-1 min-w-32">
          <label className="text-xs text-slate-500">Notes</label>
          <input type="text" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600" />
        </div>
        <button type="submit" disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          <Lock className="h-3.5 w-3.5" />
          {submitting ? "Locking…" : "Lock Basis"}
        </button>
        <button type="button" onClick={onDone}
          className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── Contract Row ─────────────────────────────────────────────────────────────

function ContractRow({ contract, onRefresh }: { contract: PhysicalContractResponse; onRefresh: () => void }) {
  const [expanded, setExpanded]         = useState(false);
  const [lockingBasis, setLockingBasis] = useState(false);
  const { toast } = useToast();

  const isFullyPriced = contract.allInPerMt != null;
  const isCancelled   = contract.status === "CANCELLED";

  async function handleCancel() {
    if (!confirm(`Cancel contract ${contract.contractRef}?`)) return;
    try {
      await api.post(`/api/v1/corn/contracts/${contract.id}/cancel`, {});
      toast("Contract cancelled", "success");
      onRefresh();
    } catch (err: unknown) {
      toast((err as Error).message ?? "Cancel failed", "error");
    }
  }

  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-xl overflow-hidden", isCancelled && "opacity-60")}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors">
        <button onClick={() => setExpanded((v) => !v)}
          className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="w-44 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono font-medium text-slate-200 truncate">{contract.contractRef}</p>
            {contract.tradeType && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                contract.tradeType === "INDEX"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-blue-500/20 text-blue-400"
              )}>{contract.tradeType}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{contract.supplierName ?? "—"}</p>
        </div>

        <div className="w-28 min-w-0">
          <p className="text-sm text-slate-300">{contract.siteName}</p>
          <p className="text-xs text-slate-500">{monthLabel(contract.deliveryMonth)}</p>
        </div>

        <div className="w-32 min-w-0 hidden sm:block">
          <p className="text-sm tabular-nums text-slate-300">{fmtBu(contract.quantityBu)} bu</p>
          <p className="text-xs tabular-nums text-slate-500">{formatNumber(Math.round(contract.quantityMt))} MT</p>
        </div>

        <div className="w-36 min-w-0 hidden md:block">
          {contract.tradeType === "INDEX" ? (
            <p className="text-sm text-amber-500/60 italic">N/A (Index)</p>
          ) : contract.basisCentsBu != null ? (
            <>
              <p className="text-sm tabular-nums text-slate-300">{fmtCents(contract.basisCentsBu)}/bu</p>
              <p className="text-xs text-slate-500">{contract.futuresRef ?? "—"}</p>
            </>
          ) : (
            <p className="text-sm text-slate-600 italic">Basis open</p>
          )}
        </div>

        <div className="w-36 min-w-0 hidden lg:block">
          {isFullyPriced ? (
            <>
              <p className="text-sm tabular-nums font-semibold text-emerald-400">{fmtPerMt(contract.allInPerMt)}/MT</p>
              <p className="text-xs tabular-nums text-slate-500">{fmtCents(contract.allInCentsBu)}/bu</p>
            </>
          ) : (
            <p className="text-sm text-slate-600 italic">Board open</p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={contract.status} />
          {!isCancelled && contract.status === "OPEN" && contract.tradeType !== "INDEX" && (
            <button
              onClick={() => { setLockingBasis((v) => !v); setExpanded(true); }}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-colors">
              <Lock className="h-3 w-3" /> Lock Basis
            </button>
          )}
          {!isCancelled && contract.status !== "CLOSED" && (
            <button onClick={handleCancel}
              className="text-slate-600 hover:text-red-400 text-xs transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800">
          {lockingBasis && contract.status === "OPEN" && (
            <LockBasisPanel
              contract={contract}
              onDone={() => { setLockingBasis(false); onRefresh(); }}
            />
          )}
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Contract Date", value: contract.contractDate ?? "—" },
              { label: "Currency",      value: contract.currency },
              { label: "Freight",       value: contract.freightPerMt != null ? `${fmtPerMt(contract.freightPerMt)}/MT` : "—" },
              { label: "Basis",         value: contract.basisCentsBu != null ? `${fmtCents(contract.basisCentsBu)}/bu vs ${contract.futuresRef ?? "?"}` : "Open" },
              { label: "Board Price",   value: contract.boardPriceCentsBu != null ? `$${(contract.boardPriceCentsBu / 100).toFixed(4)}/bu` : "Open (floating with futures)" },
              { label: "All-in Price",  value: isFullyPriced ? `${fmtPerMt(contract.allInPerMt)}/MT · ${fmtCents(contract.allInCentsBu)}/bu` : "Pending board price lock" },
              { label: "Basis Locked",  value: contract.basisLockedDate ?? "Not yet locked" },
              { label: "Notes",         value: contract.notes ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-slate-300 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { sites } = useSites();
  const [filterSite, setFilterSite]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm]         = useState(false);
  const { contracts, isLoading, mutate } = useContracts(filterSite || undefined);

  const filtered = filterStatus
    ? contracts.filter((c) => c.status === filterStatus)
    : contracts;

  const totalBu     = filtered.reduce((s, c) => s + (c.quantityBu ?? 0), 0);
  const totalMt     = filtered.reduce((s, c) => s + (c.quantityMt ?? 0), 0);
  const pricedCount = filtered.filter((c) => c.allInPerMt != null).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Physical Contracts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Corn procurement · basis &amp; board pricing lifecycle
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> New Contract
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">All Sites</option>
          {sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <ContractForm onSaved={() => { setShowForm(false); mutate(); }} onCancel={() => setShowForm(false)} />
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Contracts",    value: String(filtered.length) },
            { label: "Total Volume", value: `${fmtBu(totalBu)} bu / ${formatNumber(Math.round(totalMt))} MT` },
            { label: "Fully Priced", value: `${pricedCount} of ${filtered.length}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-lg font-bold tabular-nums text-slate-100">{value}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No physical contracts"
          description="Create a contract to begin the basis and board pricing workflow."
          action={{ label: "New Contract", onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ContractRow key={c.id} contract={c} onRefresh={mutate} />
          ))}
        </div>
      )}
    </div>
  );
}
