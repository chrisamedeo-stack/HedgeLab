"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Zap,
  Lock,
  AlertCircle,
  Plus,
  X,
  ArrowRightLeft,
} from "lucide-react";
import {
  usePositions,
  useSites,
  useBudget,
  HedgeBookItem,
  SiteAllocationItem,
  PhysicalPositionItem,
  LockedPositionItem,
  OffsetItem,
  CornBudgetLineResponse,
} from "@/hooks/useCorn";
import { useSuppliers, useAppSettings } from "@/hooks/useSettings";
import { api } from "@/lib/api";
import {
  BUSHELS_PER_MT,
  suggestFuturesMonth,
  getValidDeliveryMonths,
  fiscalYearMonths,
  currentFiscalYear,
  monthLabel,
} from "@/lib/corn-utils";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBu(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtMt(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPnl(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "\u2212";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "\u2013";
  return `$${fmt2(n)}`;
}
function centsToUsd(cents: number | null | undefined): string {
  if (cents == null) return "\u2013";
  return (cents / 100).toFixed(4);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Input class ─────────────────────────────────────────────────────────────

const inputCls =
  "bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500";
const btnPrimary =
  "px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50";
const btnSecondary =
  "px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium";

// ─── Settle Publisher ────────────────────────────────────────────────────────

function SettlePublisher({
  futuresMonths,
  existingSettles,
  onDone,
}: {
  futuresMonths: string[];
  existingSettles: Record<string, number>;
  onDone: () => void;
}) {
  const toast = useToast();
  const [settleDate, setSettleDate] = useState(today());
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    futuresMonths.forEach((fm) => {
      init[fm] = existingSettles[fm] != null ? String(existingSettles[fm] / 100) : "";
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const payload: Record<string, number> = {};
    for (const [fm, v] of Object.entries(prices)) {
      const n = parseFloat(v);
      if (!isNaN(n)) payload[fm] = n * 100;
    }
    if (Object.keys(payload).length === 0) {
      toast.toast("Enter at least one settle price", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/v1/corn/positions/settle", { settleDate, prices: payload });
      toast.toast("Settle prices published", "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to publish", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-semibold text-slate-200">Publish Settle Prices</span>
        <span className="text-xs text-slate-500">Enter ZC close prices ($/bu)</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Settle Date</label>
          <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className={inputCls} />
        </div>
        {futuresMonths.map((fm) => (
          <div key={fm} className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">{fm} ($/bu)</label>
            <input
              type="number"
              step="0.25"
              placeholder={existingSettles[fm] != null ? String(existingSettles[fm] / 100) : "e.g. 4.39"}
              value={prices[fm] ?? ""}
              onChange={(e) => setPrices((p) => ({ ...p, [fm]: e.target.value }))}
              className={cn(inputCls, "w-36")}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving\u2026" : "Publish"}
        </button>
        <button onClick={onDone} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Allocate Form (multi-site) ─────────────────────────────────────────────

interface AllocRow {
  siteCode: string;
  budgetMonth: string;
  bushels: string;
}

function AllocateForm({
  hedge,
  sites,
  onDone,
  onCancel,
}: {
  hedge: HedgeBookItem;
  sites: { code: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const validMonths = hedge.validDeliveryMonths;
  const [rows, setRows] = useState<AllocRow[]>([
    { siteCode: sites[0]?.code ?? "", budgetMonth: validMonths[0] ?? "", bushels: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const totalBu = rows.reduce((s, r) => s + (parseInt(r.bushels) || 0), 0);
  const availBu = hedge.unallocatedBushels;

  function updateRow(idx: number, field: keyof AllocRow, val: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { siteCode: sites[0]?.code ?? "", budgetMonth: validMonths[0] ?? "", bushels: "" }]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (totalBu <= 0 || totalBu > availBu) {
      toast.toast(`Total bushels must be 1\u2013${fmtBu(availBu)}`, "error");
      return;
    }
    setSaving(true);
    try {
      for (const row of rows) {
        const bu = parseInt(row.bushels);
        if (!bu || bu <= 0) continue;
        const lots = Math.round(bu / 5000);
        if (lots <= 0) continue;
        await api.post(`/api/v1/corn/hedges/${hedge.hedgeTradeId}/allocations`, {
          siteCode: row.siteCode,
          budgetMonth: row.budgetMonth,
          allocatedLots: lots,
        });
      }
      toast.toast(`Allocated ${fmtBu(totalBu)} bu from ${hedge.tradeRef}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Allocation failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/70 border border-emerald-500/30 rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-300">
          Allocate \u2014 {hedge.tradeRef} ({hedge.futuresMonth})
        </span>
        <span className="ml-auto text-xs text-slate-500">{fmtBu(availBu)} bu available</span>
      </div>

      <div className="space-y-2 mb-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Site</label>
              <select value={row.siteCode} onChange={(e) => updateRow(idx, "siteCode", e.target.value)} className={inputCls}>
                {sites.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} \u2014 {s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Budget Month</label>
              <select value={row.budgetMonth} onChange={(e) => updateRow(idx, "budgetMonth", e.target.value)} className={inputCls}>
                {validMonths.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Bushels</label>
              <input
                type="number"
                step={5000}
                min={5000}
                placeholder="e.g. 25000"
                value={row.bushels}
                onChange={(e) => updateRow(idx, "bushels", e.target.value)}
                className={cn(inputCls, "w-36")}
              />
            </div>
            <div className="text-xs text-slate-500 pb-1.5">
              {row.bushels ? `${Math.round(parseInt(row.bushels) / 5000)} lots` : ""}
            </div>
            {rows.length > 1 && (
              <button onClick={() => removeRow(idx)} className="pb-1.5 text-slate-500 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <button onClick={addRow} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
          <Plus className="h-3 w-3" /> Add Row
        </button>
        <span className={cn("text-xs font-medium", totalBu > availBu ? "text-red-400" : "text-slate-400")}>
          Total: {fmtBu(totalBu)} / {fmtBu(availBu)} bu
        </span>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving || totalBu <= 0 || totalBu > availBu} className={btnPrimary}>
          {saving ? "Allocating\u2026" : "Allocate"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Offset Form ─────────────────────────────────────────────────────────────

function OffsetForm({
  entryPrice,
  availableBu,
  endpoint,
  onDone,
  onCancel,
}: {
  entryPrice: number;
  availableBu: number;
  endpoint: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [bushels, setBushels] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [offsetDate, setOffsetDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const bu = parseInt(bushels) || 0;
  const lots = Math.round(bu / 5000);
  const exit = parseFloat(exitPrice);
  const pnlPreview =
    !isNaN(exit) && bu > 0
      ? ((exit * 100 - entryPrice) * bu) / 100
      : null;

  async function handleSubmit() {
    if (lots <= 0 || bu > availableBu) {
      toast.toast(`Bushels must be 5000\u2013${fmtBu(availableBu)}`, "error");
      return;
    }
    if (isNaN(exit)) {
      toast.toast("Enter an exit price", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post(endpoint, {
        lots,
        exitPrice: exit * 100, // convert $/bu to ¢/bu
        offsetDate,
        notes: notes || null,
      });
      toast.toast(`Offset ${fmtBu(bu)} bu \u2014 P&L: ${fmtPnl(pnlPreview)}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Offset failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/70 border border-amber-500/30 rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-300">Offset Futures</span>
        <span className="ml-auto text-xs text-slate-500">{fmtBu(availableBu)} bu available</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Bushels</label>
          <input type="number" step={5000} min={5000} value={bushels} onChange={(e) => setBushels(e.target.value)}
            placeholder="e.g. 10000" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Exit Price ($/bu)</label>
          <input type="number" step="0.0025" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
            placeholder="e.g. 4.55" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Offset Date</label>
          <input type="date" value={offsetDate} onChange={(e) => setOffsetDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional\u2026" className={inputCls} />
        </div>
      </div>
      {pnlPreview != null && (
        <div className={cn("text-xs mb-3 font-medium", pnlPreview >= 0 ? "text-emerald-400" : "text-red-400")}>
          P&L Preview: {fmtPnl(pnlPreview)} ({lots} lots)
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={btnPrimary}>
          {saving ? "Offsetting\u2026" : "Execute Offset"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── New Purchase Form ──────────────────────────────────────────────────────

function NewPurchaseForm({
  siteCode,
  sites,
  onDone,
  onCancel,
}: {
  siteCode: string;
  sites: { code: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const { suppliers } = useSuppliers();
  const [tradeType, setTradeType] = useState<"BASIS" | "INDEX">("BASIS");
  const [site, setSite] = useState(siteCode || sites[0]?.code || "");
  const [supplier, setSupplier] = useState("");
  const [deliveryMonth, setDeliveryMonth] = useState("");
  const [quantityMt, setQuantityMt] = useState("");
  const [basisCentsBu, setBasisCentsBu] = useState("");
  const [futuresRef, setFuturesRef] = useState("");
  const [freightPerMt, setFreightPerMt] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contractDate, setContractDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!site) { toast.toast("Select a site", "error"); return; }
    if (!deliveryMonth) { toast.toast("Enter delivery month", "error"); return; }
    if (!quantityMt) { toast.toast("Enter quantity", "error"); return; }

    setSaving(true);
    try {
      await api.post("/api/v1/corn/contracts", {
        siteCode: site,
        supplierName: supplier || null,
        deliveryMonth,
        quantityMt: parseFloat(quantityMt),
        basisCentsBu: tradeType === "BASIS" && basisCentsBu ? parseFloat(basisCentsBu) : null,
        futuresRef: futuresRef || null,
        freightPerMt: freightPerMt ? parseFloat(freightPerMt) : null,
        currency,
        contractDate,
        notes: notes || null,
        tradeType,
      });
      toast.toast(`${tradeType} purchase created at ${site}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "Failed to create", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Plus className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-slate-200">New Physical Purchase</span>
      </div>

      {/* Trade type toggle */}
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit mb-4">
        {(["BASIS", "INDEX"] as const).map((t) => (
          <button key={t} onClick={() => setTradeType(t)}
            className={cn("px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
              tradeType === t ? (t === "BASIS" ? "bg-blue-600 text-white" : "bg-amber-600 text-white") : "text-slate-400 hover:text-slate-200")}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Site</label>
          <select value={site} onChange={(e) => setSite(e.target.value)} className={inputCls}>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.code} \u2014 {s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Supplier</label>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
            <option value="">Select\u2026</option>
            {(suppliers ?? []).map((s: { name: string }) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Delivery Month</label>
          <input type="month" value={deliveryMonth} onChange={(e) => setDeliveryMonth(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Quantity (MT)</label>
          <input type="number" step="100" value={quantityMt} onChange={(e) => setQuantityMt(e.target.value)}
            placeholder="e.g. 3000" className={inputCls} />
        </div>
        {tradeType === "BASIS" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Basis (¢/bu)</label>
            <input type="number" step="1" value={basisCentsBu} onChange={(e) => setBasisCentsBu(e.target.value)}
              placeholder="e.g. -20" className={inputCls} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Futures Ref</label>
          <input type="text" value={futuresRef} onChange={(e) => setFuturesRef(e.target.value)}
            placeholder="e.g. ZCN26" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Freight ($/MT)</label>
          <input type="number" step="0.5" value={freightPerMt} onChange={(e) => setFreightPerMt(e.target.value)}
            placeholder="e.g. 12.50" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Contract Date</label>
          <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional\u2026" className={inputCls} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={btnPrimary}>
          {saving ? "Creating\u2026" : "Create Purchase"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── EFP Form ────────────────────────────────────────────────────────────────

function EFPForm({
  allocation,
  physicalPositions,
  sites,
  settles,
  onDone,
  onCancel,
}: {
  allocation: SiteAllocationItem;
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const validMonths = getValidDeliveryMonths(allocation.futuresMonth);

  const [lots, setLots] = useState("");
  const [contractId, setContractId] = useState("");
  const [boardPrice, setBoardPrice] = useState(
    settles[allocation.futuresMonth] != null ? String(settles[allocation.futuresMonth] / 100) : ""
  );
  const [efpDate, setEfpDate] = useState(today());
  const [confirmRef, setConfirmRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const eligible = physicalPositions.filter(
    (p) =>
      p.siteCode === allocation.siteCode &&
      validMonths.includes(p.deliveryMonth) &&
      !["CLOSED", "CANCELLED"].includes(p.status)
  );

  async function handleSubmit() {
    const lotsN = parseInt(lots, 10);
    if (!lotsN || lotsN <= 0 || lotsN > allocation.openAllocatedLots) {
      toast.toast(`Lots must be 1\u2013${allocation.openAllocatedLots}`, "error");
      return;
    }
    if (!contractId) { toast.toast("Select a physical contract", "error"); return; }
    if (!boardPrice) { toast.toast("Enter a board price", "error"); return; }

    const selectedContract = physicalPositions.find((p) => String(p.contractId) === contractId);
    setSaving(true);
    try {
      await api.post("/api/v1/corn/efp", {
        hedgeTradeId: allocation.hedgeTradeId,
        physicalContractId: parseInt(contractId, 10),
        lots: lotsN,
        boardPrice: parseFloat(boardPrice) * 100,
        basisValue: selectedContract?.basisValue ?? null,
        efpDate,
        confirmationRef: confirmRef,
        notes,
      });
      toast.toast(`EFP executed \u2014 ${lotsN} lots from ${allocation.tradeRef}`, "success");
      onDone();
    } catch (e: unknown) {
      toast.toast((e as Error).message ?? "EFP failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800/70 border border-blue-500/30 rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-300">
          Execute EFP \u2014 {allocation.tradeRef} \u2192 {allocation.siteCode}
        </span>
        <span className="ml-auto text-xs text-slate-500">{allocation.openAllocatedLots} lots available</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Lots (max {allocation.openAllocatedLots})</label>
          <input type="number" min={1} max={allocation.openAllocatedLots} value={lots}
            onChange={(e) => setLots(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Physical Contract</label>
          <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={inputCls}>
            <option value="">Select contract\u2026</option>
            {eligible.map((p) => (
              <option key={p.contractId} value={p.contractId}>
                {p.contractRef} \u2014 {p.deliveryMonth}
              </option>
            ))}
          </select>
          {eligible.length === 0 && <span className="text-xs text-amber-400">No open contracts at {allocation.siteCode}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Board Price ($/bu)</label>
          <input type="number" step="0.0025" value={boardPrice} onChange={(e) => setBoardPrice(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">EFP Date</label>
          <input type="date" value={efpDate} onChange={(e) => setEfpDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Confirm Ref</label>
          <input type="text" value={confirmRef} onChange={(e) => setConfirmRef(e.target.value)} placeholder="Broker ref\u2026" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional\u2026" className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={cn(btnPrimary, "flex items-center gap-2")}>
          <Zap className="h-3.5 w-3.5" />
          {saving ? "Executing\u2026" : "Execute EFP"}
        </button>
        <button onClick={onCancel} className={btnSecondary}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Hedge Book — Grouped by Futures Month ──────────────────────────────────

interface FuturesMonthGroup {
  futuresMonth: string;
  items: HedgeBookItem[];
  totalBu: number;
  unallocBu: number;
  totalLots: number;
  wtdAvgEntry: number;
  totalMtm: number;
}

function HedgeBookTable({
  hedgeBook,
  sites,
  onRefresh,
  autoExpandMonth,
}: {
  hedgeBook: HedgeBookItem[];
  sites: { code: string; name: string }[];
  onRefresh: () => void;
  autoExpandMonth?: string | null;
}) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [allocTradeId, setAllocTradeId] = useState<number | null>(null);
  const [offsetTradeId, setOffsetTradeId] = useState<number | null>(null);

  // Auto-expand when a specific futures month is requested
  useEffect(() => {
    if (autoExpandMonth) {
      setExpandedMonth(autoExpandMonth);
    }
  }, [autoExpandMonth]);

  const groups: FuturesMonthGroup[] = useMemo(() => {
    const map = new Map<string, HedgeBookItem[]>();
    for (const item of hedgeBook) {
      const list = map.get(item.futuresMonth) || [];
      list.push(item);
      map.set(item.futuresMonth, list);
    }
    return Array.from(map.entries())
      .map(([fm, items]) => {
        const totalBu = items.reduce((s, i) => s + i.bushels, 0);
        const unallocBu = items.reduce((s, i) => s + i.unallocatedBushels, 0);
        const totalLots = items.reduce((s, i) => s + i.lots, 0);
        const totalMtm = items.reduce((s, i) => s + (i.mtmPnlUsd ?? 0), 0);
        const sumWt = items.reduce((s, i) => s + i.unallocatedLots * (i.entryPrice ?? 0), 0);
        const sumLots = items.reduce((s, i) => s + i.unallocatedLots, 0);
        const wtdAvgEntry = sumLots > 0 ? sumWt / sumLots : 0;
        return { futuresMonth: fm, items, totalBu, unallocBu, totalLots, wtdAvgEntry, totalMtm };
      })
      .sort((a, b) => a.futuresMonth.localeCompare(b.futuresMonth));
  }, [hedgeBook]);

  function handleDone() {
    setAllocTradeId(null);
    setOffsetTradeId(null);
    onRefresh();
  }

  return (
    <div className="divide-y divide-slate-800">
      {groups.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">No open hedge positions</div>
      )}
      {groups.map((g) => {
        const isExpanded = expandedMonth === g.futuresMonth;
        return (
          <Fragment key={g.futuresMonth}>
            {/* Summary row */}
            <button
              onClick={() => setExpandedMonth(isExpanded ? null : g.futuresMonth)}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-800/30 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                {g.futuresMonth}
              </span>
              <span className="text-sm text-slate-300">{fmtBu(g.totalBu)} bu</span>
              <span className="text-sm text-slate-500">{fmtBu(g.unallocBu)} unalloc</span>
              <span className="text-sm text-slate-400 font-mono">Avg {centsToUsd(g.wtdAvgEntry)}</span>
              <span className={cn("text-sm font-semibold", g.totalMtm > 0 ? "text-emerald-400" : g.totalMtm < 0 ? "text-red-400" : "text-slate-400")}>
                {fmtPnl(g.totalMtm)}
              </span>
              <span className="text-xs text-slate-600 ml-auto">{g.totalLots} lots</span>
            </button>

            {/* Expanded trade rows */}
            {isExpanded && (
              <div className="bg-slate-800/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/40">
                      {["Trade Ref", "Total Bu", "Alloc Bu", "Unalloc Bu", "Entry $/bu", "Settle $/bu", "MTM", "Broker", ""].map(
                        (h) => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((h) => {
                      const isAlloc = allocTradeId === h.hedgeTradeId;
                      const isOffset = offsetTradeId === h.hedgeTradeId;
                      return (
                        <Fragment key={h.hedgeTradeId}>
                          <tr className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2 font-mono text-slate-200 text-xs">{h.tradeRef}</td>
                            <td className="px-4 py-2 text-slate-300">{fmtBu(h.bushels)}</td>
                            <td className="px-4 py-2 text-slate-500">{fmtBu(h.allocatedBushels)}</td>
                            <td className="px-4 py-2 text-emerald-400 font-semibold">{fmtBu(h.unallocatedBushels)}</td>
                            <td className="px-4 py-2 text-slate-300 font-mono">{centsToUsd(h.entryPrice)}</td>
                            <td className="px-4 py-2 font-mono">
                              {h.settlePrice != null ? (
                                <span className="text-slate-200">{centsToUsd(h.settlePrice)}</span>
                              ) : (
                                <span className="text-slate-600 italic text-xs">no settle</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {h.mtmPnlUsd != null ? (
                                <span className={cn("flex items-center gap-1 font-semibold",
                                  h.mtmPnlUsd > 0 ? "text-emerald-400" : h.mtmPnlUsd < 0 ? "text-red-400" : "text-slate-400")}>
                                  {h.mtmPnlUsd > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : h.mtmPnlUsd < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                                  {fmtPnl(h.mtmPnlUsd)}
                                </span>
                              ) : <span className="text-slate-600 italic text-xs">\u2013</span>}
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{h.brokerAccount}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { setAllocTradeId(isAlloc ? null : h.hedgeTradeId); setOffsetTradeId(null); }}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <ArrowRightLeft className="h-3 w-3" /> Alloc
                                </button>
                                <button
                                  onClick={() => { setOffsetTradeId(isOffset ? null : h.hedgeTradeId); setAllocTradeId(null); }}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <X className="h-3 w-3" /> Offset
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isAlloc && (
                            <tr className="border-t border-slate-800/50">
                              <td colSpan={9} className="px-4 py-2">
                                <AllocateForm hedge={h} sites={sites} onDone={handleDone} onCancel={() => setAllocTradeId(null)} />
                              </td>
                            </tr>
                          )}
                          {isOffset && (
                            <tr className="border-t border-slate-800/50">
                              <td colSpan={9} className="px-4 py-2">
                                <OffsetForm
                                  entryPrice={h.entryPrice}
                                  availableBu={h.unallocatedBushels}
                                  endpoint={`/api/v1/corn/hedges/${h.hedgeTradeId}/offset`}
                                  onDone={handleDone}
                                  onCancel={() => setOffsetTradeId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Site Allocations Table ─────────────────────────────────────────────────

function SiteAllocationsTable({
  allocations,
  physicalPositions,
  sites,
  settles,
  onRefresh,
}: {
  allocations: SiteAllocationItem[];
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  onRefresh: () => void;
}) {
  const [efpAllocId, setEfpAllocId] = useState<number | null>(null);
  const [offsetAllocId, setOffsetAllocId] = useState<number | null>(null);

  function handleDone() {
    setEfpAllocId(null);
    setOffsetAllocId(null);
    onRefresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Trade", "ZC", "Site", "Month", "Alloc Bu", "Open Bu", "Entry $/bu", "Settle $/bu", "MTM", ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allocations.length === 0 && (
            <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">No allocations yet</td></tr>
          )}
          {allocations.map((a) => {
            const isEfp = efpAllocId === a.allocationId;
            const isOffset = offsetAllocId === a.allocationId;
            return (
              <Fragment key={a.allocationId}>
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-200 text-xs">{a.tradeRef}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                  </td>
                  <td className="px-4 py-3"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{a.budgetMonth}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtBu(a.allocatedBushels)}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">{fmtBu(a.openAllocatedLots * 5000)}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono">{centsToUsd(a.entryPrice)}</td>
                  <td className="px-4 py-3 font-mono">
                    {a.settlePrice != null ? <span className="text-slate-200">{centsToUsd(a.settlePrice)}</span>
                      : <span className="text-slate-600 italic text-xs">no settle</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.mtmPnlUsd != null ? (
                      <span className={cn("font-semibold", a.mtmPnlUsd > 0 ? "text-emerald-400" : a.mtmPnlUsd < 0 ? "text-red-400" : "text-slate-400")}>
                        {fmtPnl(a.mtmPnlUsd)}
                      </span>
                    ) : <span className="text-slate-600 italic text-xs">\u2013</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {a.openAllocatedLots > 0 && (
                        <>
                          <button
                            onClick={() => { setEfpAllocId(isEfp ? null : a.allocationId); setOffsetAllocId(null); }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Zap className="h-3 w-3" /> EFP
                          </button>
                          <button
                            onClick={() => { setOffsetAllocId(isOffset ? null : a.allocationId); setEfpAllocId(null); }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded-lg text-xs font-medium transition-colors"
                          >
                            <X className="h-3 w-3" /> Offset
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isEfp && (
                  <tr className="border-t border-slate-800">
                    <td colSpan={10} className="px-4 py-3">
                      <EFPForm allocation={a} physicalPositions={physicalPositions} sites={sites} settles={settles} onDone={handleDone} onCancel={() => setEfpAllocId(null)} />
                    </td>
                  </tr>
                )}
                {isOffset && (
                  <tr className="border-t border-slate-800">
                    <td colSpan={10} className="px-4 py-3">
                      <OffsetForm
                        entryPrice={a.entryPrice}
                        availableBu={a.openAllocatedLots * 5000}
                        endpoint={`/api/v1/corn/hedges/allocations/${a.allocationId}/offset`}
                        onDone={handleDone}
                        onCancel={() => setOffsetAllocId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Physical Positions Table ────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "OPEN": return "text-slate-400";
    case "BASIS_LOCKED": return "text-blue-400";
    case "EFP_EXECUTED": return "text-emerald-400";
    case "PO_ISSUED": return "text-emerald-500";
    default: return "text-slate-500";
  }
}

function tradeTypeBadge(type: string) {
  if (type === "INDEX") return <span className="bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25 px-2 py-0.5 rounded text-xs font-mono font-semibold">INDEX</span>;
  return <span className="bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25 px-2 py-0.5 rounded text-xs font-mono font-semibold">BASIS</span>;
}

function PhysicalPositionsTable({
  positions,
  settles,
}: {
  positions: PhysicalPositionItem[];
  settles: Record<string, number>;
}) {
  // Compute blended cost summary
  const blended = useMemo(() => {
    let hedgedCost = 0;
    let hedgedVol = 0;
    let marketCost = 0;
    let marketVol = 0;

    for (const p of positions) {
      if (p.allInPricePerMt != null) {
        hedgedCost += p.allInPricePerMt * p.committedMt;
        hedgedVol += p.committedMt;
      } else {
        // Use settle-based estimate
        const settle = p.futuresRef ? settles[p.futuresRef] : null;
        if (settle != null) {
          const basisCents = p.basisValue ?? 0;
          const freightEst = 0; // freight unknown for unpriced
          const estPerMt = ((settle + basisCents) / 100) * BUSHELS_PER_MT + freightEst;
          marketCost += estPerMt * p.committedMt;
          marketVol += p.committedMt;
        } else {
          marketVol += p.committedMt;
        }
      }
    }

    const totalVol = hedgedVol + marketVol;
    const totalCost = hedgedCost + marketCost;
    const blendedPerMt = totalVol > 0 ? totalCost / totalVol : null;

    return { hedgedVol, hedgedPerMt: hedgedVol > 0 ? hedgedCost / hedgedVol : null, marketVol, marketPerMt: marketVol > 0 ? marketCost / marketVol : null, blendedPerMt, totalVol };
  }, [positions, settles]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {["Type", "Month", "Site", "Contract", "Supplier", "MT", "Board", "Basis", "Freight", "All-In $/MT", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500 text-sm">No active physical contracts</td></tr>
            )}
            {positions.map((p) => (
              <tr key={p.contractId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">{tradeTypeBadge(p.tradeType)}</td>
                <td className="px-4 py-3 font-mono text-slate-300 text-xs">{p.deliveryMonth}</td>
                <td className="px-4 py-3"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{p.siteCode}</span></td>
                <td className="px-4 py-3 font-mono text-slate-400 text-xs">{p.contractRef}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{p.supplierName}</td>
                <td className="px-4 py-3 text-slate-300">{fmtMt(p.committedMt)}</td>
                <td className="px-4 py-3">
                  {p.efpExecuted ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-mono">
                      <Lock className="h-3 w-3" /> {centsToUsd(p.boardPriceLocked)}
                    </span>
                  ) : (
                    <span className="text-orange-400 italic text-xs">Open</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.tradeType === "INDEX" ? (
                    <span className="text-slate-600 italic text-xs">N/A</span>
                  ) : p.basisLocked ? (
                    <span className="flex items-center gap-1 text-blue-300 font-mono">
                      <Lock className="h-3 w-3 text-blue-400" /> {p.basisValue != null ? (p.basisValue / 100).toFixed(4) : "\u2013"}
                    </span>
                  ) : (
                    <span className="text-orange-400 italic text-xs">Open</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono">{fmt2(null)}</td>
                <td className="px-4 py-3">
                  {p.allInPricePerMt != null ? (
                    <span className="text-emerald-300 font-semibold">{fmtUsd(p.allInPricePerMt)}</span>
                  ) : (
                    <span className="text-slate-600 italic text-xs">\u2013</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-medium", statusColor(p.status))}>{p.status.replace("_", " ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Blended cost summary */}
      {positions.length > 0 && blended.blendedPerMt != null && (
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/30">
          <span className="text-xs text-slate-400">
            Blended Cost: <span className="text-emerald-300 font-semibold">{fmtUsd(blended.blendedPerMt)}/MT</span>
            {blended.hedgedVol > 0 && <span> (hedged: {fmtUsd(blended.hedgedPerMt)}/MT x {fmtMt(blended.hedgedVol)} MT</span>}
            {blended.marketVol > 0 && <span>{blended.hedgedVol > 0 ? " + " : " ("}market: {fmtUsd(blended.marketPerMt)}/MT x {fmtMt(blended.marketVol)} MT</span>}
            {(blended.hedgedVol > 0 || blended.marketVol > 0) && <span>)</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Locked Positions Table ─────────────────────────────────────────────────

function LockedPositionsTable({ locked }: { locked: LockedPositionItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Ticket", "Site", "Delivery", "ZC", "Lots", "Fut.Buy", "Fut.Sell", "P&L \u00a2/bu", "P&L $", "Board", "Basis", "Freight", "All-In", "Eff.All-In"].map((h) => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {locked.length === 0 && (
            <tr><td colSpan={14} className="px-4 py-8 text-center text-slate-500 text-sm">No EFP positions locked yet</td></tr>
          )}
          {locked.map((l) => {
            const pnlPositive = (l.gainLossCentsBu ?? 0) > 0;
            const pnlNegative = (l.gainLossCentsBu ?? 0) < 0;
            const pnlColor = pnlPositive ? "text-emerald-400" : pnlNegative ? "text-red-400" : "text-slate-400";
            return (
              <tr key={l.efpTicketId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="px-3 py-3 font-mono text-slate-300 text-xs">{l.ticketRef}</td>
                <td className="px-3 py-3"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{l.siteCode}</span></td>
                <td className="px-3 py-3 font-mono text-slate-400 text-xs">{l.deliveryMonth}</td>
                <td className="px-3 py-3">
                  <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono">{l.futuresMonth}</span>
                </td>
                <td className="px-3 py-3 text-slate-300">{l.lots}</td>
                <td className="px-3 py-3 text-slate-300 font-mono">{centsToUsd(l.futuresBuyPrice)}</td>
                <td className="px-3 py-3 text-emerald-400 font-mono">{centsToUsd(l.futuresSellPrice)}</td>
                <td className={cn("px-3 py-3 font-mono font-semibold", pnlColor)}>
                  {l.gainLossCentsBu != null ? `${l.gainLossCentsBu > 0 ? "+" : ""}${(l.gainLossCentsBu / 100).toFixed(4)}` : "\u2013"}
                </td>
                <td className={cn("px-3 py-3 font-semibold", pnlColor)}>
                  {l.gainLossUsd != null ? fmtPnl(l.gainLossUsd) : "\u2013"}
                </td>
                <td className="px-3 py-3 text-emerald-400 font-mono">{centsToUsd(l.boardPrice)}</td>
                <td className="px-3 py-3 text-slate-400 font-mono">{l.basisValue != null ? (l.basisValue / 100).toFixed(4) : "\u2013"}</td>
                <td className="px-3 py-3 text-slate-400 font-mono">{fmt2(l.freightValue)}</td>
                <td className="px-3 py-3 text-emerald-300 font-semibold">{fmtUsd(l.allInPricePerMt)}</td>
                <td className="px-3 py-3">
                  {l.effectiveAllInPerMt != null ? (
                    <span className="text-cyan-300 font-semibold">{fmtUsd(l.effectiveAllInPerMt)}</span>
                  ) : <span className="text-slate-600">\u2013</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Offsets Table ───────────────────────────────────────────────────────────

function OffsetsTable({ offsets }: { offsets: OffsetItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Trade", "ZC", "Lots", "Bushels", "Entry $/bu", "Exit $/bu", "P&L \u00a2/bu", "P&L $", "Site", "Date", "Notes"].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offsets.length === 0 && (
            <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500 text-sm">No closed offsets</td></tr>
          )}
          {offsets.map((o) => {
            const pnlColor = o.pnlCentsBu > 0 ? "text-emerald-400" : o.pnlCentsBu < 0 ? "text-red-400" : "text-slate-400";
            return (
              <tr key={o.offsetId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-200 text-xs">{o.tradeRef}</td>
                <td className="px-4 py-3">
                  <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono">{o.futuresMonth}</span>
                </td>
                <td className="px-4 py-3 text-slate-300">{o.lots}</td>
                <td className="px-4 py-3 text-slate-300">{fmtBu(o.bushels)}</td>
                <td className="px-4 py-3 text-slate-300 font-mono">{centsToUsd(o.entryPrice)}</td>
                <td className="px-4 py-3 text-slate-200 font-mono">{centsToUsd(o.exitPrice)}</td>
                <td className={cn("px-4 py-3 font-mono font-semibold", pnlColor)}>
                  {o.pnlCentsBu > 0 ? "+" : ""}{(o.pnlCentsBu / 100).toFixed(4)}
                </td>
                <td className={cn("px-4 py-3 font-semibold", pnlColor)}>{fmtPnl(o.pnlUsd)}</td>
                <td className="px-4 py-3">
                  {o.siteCode ? <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{o.siteCode}</span>
                    : <span className="text-slate-600 text-xs">Pool</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs font-mono">{o.offsetDate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{o.notes || "\u2013"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Budget Month Navigator ─────────────────────────────────────────────────

function BudgetMonthNavigator({
  months,
  selected,
  onChange,
}: {
  months: string[];
  selected: string | null;
  onChange: (m: string | null) => void;
}) {
  function goPrev() {
    if (selected === null) {
      onChange(months[months.length - 1]);
    } else {
      const idx = months.indexOf(selected);
      onChange(idx <= 0 ? null : months[idx - 1]);
    }
  }
  function goNext() {
    if (selected === null) {
      onChange(months[0]);
    } else {
      const idx = months.indexOf(selected);
      onChange(idx >= months.length - 1 ? null : months[idx + 1]);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goPrev}
        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-700"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-[120px] text-center">
        <span className={cn(
          "text-sm font-semibold",
          selected ? "text-slate-100" : "text-slate-400"
        )}>
          {selected ? monthLabel(selected) : "All Months"}
        </span>
      </div>
      <button
        onClick={goNext}
        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors border border-slate-700"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Month Coverage Summary ─────────────────────────────────────────────────

function MonthCoverageSummary({
  budgetMonth,
  budgetLines,
  allocations,
  settles,
  siteFilter,
}: {
  budgetMonth: string;
  budgetLines: CornBudgetLineResponse[];
  allocations: SiteAllocationItem[];
  settles: Record<string, number>;
  siteFilter: string;
}) {
  const summary = useMemo(() => {
    // Find matching budget lines for this month (and optionally site)
    let lines = budgetLines.filter((l) => l.budgetMonth === budgetMonth);
    if (siteFilter) lines = lines.filter((l) => l.siteCode === siteFilter);

    if (lines.length === 0) return null;

    const budgetMt = lines.reduce((s, l) => s + l.budgetVolumeMt, 0);
    const hedgedMt = lines.reduce((s, l) => s + (l.hedgedVolumeMt ?? 0), 0);
    const coveragePct = budgetMt > 0 ? (hedgedMt / budgetMt) * 100 : 0;

    // Target all-in: weighted average from budget lines
    let sumPriceVol = 0, sumVol = 0;
    for (const l of lines) {
      if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
        sumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
        sumVol += l.budgetVolumeMt;
      }
    }
    const targetAllIn = sumVol > 0 ? sumPriceVol / sumVol : null;

    // Market estimate for unhedged portion
    const futuresMonth = suggestFuturesMonth(budgetMonth);
    const settleCents = futuresMonth ? settles[futuresMonth] : null;
    let marketEst: number | null = null;
    if (settleCents != null) {
      // Get average basis/freight from budget components
      let totalBasis = 0, totalFreight = 0, basisCount = 0, freightCount = 0;
      for (const l of lines) {
        for (const c of l.components) {
          const name = c.componentName.toLowerCase();
          if (name.includes("basis")) {
            const perMt = c.unit === "$/bu" ? c.targetValue * BUSHELS_PER_MT
              : c.unit === "\u00a2/bu" ? (c.targetValue / 100) * BUSHELS_PER_MT
              : c.targetValue;
            totalBasis += perMt;
            basisCount++;
          } else if (name.includes("freight")) {
            const perMt = c.unit === "$/bu" ? c.targetValue * BUSHELS_PER_MT
              : c.unit === "\u00a2/bu" ? (c.targetValue / 100) * BUSHELS_PER_MT
              : c.targetValue;
            totalFreight += perMt;
            freightCount++;
          }
        }
      }
      const avgBasisPerMt = basisCount > 0 ? totalBasis / basisCount : 0;
      const avgFreightPerMt = freightCount > 0 ? totalFreight / freightCount : 0;
      const boardPerMt = (settleCents / 100) * BUSHELS_PER_MT;
      marketEst = boardPerMt + avgBasisPerMt + avgFreightPerMt;
    }

    return { budgetMt, hedgedMt, coveragePct, targetAllIn, marketEst, futuresMonth };
  }, [budgetMonth, budgetLines, siteFilter, settles]);

  if (!summary) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-5 py-4">
        <p className="text-sm text-slate-500">No budget data for {monthLabel(budgetMonth)}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-5 py-4 space-y-3">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Budget</p>
          <p className="text-lg font-bold tabular-nums text-slate-100">
            {fmtMt(summary.budgetMt)} <span className="text-xs text-slate-500 font-normal">MT</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Hedged</p>
          <p className="text-lg font-bold tabular-nums text-slate-100">
            {fmtMt(summary.hedgedMt)} <span className="text-xs text-slate-500 font-normal">MT</span>
          </p>
          <p className="text-xs tabular-nums text-emerald-400 font-medium">
            {summary.coveragePct.toFixed(0)}% covered
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Target All-In</p>
          <p className="text-lg font-bold tabular-nums text-slate-100">
            {summary.targetAllIn != null ? `$${fmt2(summary.targetAllIn)}` : "\u2013"}
            <span className="text-xs text-slate-500 font-normal">/MT</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-amber-400/80 uppercase tracking-wider mb-1">Market Est (Unhedged)</p>
          <p className={cn("text-lg font-bold tabular-nums", summary.marketEst != null ? "text-amber-300" : "text-slate-500")}>
            {summary.marketEst != null ? `$${fmt2(summary.marketEst)}` : "\u2013"}
            <span className="text-xs text-slate-500 font-normal">/MT</span>
          </p>
          {summary.futuresMonth && summary.marketEst != null && (
            <p className="text-xs text-slate-600">via {summary.futuresMonth} settle</p>
          )}
        </div>
      </div>
      {/* Coverage progress bar */}
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all"
          style={{ width: `${Math.min(summary.coveragePct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Book = "CANADA" | "US";

export default function PositionsPage() {
  const [book, setBook] = useState<Book>("CANADA");
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const [settleOpen, setSettleOpen] = useState(false);
  const [siteFilter, setSiteFilter] = useState("");
  const [budgetMonth, setBudgetMonth] = useState<string | null>(null);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);

  // Settings for fiscal year
  const { settings } = useAppSettings();
  const fyStartMonth = parseInt(settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH")?.value ?? "7") || 7;
  const fyMonths = useMemo(() => fiscalYearMonths(currentFiscalYear(fyStartMonth), fyStartMonth), [fyStartMonth]);

  // Budget data for coverage summary
  const { budget: budgetLines } = useBudget(siteFilter || undefined, currentFiscalYear(fyStartMonth) || undefined);

  // Derived futures month from selected budget month
  const activeFuturesMonth = budgetMonth ? suggestFuturesMonth(budgetMonth) : null;

  const hedgeBook   = positions?.hedgeBook         ?? [];
  const allocations = positions?.siteAllocations   ?? [];
  const physical    = positions?.physicalPositions  ?? [];
  const locked      = positions?.lockedPositions    ?? [];
  const offsets     = positions?.offsets            ?? [];
  const settles     = positions?.latestSettles      ?? {};

  // Hedge book filtered by budget month
  const filteredHedgeBook = useMemo(() => {
    if (!activeFuturesMonth) return hedgeBook;
    return hedgeBook.filter((h) => h.futuresMonth === activeFuturesMonth);
  }, [hedgeBook, activeFuturesMonth]);

  // Client-side site + month filter
  const filteredAllocations = useMemo(() => {
    let result = allocations;
    if (siteFilter) result = result.filter((a) => a.siteCode === siteFilter);
    if (budgetMonth) result = result.filter((a) => a.budgetMonth === budgetMonth);
    return result;
  }, [allocations, siteFilter, budgetMonth]);

  const filteredPhysical = useMemo(() => {
    let result = physical;
    if (siteFilter) result = result.filter((p) => p.siteCode === siteFilter);
    if (budgetMonth) result = result.filter((p) => p.deliveryMonth === budgetMonth);
    return result;
  }, [physical, siteFilter, budgetMonth]);

  const filteredLocked = useMemo(() => {
    let result = locked;
    if (siteFilter) result = result.filter((l) => l.siteCode === siteFilter);
    if (budgetMonth) result = result.filter((l) => l.deliveryMonth === budgetMonth);
    return result;
  }, [locked, siteFilter, budgetMonth]);

  // Unique sites from data
  const dataSites = useMemo(() => {
    const codes = new Set([
      ...allocations.map((a) => a.siteCode),
      ...physical.map((p) => p.siteCode),
      ...locked.map((l) => l.siteCode),
    ]);
    return Array.from(codes).sort();
  }, [allocations, physical, locked]);

  // All unique futures months for settle publisher
  const allFuturesMonths = useMemo(() => {
    const months = new Set<string>();
    hedgeBook.forEach((h) => months.add(h.futuresMonth));
    allocations.forEach((a) => months.add(a.futuresMonth));
    return Array.from(months).sort();
  }, [hedgeBook, allocations]);

  const bookLabel = book === "CANADA" ? "Canada" : "US";
  const filterLabel = [siteFilter, budgetMonth ? monthLabel(budgetMonth) : ""].filter(Boolean).join(" \u2014 ");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-100">Position Manager</h1>
        <SkeletonTable rows={3} cols={8} />
        <SkeletonTable rows={4} cols={8} />
      </div>
    );
  }

  if (error) {
    return <EmptyState icon={AlertCircle} title="Failed to load positions" description={error.message} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">Position Manager</h1>
        </div>
        <button
          onClick={() => setSettleOpen((o) => !o)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg font-medium border border-slate-700 transition-colors"
        >
          <TrendingUp className="h-4 w-4 text-blue-400" />
          Publish Settle Prices
          {settleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Book toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => { setBook(b); setSiteFilter(""); setBudgetMonth(null); }}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                book === b ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
            </button>
          ))}
        </div>
      </div>

      {/* Settle publisher */}
      {settleOpen && (
        <SettlePublisher
          futuresMonths={allFuturesMonths.length > 0 ? allFuturesMonths : ["ZCH26", "ZCK26", "ZCN26"]}
          existingSettles={settles}
          onDone={() => { setSettleOpen(false); mutate(); }}
        />
      )}

      {/* Panel 1 — Hedge Book */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Hedge Book &mdash; {bookLabel}
              {activeFuturesMonth && <span className="ml-2 text-blue-400">({activeFuturesMonth})</span>}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredHedgeBook.length} trade{filteredHedgeBook.length !== 1 ? "s" : ""} &middot;{" "}
              {fmtBu(filteredHedgeBook.reduce((s, h) => s + h.unallocatedBushels, 0))} bu unallocated
            </p>
          </div>
          <span className="text-xs text-slate-600">Grouped by futures month. Click to expand.</span>
        </div>
        <HedgeBookTable
          hedgeBook={filteredHedgeBook}
          sites={sites}
          onRefresh={() => mutate()}
          autoExpandMonth={activeFuturesMonth}
        />
      </div>

      {/* ─── Site Filter + Month Navigator ────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-3">
        {dataSites.length > 0 && (
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All</option>
            {dataSites.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        )}
        <BudgetMonthNavigator
          months={fyMonths}
          selected={budgetMonth}
          onChange={setBudgetMonth}
        />
        {budgetMonth && (
          <span className="text-xs text-slate-600">
            Futures: <span className="text-blue-400 font-mono">{activeFuturesMonth}</span>
          </span>
        )}
      </div>

      {/* Month Coverage Summary — only when a specific month is selected */}
      {budgetMonth && (
        <MonthCoverageSummary
          budgetMonth={budgetMonth}
          budgetLines={budgetLines}
          allocations={filteredAllocations}
          settles={settles}
          siteFilter={siteFilter}
        />
      )}

      {/* Panel 2 — Hedges (renamed from Allocated Futures) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            Hedges{filterLabel && ` \u2014 ${filterLabel}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredAllocations.length} allocation{filteredAllocations.length !== 1 ? "s" : ""} &middot;{" "}
            {fmtBu(filteredAllocations.reduce((s, a) => s + a.allocatedBushels, 0))} bu allocated
          </p>
        </div>
        <SiteAllocationsTable
          allocations={filteredAllocations}
          physicalPositions={filteredPhysical}
          sites={sites}
          settles={settles}
          onRefresh={() => mutate()}
        />
      </div>

      {/* Panel 3 — Physical Commitments */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Physical Commitments{filterLabel && ` \u2014 ${filterLabel}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredPhysical.length} contract{filteredPhysical.length !== 1 ? "s" : ""} &middot;{" "}
              {fmtMt(filteredPhysical.reduce((s, p) => s + p.committedMt, 0))} MT committed
            </p>
          </div>
          <button
            onClick={() => setNewPurchaseOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Purchase
          </button>
        </div>
        {newPurchaseOpen && (
          <div className="px-5 py-4 border-b border-slate-800">
            <NewPurchaseForm
              siteCode={siteFilter}
              sites={sites}
              onDone={() => { setNewPurchaseOpen(false); mutate(); }}
              onCancel={() => setNewPurchaseOpen(false)}
            />
          </div>
        )}
        <PhysicalPositionsTable positions={filteredPhysical} settles={settles} />
      </div>

      {/* Panel 4 — Locked Positions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            Locked Positions &mdash; EFP Executed{filterLabel && ` \u2014 ${filterLabel}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredLocked.length} EFP ticket{filteredLocked.length !== 1 ? "s" : ""} &middot;{" "}
            {filteredLocked.reduce((s, l) => s + l.lots, 0)} lots locked
          </p>
        </div>
        <LockedPositionsTable locked={filteredLocked} />
      </div>

      {/* Panel 5 — Closed Offsets (no month filter) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Closed Offsets</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {offsets.length} offset{offsets.length !== 1 ? "s" : ""}
            {offsets.length > 0 && (
              <> &middot; Total P&L: <span className={cn("font-semibold",
                offsets.reduce((s, o) => s + o.pnlUsd, 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                {fmtPnl(offsets.reduce((s, o) => s + o.pnlUsd, 0))}
              </span></>
            )}
          </p>
        </div>
        <OffsetsTable offsets={offsets} />
      </div>
    </div>
  );
}
