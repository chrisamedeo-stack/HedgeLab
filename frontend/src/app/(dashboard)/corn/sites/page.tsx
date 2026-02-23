"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  MapPin,
  ChevronDown,
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
import {
  fmtVol,
  fmt2,
  fmtBu,
  fmtPnl,
  fmtUsd,
  centsToUsd,
  today,
  inputCls,
  btnPrimary,
  btnSecondary,
  statusColor,
} from "@/lib/corn-format";
import type { Unit } from "@/lib/corn-format";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

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
        exitPrice: exit * 100,
        offsetDate,
        notes: notes || null,
      });
      toast.toast(`Offset ${fmtBu(bu)} bu \u00b7 P&L: ${fmtPnl(pnlPreview)}`, "success");
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
  const [tradeType, setTradeType] = useState<"BASIS" | "INDEX" | "ALL_IN">("BASIS");
  const [boardPriceBu, setBoardPriceBu] = useState("");
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
      const boardVal = parseFloat(boardPriceBu);
      await api.post("/api/v1/corn/contracts", {
        siteCode: site,
        supplierName: supplier || null,
        deliveryMonth,
        quantityMt: parseFloat(quantityMt),
        basisCentsBu: (tradeType === "BASIS" || tradeType === "ALL_IN") && basisCentsBu ? parseFloat(basisCentsBu) : null,
        boardPriceCentsBu: tradeType === "ALL_IN" && !isNaN(boardVal) ? boardVal * 100 : null,
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
        {(["BASIS", "ALL_IN", "INDEX"] as const).map((t) => (
          <button key={t} onClick={() => setTradeType(t)}
            className={cn("px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
              tradeType === t ? (t === "BASIS" ? "bg-blue-600 text-white" : t === "ALL_IN" ? "bg-emerald-600 text-white" : "bg-amber-600 text-white") : "text-slate-400 hover:text-slate-200")}>
            {t === "ALL_IN" ? "ALL-IN" : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Site</label>
          <select value={site} onChange={(e) => setSite(e.target.value)} className={inputCls}>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Supplier</label>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
            <option value="">Select&hellip;</option>
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
        {(tradeType === "BASIS" || tradeType === "ALL_IN") && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Basis (&cent;/bu)</label>
            <input type="number" step="1" value={basisCentsBu} onChange={(e) => setBasisCentsBu(e.target.value)}
              placeholder="e.g. -20" className={inputCls} />
          </div>
        )}
        {(tradeType === "BASIS" || tradeType === "ALL_IN") && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Futures Ref</label>
            <input type="text" value={futuresRef} onChange={(e) => setFuturesRef(e.target.value)}
              placeholder="e.g. ZCN26" className={inputCls} />
          </div>
        )}
        {tradeType === "ALL_IN" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Board Price ($/bu)</label>
            <input type="number" step="0.0025" value={boardPriceBu} onChange={(e) => setBoardPriceBu(e.target.value)}
              placeholder="e.g. 4.55" className={inputCls} />
          </div>
        )}
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
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional&hellip;" className={inputCls} />
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
      toast.toast(`EFP executed \u00b7 ${lotsN} lots from ${allocation.tradeRef}`, "success");
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
          Execute EFP &middot; {allocation.tradeRef} &gt; {allocation.siteCode}
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
            <option value="">Select contract&hellip;</option>
            {eligible.map((p) => (
              <option key={p.contractId} value={p.contractId}>
                {p.contractRef} &middot; {p.deliveryMonth}
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
          <input type="text" value={confirmRef} onChange={(e) => setConfirmRef(e.target.value)} placeholder="Broker ref&hellip;" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional&hellip;" className={inputCls} />
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

// ─── Site Allocations Table ─────────────────────────────────────────────────

function SiteAllocationsTable({
  allocations,
  physicalPositions,
  sites,
  settles,
  onRefresh,
  unit,
}: {
  allocations: SiteAllocationItem[];
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  onRefresh: () => void;
  unit: Unit;
}) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
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
            {["Trade", "Dir", "Date", "ZC", "Site", "Month", `Alloc ${unitLabel}`, `Open ${unitLabel}`, "Entry $/bu", "Settle $/bu", "Basis", "MTM", ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allocations.length === 0 && (
            <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-500 text-sm">No allocations yet</td></tr>
          )}
          {allocations.map((a) => {
            const isEfp = efpAllocId === a.allocationId;
            const isOffset = offsetAllocId === a.allocationId;
            return (
              <Fragment key={a.allocationId}>
                <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-200 text-xs">{a.tradeRef}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold",
                      a.side === "SHORT" ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"
                    )}>{a.side || "LONG"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{a.tradeDate}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">{a.futuresMonth}</span>
                  </td>
                  <td className="px-4 py-3"><span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span></td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{a.budgetMonth}</td>
                  <td className="px-4 py-3 text-slate-300">{fmtVol(a.allocatedBushels, "BU", unit)}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">{fmtVol(a.openAllocatedLots * 5000, "BU", unit)}</td>
                  <td className="px-4 py-3 text-slate-300 font-mono">{centsToUsd(a.entryPrice)}</td>
                  <td className="px-4 py-3 font-mono">
                    {a.settlePrice != null ? <span className="text-slate-200">{centsToUsd(a.settlePrice)}</span>
                      : <span className="text-slate-600 italic text-xs">no settle</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const matchingContract = physicalPositions.find(
                        (p) => p.siteCode === a.siteCode && p.deliveryMonth === a.budgetMonth && p.basisLocked
                      );
                      if (matchingContract) {
                        return (
                          <span className="flex items-center gap-1 text-blue-300 font-mono text-xs">
                            <Lock className="h-3 w-3 text-blue-400" />
                            {matchingContract.basisValue != null ? (matchingContract.basisValue / 100).toFixed(4) : "\u2013"}
                          </span>
                        );
                      }
                      return <span className="text-orange-400 italic text-xs">Open</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {a.mtmPnlUsd != null ? (
                      <span className={cn("font-semibold", a.mtmPnlUsd > 0 ? "text-emerald-400" : a.mtmPnlUsd < 0 ? "text-red-400" : "text-slate-400")}>
                        {fmtPnl(a.mtmPnlUsd)}
                      </span>
                    ) : <span className="text-slate-600 italic text-xs">&ndash;</span>}
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
                    <td colSpan={13} className="px-4 py-3">
                      <EFPForm allocation={a} physicalPositions={physicalPositions} sites={sites} settles={settles} onDone={handleDone} onCancel={() => setEfpAllocId(null)} />
                    </td>
                  </tr>
                )}
                {isOffset && (
                  <tr className="border-t border-slate-800">
                    <td colSpan={13} className="px-4 py-3">
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

// ─── Site Cost Summary Card ──────────────────────────────────────────────────

function SiteCostSummary({
  physicalPositions,
  lockedPositions,
  offsets,
  siteCode,
  unit,
}: {
  physicalPositions: PhysicalPositionItem[];
  lockedPositions: LockedPositionItem[];
  offsets: OffsetItem[];
  siteCode: string;
  unit: Unit;
}) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
  const summary = useMemo(() => {
    const contracts = physicalPositions.filter((p) => p.siteCode === siteCode);
    const efps = lockedPositions.filter((l) => l.siteCode === siteCode);
    const siteOffsets = offsets.filter((o) => o.siteCode === siteCode);

    if (contracts.length === 0 && efps.length === 0) return null;

    const totalVolume = contracts.reduce((s, c) => s + c.committedMt, 0);

    const efpPnl = efps.reduce((s, e) => s + (e.gainLossUsd ?? 0), 0);
    const offsetPnl = siteOffsets.reduce((s, o) => s + o.pnlUsd, 0);
    const hedgePnl = efpPnl + offsetPnl;

    let basisWeightedSum = 0, basisVolume = 0;
    for (const e of efps) {
      if (e.basisValue != null) {
        basisWeightedSum += e.basisValue * e.quantityMt;
        basisVolume += e.quantityMt;
      }
    }
    const avgBasisCents = basisVolume > 0 ? basisWeightedSum / basisVolume : null;

    let freightWeightedSum = 0, freightVolume = 0;
    for (const e of efps) {
      if (e.freightValue != null) {
        freightWeightedSum += e.freightValue * e.quantityMt;
        freightVolume += e.quantityMt;
      }
    }
    const avgFreight = freightVolume > 0 ? freightWeightedSum / freightVolume : null;

    let boardWeightedSum = 0, boardVolume = 0;
    for (const e of efps) {
      if (e.boardPrice != null) {
        boardWeightedSum += e.boardPrice * e.quantityMt;
        boardVolume += e.quantityMt;
      }
    }
    const avgBoardCents = boardVolume > 0 ? boardWeightedSum / boardVolume : null;

    let blendedAllIn: number | null = null;
    if (avgBoardCents != null && avgBasisCents != null) {
      const rawPerMt = ((avgBoardCents + avgBasisCents) / 100) * BUSHELS_PER_MT + (avgFreight ?? 0);
      const hedgePnlPerMt = totalVolume > 0 ? hedgePnl / totalVolume : 0;
      blendedAllIn = rawPerMt - hedgePnlPerMt;
    }

    return { totalVolume, hedgePnl, avgBasisCents, avgFreight, avgBoardCents, blendedAllIn };
  }, [physicalPositions, lockedPositions, offsets, siteCode]);

  if (!summary) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Site Cost Summary</h3>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Total Volume</p>
          <p className="text-sm font-bold tabular-nums text-slate-100">{fmtVol(summary.totalVolume, "MT", unit)} <span className="text-xs text-slate-500 font-normal">{unitLabel}</span></p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Hedge P&L</p>
          <p className={cn("text-sm font-bold tabular-nums", summary.hedgePnl > 0 ? "text-emerald-400" : summary.hedgePnl < 0 ? "text-red-400" : "text-slate-300")}>
            {fmtPnl(summary.hedgePnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Avg Basis</p>
          <p className="text-sm font-bold tabular-nums text-slate-100 font-mono">
            {summary.avgBasisCents != null ? `${(summary.avgBasisCents / 100).toFixed(4)} $/bu` : "\u2013"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Avg Freight</p>
          <p className="text-sm font-bold tabular-nums text-slate-100">
            {summary.avgFreight != null ? fmtUsd(summary.avgFreight) + "/MT" : "\u2013"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Board Cost</p>
          <p className="text-sm font-bold tabular-nums text-slate-100 font-mono">
            {summary.avgBoardCents != null ? `${(summary.avgBoardCents / 100).toFixed(4)} $/bu` : "\u2013"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Blended All-In</p>
          <p className={cn("text-sm font-bold tabular-nums", summary.blendedAllIn != null ? "text-cyan-300" : "text-slate-500")}>
            {summary.blendedAllIn != null ? `${fmtUsd(summary.blendedAllIn)}/MT` : "\u2013"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Physical Positions Table ────────────────────────────────────────────────

function tradeTypeBadge(type: string) {
  if (type === "INDEX") return <span className="bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25 px-2 py-0.5 rounded text-xs font-mono font-semibold">INDEX</span>;
  if (type === "ALL_IN") return <span className="bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25 px-2 py-0.5 rounded text-xs font-mono font-semibold">ALL-IN</span>;
  return <span className="bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25 px-2 py-0.5 rounded text-xs font-mono font-semibold">BASIS</span>;
}

function PhysicalPositionsTable({
  positions,
  settles,
  unit,
}: {
  positions: PhysicalPositionItem[];
  settles: Record<string, number>;
  unit: Unit;
}) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
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
        const settle = p.futuresRef ? settles[p.futuresRef] : null;
        if (settle != null) {
          const basisCents = p.basisValue ?? 0;
          const freightEst = 0;
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
              {["Type", "Month", "Site", "Contract", "Supplier", unitLabel, "Board", "Basis", "Freight", "All-In $/MT", "Status"].map((h) => (
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
                <td className="px-4 py-3 text-slate-300">{fmtVol(p.committedMt, "MT", unit)}</td>
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
                    <span className="text-slate-600 italic text-xs">&ndash;</span>
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

      {positions.length > 0 && blended.blendedPerMt != null && (
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-800/30">
          <span className="text-xs text-slate-400">
            Blended Cost: <span className="text-emerald-300 font-semibold">{fmtUsd(blended.blendedPerMt)}/MT</span>
            {blended.hedgedVol > 0 && <span> (hedged: {fmtUsd(blended.hedgedPerMt)}/MT x {fmtVol(blended.hedgedVol, "MT", unit)} {unitLabel}</span>}
            {blended.marketVol > 0 && <span>{blended.hedgedVol > 0 ? " + " : " ("}market: {fmtUsd(blended.marketPerMt)}/MT x {fmtVol(blended.marketVol, "MT", unit)} {unitLabel}</span>}
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
                  ) : <span className="text-slate-600">&ndash;</span>}
                </td>
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
  unit,
}: {
  budgetMonth: string;
  budgetLines: CornBudgetLineResponse[];
  allocations: SiteAllocationItem[];
  settles: Record<string, number>;
  siteFilter: string;
  unit: Unit;
}) {
  const unitLabel = unit === "MT" ? "MT" : "bu";
  const summary = useMemo(() => {
    let lines = budgetLines.filter((l) => l.budgetMonth === budgetMonth);
    if (siteFilter) lines = lines.filter((l) => l.siteCode === siteFilter);

    if (lines.length === 0) return null;

    const budgetMt = lines.reduce((s, l) => s + l.budgetVolumeMt, 0);
    const hedgedMt = lines.reduce((s, l) => s + (l.hedgedVolumeMt ?? 0), 0);
    const coveragePct = budgetMt > 0 ? (hedgedMt / budgetMt) * 100 : 0;

    let sumPriceVol = 0, sumVol = 0;
    for (const l of lines) {
      if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
        sumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
        sumVol += l.budgetVolumeMt;
      }
    }
    const targetAllIn = sumVol > 0 ? sumPriceVol / sumVol : null;

    const futuresMonth = suggestFuturesMonth(budgetMonth);
    const settleCents = futuresMonth ? settles[futuresMonth] : null;
    let marketEst: number | null = null;
    if (settleCents != null) {
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
            {fmtVol(summary.budgetMt, "MT", unit)} <span className="text-xs text-slate-500 font-normal">{unitLabel}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Hedged</p>
          <p className="text-lg font-bold tabular-nums text-slate-100">
            {fmtVol(summary.hedgedMt, "MT", unit)} <span className="text-xs text-slate-500 font-normal">{unitLabel}</span>
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

export default function SitesPage() {
  const [book, setBook] = useState<Book>("CANADA");
  const [unit, setUnit] = useState<Unit>("MT");
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const [siteFilter, setSiteFilter] = useState("");
  const [budgetMonth, setBudgetMonth] = useState<string | null>(null);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);

  // Settings for fiscal year
  const { settings } = useAppSettings();
  const fyStartMonth = parseInt(settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH")?.value ?? "7") || 7;
  const fyMonths = useMemo(() => fiscalYearMonths(currentFiscalYear(fyStartMonth), fyStartMonth), [fyStartMonth]);

  // Budget data for coverage summary
  const { budget: budgetLines } = useBudget(siteFilter || undefined, currentFiscalYear(fyStartMonth) || undefined);

  const allocations = positions?.siteAllocations   ?? [];
  const physical    = positions?.physicalPositions  ?? [];
  const locked      = positions?.lockedPositions    ?? [];
  const offsets     = positions?.offsets            ?? [];
  const settles     = positions?.latestSettles      ?? {};

  // Unique sites from data
  const dataSites = useMemo(() => {
    const codes = new Set([
      ...allocations.map((a) => a.siteCode),
      ...physical.map((p) => p.siteCode),
      ...locked.map((l) => l.siteCode),
    ]);
    return Array.from(codes).sort();
  }, [allocations, physical, locked]);

  // Site tab labels
  const dataSitesMapped = useMemo(() => {
    return dataSites.map((code) => {
      const match = sites.find((s) => s.code === code);
      return { code, name: match?.name ?? code };
    });
  }, [dataSites, sites]);

  // Restore unit toggle from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pos-unit");
    if (saved === "BU" || saved === "MT") setUnit(saved);
  }, []);

  function toggleUnit() {
    setUnit((prev) => {
      const next = prev === "MT" ? "BU" : "MT";
      localStorage.setItem("pos-unit", next);
      return next;
    });
  }

  const unitLabel = unit === "MT" ? "MT" : "bu";

  // Auto-select first site when data loads
  useEffect(() => {
    if (dataSites.length > 0) {
      if (!siteFilter || !dataSites.includes(siteFilter)) {
        setSiteFilter(dataSites[0]);
      }
    }
  }, [dataSites, siteFilter]);

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

  const filterLabel = [siteFilter, budgetMonth ? monthLabel(budgetMonth) : ""].filter(Boolean).join(" \u00b7 ");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Sites</h1>
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
      <div className="flex items-center gap-3">
        <MapPin className="h-5 w-5 text-blue-400" />
        <h1 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Sites</h1>
      </div>

      {/* Controls: Book + Unit toggle */}
      <div className="flex items-center gap-4">
        {/* Book toggle */}
        <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
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

        {/* Unit toggle */}
        <button
          onClick={toggleUnit}
          className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl"
        >
          {(["MT", "BU"] as Unit[]).map((u) => (
            <span
              key={u}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                unit === u ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
              )}
            >
              {u === "MT" ? "Metric Tons" : "Bushels"}
            </span>
          ))}
        </button>
      </div>

      {/* Site tabs + Month Navigator */}
      <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-3">
        {dataSitesMapped.length > 0 ? (
          <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            {dataSitesMapped.map((s) => (
              <button
                key={s.code}
                onClick={() => { setSiteFilter(s.code); setBudgetMonth(null); }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  siteFilter === s.code ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                )}
              >
                {s.code} &middot; {s.name}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-slate-500">No sites with data</span>
        )}

        {/* Divider */}
        <div className="w-px h-8 bg-slate-700" />

        <BudgetMonthNavigator
          months={fyMonths}
          selected={budgetMonth}
          onChange={setBudgetMonth}
        />
        {budgetMonth && (
          <span className="text-xs text-slate-600">
            Futures: <span className="text-blue-400 font-mono">{suggestFuturesMonth(budgetMonth)}</span>
          </span>
        )}
      </div>

      {/* Month Coverage Summary */}
      {budgetMonth && siteFilter && (
        <MonthCoverageSummary
          budgetMonth={budgetMonth}
          budgetLines={budgetLines}
          allocations={filteredAllocations}
          settles={settles}
          siteFilter={siteFilter}
          unit={unit}
        />
      )}

      {/* Allocated Hedges */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            Allocated Hedges{filterLabel && ` \u00b7 ${filterLabel}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredAllocations.length} allocation{filteredAllocations.length !== 1 ? "s" : ""} &middot;{" "}
            {fmtVol(filteredAllocations.reduce((s, a) => s + a.allocatedBushels, 0), "BU", unit)} {unitLabel} allocated
          </p>
        </div>
        <SiteAllocationsTable
          allocations={filteredAllocations}
          physicalPositions={filteredPhysical}
          sites={sites}
          settles={settles}
          onRefresh={() => mutate()}
          unit={unit}
        />
      </div>

      {/* Physical Commitments */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Physical Commitments{filterLabel && ` \u00b7 ${filterLabel}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {filteredPhysical.length} contract{filteredPhysical.length !== 1 ? "s" : ""} &middot;{" "}
              {fmtVol(filteredPhysical.reduce((s, p) => s + p.committedMt, 0), "MT", unit)} {unitLabel} committed
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
        <PhysicalPositionsTable positions={filteredPhysical} settles={settles} unit={unit} />
      </div>

      {/* Site Cost Summary */}
      {siteFilter && (
        <SiteCostSummary
          physicalPositions={physical}
          lockedPositions={locked}
          offsets={offsets}
          siteCode={siteFilter}
          unit={unit}
        />
      )}

      {/* Locked Positions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            Locked Positions &middot; EFP Executed{filterLabel && ` \u00b7 ${filterLabel}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredLocked.length} EFP ticket{filteredLocked.length !== 1 ? "s" : ""} &middot;{" "}
            {filteredLocked.reduce((s, l) => s + l.lots, 0)} lots locked
          </p>
        </div>
        <LockedPositionsTable locked={filteredLocked} />
      </div>
    </div>
  );
}
