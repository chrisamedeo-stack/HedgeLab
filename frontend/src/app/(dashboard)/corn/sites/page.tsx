"use client";

import { useState, useMemo, useEffect, Fragment, useCallback } from "react";
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
  fmtPerBu,
  today,
  inputCls,
  btnPrimary,
  btnCancel,
  pnlColor,
} from "@/lib/corn-format";
import { TradeTypeBadge, ContractStatusBadge, SideBadge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/SortableHeader";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

const zcBadgeCls = "bg-input-bg text-secondary ring-1 ring-b-input px-2 py-0.5 rounded text-xs font-mono font-semibold";

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
      ? (exit - entryPrice) * bu
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
        exitPrice: exit,
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
    <div className="bg-input-bg/70 border border-b-input rounded-lg p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ArrowRightLeft className="h-4 w-4 text-muted" />
        <span className="text-sm font-semibold text-secondary">Offset Futures</span>
        <span className="ml-auto text-xs text-faint">{fmtBu(availableBu)} bu available</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Bushels</label>
          <input type="number" step={5000} min={5000} value={bushels} onChange={(e) => setBushels(e.target.value)}
            placeholder="e.g. 10000" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Exit Price ($/bu)</label>
          <input type="number" step="0.0025" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)}
            placeholder="e.g. 4.55" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Offset Date</label>
          <input type="date" value={offsetDate} onChange={(e) => setOffsetDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional\u2026" className={inputCls} />
        </div>
      </div>
      {pnlPreview != null && (
        <div className={cn("text-xs mb-3 font-medium", pnlPreview >= 0 ? "text-profit" : "text-destructive")}>
          P&L Preview: {fmtPnl(pnlPreview)} ({lots} lots)
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={btnPrimary}>
          {saving ? "Offsetting\u2026" : "Execute Offset"}
        </button>
        <button onClick={onCancel} className={btnCancel}>Cancel</button>
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tradeType, setTradeType] = useState<"BASIS" | "INDEX" | "ALL_IN">("BASIS");
  const [boardPriceBu, setBoardPriceBu] = useState("");
  const [site, setSite] = useState(siteCode || sites[0]?.code || "");
  const [supplier, setSupplier] = useState("");
  const [deliveryMonth, setDeliveryMonth] = useState("");
  const [quantityMt, setQuantityMt] = useState("");
  const [basisPerBu, setBasisPerBu] = useState("");
  const [futuresRef, setFuturesRef] = useState("");
  const [freightPerMt, setFreightPerMt] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contractDate, setContractDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!site) errs.site = "Site is required";
    if (!deliveryMonth) errs.deliveryMonth = "Delivery month is required";
    if (!quantityMt) errs.quantityMt = "Quantity is required";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const boardVal = parseFloat(boardPriceBu);
      await api.post("/api/v1/corn/contracts", {
        siteCode: site,
        supplierName: supplier || null,
        deliveryMonth,
        quantityMt: parseFloat(quantityMt),
        basisPerBu: (tradeType === "BASIS" || tradeType === "ALL_IN") && basisPerBu ? parseFloat(basisPerBu) : null,
        boardPricePerBu: tradeType === "ALL_IN" && !isNaN(boardVal) ? boardVal : null,
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
    <div className="bg-input-bg/60 border border-b-input rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Plus className="h-4 w-4 text-action" />
        <span className="text-sm font-semibold text-secondary">New Physical Purchase</span>
      </div>

      {/* Trade type toggle */}
      <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg w-fit mb-4">
        {(["BASIS", "ALL_IN", "INDEX"] as const).map((t) => (
          <button key={t} onClick={() => setTradeType(t)}
            className={cn("px-4 py-1.5 rounded-md text-xs font-medium transition-colors",
              tradeType === t ? (t === "BASIS" ? "bg-action text-white" : t === "ALL_IN" ? "bg-profit text-white" : "bg-warning text-white") : "text-muted hover:text-secondary")}>
            {t === "ALL_IN" ? "ALL-IN" : t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <FormField label="Site" error={errors.site}>
          <select value={site} onChange={(e) => { setSite(e.target.value); setErrors((prev) => { const { site: _, ...rest } = prev; return rest; }); }} className={cn(inputCls, errors.site && "border-destructive focus:ring-destructive")}>
            {sites.map((s) => <option key={s.code} value={s.code}>{s.code} &middot; {s.name}</option>)}
          </select>
        </FormField>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Supplier</label>
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls}>
            <option value="">Select&hellip;</option>
            {(suppliers ?? []).map((s: { name: string }) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <FormField label="Delivery Month" error={errors.deliveryMonth}>
          <input type="month" value={deliveryMonth} onChange={(e) => { setDeliveryMonth(e.target.value); setErrors((prev) => { const { deliveryMonth: _, ...rest } = prev; return rest; }); }} className={cn(inputCls, errors.deliveryMonth && "border-destructive focus:ring-destructive")} />
        </FormField>
        <FormField label="Quantity (bushels)" error={errors.quantityMt}>
          <input type="number" step="1000" value={quantityMt} onChange={(e) => { setQuantityMt(e.target.value); setErrors((prev) => { const { quantityMt: _, ...rest } = prev; return rest; }); }}
            placeholder="e.g. 50000" className={cn(inputCls, errors.quantityMt && "border-destructive focus:ring-destructive")} />
        </FormField>
        {(tradeType === "BASIS" || tradeType === "ALL_IN") && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-faint">Basis ($/bu)</label>
            <input type="number" step="1" value={basisPerBu} onChange={(e) => setBasisPerBu(e.target.value)}
              placeholder="e.g. -20" className={inputCls} />
          </div>
        )}
        {(tradeType === "BASIS" || tradeType === "ALL_IN") && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-faint">Futures Ref</label>
            <input type="text" value={futuresRef} onChange={(e) => setFuturesRef(e.target.value)}
              placeholder="e.g. ZCN26" className={inputCls} />
          </div>
        )}
        {tradeType === "ALL_IN" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-faint">Board Price ($/bu)</label>
            <input type="number" step="0.0025" value={boardPriceBu} onChange={(e) => setBoardPriceBu(e.target.value)}
              placeholder="e.g. 4.55" className={inputCls} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Freight ($/bu)</label>
          <input type="number" step="0.01" value={freightPerMt} onChange={(e) => setFreightPerMt(e.target.value)}
            placeholder="e.g. 0.32" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Contract Date</label>
          <input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional&hellip;" className={inputCls} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={btnPrimary}>
          {saving ? "Creating\u2026" : "Create Purchase"}
        </button>
        <button onClick={onCancel} className={btnCancel}>Cancel</button>
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
    settles[allocation.futuresMonth] != null ? String(settles[allocation.futuresMonth]) : ""
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
        boardPrice: parseFloat(boardPrice),
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
    <div className="bg-input-bg/70 border border-b-input rounded-lg p-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-muted" />
        <span className="text-sm font-semibold text-secondary">
          Execute EFP &middot; {allocation.tradeRef} &gt; {allocation.siteCode}
        </span>
        <span className="ml-auto text-xs text-faint">{allocation.openAllocatedLots} lots available</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Lots (max {allocation.openAllocatedLots})</label>
          <input type="number" min={1} max={allocation.openAllocatedLots} value={lots}
            onChange={(e) => setLots(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Physical Contract</label>
          <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={inputCls}>
            <option value="">Select contract&hellip;</option>
            {eligible.map((p) => (
              <option key={p.contractId} value={p.contractId}>
                {p.contractRef} &middot; {p.deliveryMonth}
              </option>
            ))}
          </select>
          {eligible.length === 0 && <span className="text-xs text-warning">No open contracts at {allocation.siteCode}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Board Price ($/bu)</label>
          <input type="number" step="0.0025" value={boardPrice} onChange={(e) => setBoardPrice(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">EFP Date</label>
          <input type="date" value={efpDate} onChange={(e) => setEfpDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Confirm Ref</label>
          <input type="text" value={confirmRef} onChange={(e) => setConfirmRef(e.target.value)} placeholder="Broker ref&hellip;" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-faint">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional&hellip;" className={inputCls} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className={btnPrimary}>
          <Zap className="h-3.5 w-3.5" />
          {saving ? "Executing\u2026" : "Execute EFP"}
        </button>
        <button onClick={onCancel} className={btnCancel}>Cancel</button>
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
}: {
  allocations: SiteAllocationItem[];
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  settles: Record<string, number>;
  onRefresh: () => void;
}) {
  const [efpAllocId, setEfpAllocId] = useState<number | null>(null);
  const [offsetAllocId, setOffsetAllocId] = useState<number | null>(null);

  type AllocSortKey = "tradeRef" | "side" | "futuresMonth" | "siteCode" | "budgetMonth" | "allocatedBushels" | "entryPrice";
  const allocAccessor = useCallback((a: SiteAllocationItem, key: AllocSortKey) => {
    switch (key) {
      case "tradeRef": return a.tradeRef;
      case "side": return a.side;
      case "futuresMonth": return a.futuresMonth;
      case "siteCode": return a.siteCode;
      case "budgetMonth": return a.budgetMonth;
      case "allocatedBushels": return a.allocatedBushels;
      case "entryPrice": return a.entryPrice;
      default: return null;
    }
  }, []);
  const { sorted: sortedAllocations, sort: allocSort, toggleSort: toggleAllocSort } = useTableSort<SiteAllocationItem, AllocSortKey>(allocations, "budgetMonth", allocAccessor);

  function handleDone() {
    setEfpAllocId(null);
    setOffsetAllocId(null);
    onRefresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-input-bg/50">
            <SortableHeader label="Trade" sortKey="tradeRef" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <SortableHeader label="Dir" sortKey="side" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">Date</th>
            <SortableHeader label="ZC" sortKey="futuresMonth" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <SortableHeader label="Site" sortKey="siteCode" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <SortableHeader label="Month" sortKey="budgetMonth" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <SortableHeader label="Alloc bu" sortKey="allocatedBushels" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">Open bu</th>
            <SortableHeader label="Entry $/bu" sortKey="entryPrice" activeKey={allocSort.key} activeDir={allocSort.dir} onToggle={(k) => toggleAllocSort(k as AllocSortKey)} />
            <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">Settle $/bu</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">MTM</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap"></th>
          </tr>
        </thead>
        <tbody>
          {sortedAllocations.length === 0 && (
            <tr><td colSpan={12} className="px-4 py-8 text-center text-faint text-sm">No allocations yet</td></tr>
          )}
          {sortedAllocations.map((a) => {
            const isEfp = efpAllocId === a.allocationId;
            const isOffset = offsetAllocId === a.allocationId;
            return (
              <Fragment key={a.allocationId}>
                <tr className="border-t border-b-default hover:bg-row-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-secondary text-xs">{a.tradeRef}</td>
                  <td className="px-4 py-3">
                    <SideBadge side={a.side || "LONG"} />
                  </td>
                  <td className="px-4 py-3 text-faint text-xs font-mono tabular-nums">{a.tradeDate}</td>
                  <td className="px-4 py-3">
                    <span className={zcBadgeCls}>{a.futuresMonth}</span>
                  </td>
                  <td className="px-4 py-3"><span className="bg-input-bg text-secondary px-2 py-0.5 rounded text-xs font-mono">{a.siteCode}</span></td>
                  <td className="px-4 py-3 text-muted text-xs font-mono tabular-nums">{a.budgetMonth}</td>
                  <td className="px-4 py-3 text-secondary">{fmtVol(a.allocatedBushels)}</td>
                  <td className="px-4 py-3 text-secondary font-semibold">{fmtVol(a.openAllocatedLots * 5000)}</td>
                  <td className="px-4 py-3 text-secondary font-mono tabular-nums">${fmtPerBu(a.entryPrice)}</td>
                  <td className="px-4 py-3 font-mono">
                    {a.settlePrice != null ? <span className="text-secondary">${fmtPerBu(a.settlePrice)}</span>
                      : <span className="text-ph italic text-xs">no settle</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.mtmPnlUsd != null ? (
                      <span className={cn("font-semibold tabular-nums", pnlColor(a.mtmPnlUsd))}>
                        {a.mtmPnlUsd >= 0 ? "+" : "\u2212"}${Math.abs(a.mtmPnlUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    ) : <span className="text-ph italic text-xs">&ndash;</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {a.openAllocatedLots > 0 && (
                        <>
                          <button
                            onClick={() => { setEfpAllocId(isEfp ? null : a.allocationId); setOffsetAllocId(null); }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                          >
                            <Zap className="h-3 w-3" /> EFP
                          </button>
                          <button
                            onClick={() => { setOffsetAllocId(isOffset ? null : a.allocationId); setEfpAllocId(null); }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-hover/50 hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
                          >
                            <X className="h-3 w-3" /> Offset
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {isEfp && (
                  <tr className="border-t border-b-default animate-slide-down">
                    <td colSpan={12} className="px-4 py-3">
                      <EFPForm allocation={a} physicalPositions={physicalPositions} sites={sites} settles={settles} onDone={handleDone} onCancel={() => setEfpAllocId(null)} />
                    </td>
                  </tr>
                )}
                {isOffset && (
                  <tr className="border-t border-b-default animate-slide-down">
                    <td colSpan={12} className="px-4 py-3">
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

// ─── Site Summary Card (P&L focused) ─────────────────────────────────────────

function SiteSummary({
  allocations,
  lockedPositions,
  offsets,
  siteCode,
}: {
  allocations: SiteAllocationItem[];
  lockedPositions: LockedPositionItem[];
  offsets: OffsetItem[];
  siteCode: string;
}) {
  const summary = useMemo(() => {
    const openAllocs = allocations.filter((a) => a.siteCode === siteCode && a.openAllocatedLots > 0);
    const siteEfps = lockedPositions.filter((l) => l.siteCode === siteCode);
    const siteOffsets = offsets.filter((o) => o.siteCode === siteCode);

    const unrealizedPnl = openAllocs.reduce((s, a) => s + (a.mtmPnlUsd ?? 0), 0);
    const realizedEfp = siteEfps.reduce((s, e) => s + (e.gainLossUsd ?? 0), 0);
    const realizedOffset = siteOffsets.reduce((s, o) => s + o.pnlUsd, 0);
    const totalRealized = realizedEfp + realizedOffset;
    const totalPnl = totalRealized + unrealizedPnl;

    return { unrealizedPnl, realizedEfp, realizedOffset, totalRealized, totalPnl };
  }, [allocations, lockedPositions, offsets, siteCode]);

  return (
    <div className="bg-surface border border-b-default rounded-lg px-5 py-4">
      <h3 className="text-xs text-faint uppercase tracking-wider mb-3 font-semibold">Site Summary</h3>
      <div className="grid grid-cols-5 gap-4">
        <div>
          <p className="text-xs text-faint mb-0.5">Unrealized P&L</p>
          <p className={cn("text-sm font-bold tabular-nums", pnlColor(summary.unrealizedPnl))}>
            {fmtPnl(summary.unrealizedPnl)}
          </p>
        </div>
        <div>
          <p className="text-xs text-faint mb-0.5">Realized (EFP)</p>
          <p className={cn("text-sm font-bold tabular-nums", pnlColor(summary.realizedEfp))}>
            {fmtPnl(summary.realizedEfp)}
          </p>
        </div>
        <div>
          <p className="text-xs text-faint mb-0.5">Realized (Offset)</p>
          <p className={cn("text-sm font-bold tabular-nums", pnlColor(summary.realizedOffset))}>
            {fmtPnl(summary.realizedOffset)}
          </p>
        </div>
        <div>
          <p className="text-xs text-faint mb-0.5">Total Realized</p>
          <p className={cn("text-sm font-bold tabular-nums", pnlColor(summary.totalRealized))}>
            {fmtPnl(summary.totalRealized)}
          </p>
        </div>
        <div>
          <p className="text-xs text-faint mb-0.5">Total P&L</p>
          <p className={cn("text-sm font-bold tabular-nums", pnlColor(summary.totalPnl))}>
            {fmtPnl(summary.totalPnl)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Physical Positions Table ────────────────────────────────────────────────


function PhysicalPositionsTable({
  positions,
  allocations,
  settles,
}: {
  positions: PhysicalPositionItem[];
  allocations: SiteAllocationItem[];
  settles: Record<string, number>;
}) {
  // VWAP board price from open hedge allocations for non-EFP contracts
  const vwapBySite = useMemo(() => {
    const map: Record<string, number> = {};
    const grouped: Record<string, { sumPriceVol: number; sumVol: number }> = {};
    for (const a of allocations) {
      if (a.openAllocatedLots > 0) {
        const key = a.siteCode;
        if (!grouped[key]) grouped[key] = { sumPriceVol: 0, sumVol: 0 };
        grouped[key].sumPriceVol += a.entryPrice * a.openAllocatedLots;
        grouped[key].sumVol += a.openAllocatedLots;
      }
    }
    for (const [key, val] of Object.entries(grouped)) {
      map[key] = val.sumPriceVol / val.sumVol;
    }
    return map;
  }, [allocations]);
  const blended = useMemo(() => {
    let hedgedCostBu = 0;
    let hedgedBu = 0;
    let marketCostBu = 0;
    let marketBu = 0;

    for (const p of positions) {
      const bu = p.committedMt * BUSHELS_PER_MT;
      if (p.allInPricePerMt != null) {
        hedgedCostBu += (p.allInPricePerMt / BUSHELS_PER_MT) * bu;
        hedgedBu += bu;
      } else {
        const settle = p.futuresRef ? settles[p.futuresRef] : null;
        if (settle != null) {
          const basis = p.basisValue ?? 0;
          const estPerBu = settle + basis;
          marketCostBu += estPerBu * bu;
          marketBu += bu;
        } else {
          marketBu += bu;
        }
      }
    }

    const totalBu = hedgedBu + marketBu;
    const totalCost = hedgedCostBu + marketCostBu;
    const blendedPerBu = totalBu > 0 ? totalCost / totalBu : null;

    return { hedgedBu, hedgedPerBu: hedgedBu > 0 ? hedgedCostBu / hedgedBu : null, marketBu, marketPerBu: marketBu > 0 ? marketCostBu / marketBu : null, blendedPerBu, totalBu };
  }, [positions, settles]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/50">
              {["Type", "Month", "Site", "Contract", "Supplier", "Bushels", "Board", "Basis", "Freight", "All-In $/bu", "Status"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-faint text-sm">No active physical contracts</td></tr>
            )}
            {positions.map((p) => (
              <tr key={p.contractId} className="border-t border-b-default hover:bg-row-hover transition-colors">
                <td className="px-4 py-3"><TradeTypeBadge type={p.tradeType} /></td>
                <td className="px-4 py-3 font-mono tabular-nums text-secondary text-xs">{p.deliveryMonth}</td>
                <td className="px-4 py-3"><span className="bg-input-bg text-secondary px-2 py-0.5 rounded text-xs font-mono">{p.siteCode}</span></td>
                <td className="px-4 py-3 font-mono text-muted text-xs">{p.contractRef}</td>
                <td className="px-4 py-3 text-muted text-xs">{p.supplierName}</td>
                <td className="px-4 py-3 text-secondary">{fmtVol(p.committedMt, "MT")}</td>
                <td className="px-4 py-3">
                  {p.efpExecuted ? (
                    <span className="flex items-center gap-1 text-secondary font-mono">
                      <Lock className="h-3 w-3 text-muted" /> {fmtPerBu(p.boardPriceLocked)}
                    </span>
                  ) : vwapBySite[p.siteCode] != null ? (
                    <span className="text-secondary font-mono text-xs">~{fmtPerBu(vwapBySite[p.siteCode])} <span className="text-faint">(VWAP)</span></span>
                  ) : (
                    <span className="text-faint italic text-xs">Open</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.tradeType === "INDEX" ? (
                    <span className="text-ph italic text-xs">N/A</span>
                  ) : p.basisLocked ? (
                    <span className="flex items-center gap-1 text-secondary font-mono">
                      <Lock className="h-3 w-3 text-muted" /> {p.basisValue != null ? p.basisValue.toFixed(4) : "\u2013"}
                    </span>
                  ) : (
                    <span className="text-faint italic text-xs">Open</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted font-mono">{fmt2(null)}</td>
                <td className="px-4 py-3">
                  {p.allInPricePerMt != null ? (
                    <span className="text-secondary font-semibold">${(p.allInPricePerMt / BUSHELS_PER_MT).toFixed(4)}</span>
                  ) : (
                    <span className="text-ph italic text-xs">&ndash;</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ContractStatusBadge status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {positions.length > 0 && blended.blendedPerBu != null && (
        <div className="px-5 py-3 border-t border-b-default bg-input-bg/30">
          <span className="text-xs text-muted">
            Blended Cost: <span className="text-secondary font-semibold">${blended.blendedPerBu.toFixed(4)}/bu</span>
            {blended.hedgedBu > 0 && <span> (hedged: ${blended.hedgedPerBu?.toFixed(4)}/bu x {fmtVol(blended.hedgedBu)} bu</span>}
            {blended.marketBu > 0 && <span>{blended.hedgedBu > 0 ? " + " : " ("}market: ${blended.marketPerBu?.toFixed(4)}/bu x {fmtVol(blended.marketBu)} bu</span>}
            {(blended.hedgedBu > 0 || blended.marketBu > 0) && <span>)</span>}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── EFP Hedges Table (Buy/Sell Pairs) ──────────────────────────────────────

function EFPHedgesTable({ locked }: { locked: LockedPositionItem[] }) {
  const totalPnl = locked.reduce((s, l) => s + (l.gainLossUsd ?? 0), 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/50">
              {["Ticket", "Dir", "ZC", "Lots", "Bu", "Trade Date", "Price $/bu", "P&L $/bu", "P&L $"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locked.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-faint text-sm">No EFP positions locked yet</td></tr>
            )}
            {locked.map((l) => {
              const bu = l.lots * 5000;
              const pnlCls = pnlColor(l.gainLossPerBu ?? 0);
              return (
                <Fragment key={l.efpTicketId}>
                  {/* Buy row */}
                  <tr className="border-t border-b-default hover:bg-row-hover">
                    <td className="px-3 py-2 font-mono text-secondary text-xs" rowSpan={2}>{l.ticketRef}</td>
                    <td className="px-3 py-2"><SideBadge side="BUY" /></td>
                    <td className="px-3 py-2"><span className={zcBadgeCls}>{l.futuresMonth}</span></td>
                    <td className="px-3 py-2 text-secondary">{l.lots}</td>
                    <td className="px-3 py-2 text-secondary">{fmtVol(bu)}</td>
                    <td className="px-3 py-2 text-faint text-xs font-mono tabular-nums">{l.efpDate}</td>
                    <td className="px-3 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(l.futuresBuyPrice)}</td>
                    <td className="px-3 py-2" rowSpan={2}>
                      <span className={cn("font-mono font-semibold", pnlCls)}>
                        {l.gainLossPerBu != null ? `${l.gainLossPerBu > 0 ? "+" : ""}${l.gainLossPerBu.toFixed(4)}` : "\u2013"}
                      </span>
                    </td>
                    <td className="px-3 py-2" rowSpan={2}>
                      <span className={cn("font-semibold", pnlCls)}>
                        {l.gainLossUsd != null ? fmtPnl(l.gainLossUsd) : "\u2013"}
                      </span>
                    </td>
                  </tr>
                  {/* Sell row */}
                  <tr className="border-t border-b-default/50 hover:bg-row-hover">
                    <td className="px-3 py-2"><SideBadge side="SELL" /></td>
                    <td className="px-3 py-2"><span className={zcBadgeCls}>{l.futuresMonth}</span></td>
                    <td className="px-3 py-2 text-secondary">{l.lots}</td>
                    <td className="px-3 py-2 text-secondary">{fmtVol(bu)}</td>
                    <td className="px-3 py-2 text-faint text-xs font-mono tabular-nums">{l.efpDate}</td>
                    <td className="px-3 py-2 text-profit font-mono tabular-nums">{fmtPerBu(l.futuresSellPrice)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {locked.length > 0 && (
        <div className="px-5 py-3 border-t border-b-default bg-input-bg/30">
          <span className="text-xs text-muted">
            Total Realized (EFP):{" "}
            <span className={cn("font-semibold", pnlColor(totalPnl))}>
              {fmtPnl(totalPnl)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Offset Hedges Table (Buy/Sell Pairs) ───────────────────────────────────

function OffsetHedgesTable({ offsets }: { offsets: OffsetItem[] }) {
  const totalPnl = offsets.reduce((s, o) => s + o.pnlUsd, 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-input-bg/50">
              {["Trade", "Dir", "ZC", "Lots", "Bu", "Date", "Price $/bu", "P&L $/bu", "P&L $"].map((h) => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offsets.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-faint text-sm">No offset hedges yet</td></tr>
            )}
            {offsets.map((o) => {
              const pnlCls = pnlColor(o.pnlPerBu);
              return (
                <Fragment key={o.offsetId}>
                  {/* Buy row */}
                  <tr className="border-t border-b-default hover:bg-row-hover">
                    <td className="px-3 py-2 font-mono text-secondary text-xs">{o.tradeRef}</td>
                    <td className="px-3 py-2"><SideBadge side="BUY" /></td>
                    <td className="px-3 py-2"><span className={zcBadgeCls}>{o.futuresMonth}</span></td>
                    <td className="px-3 py-2 text-secondary">{o.lots}</td>
                    <td className="px-3 py-2 text-secondary">{fmtVol(o.bushels)}</td>
                    <td className="px-3 py-2 text-faint text-xs font-mono tabular-nums">{o.offsetDate}</td>
                    <td className="px-3 py-2 text-secondary font-mono tabular-nums">{fmtPerBu(o.entryPrice)}</td>
                    <td className="px-3 py-2" rowSpan={2}>
                      <span className={cn("font-mono font-semibold", pnlCls)}>
                        {`${o.pnlPerBu > 0 ? "+" : ""}${o.pnlPerBu.toFixed(4)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2" rowSpan={2}>
                      <span className={cn("font-semibold", pnlCls)}>
                        {fmtPnl(o.pnlUsd)}
                      </span>
                    </td>
                  </tr>
                  {/* Sell row */}
                  <tr className="border-t border-b-default/50 hover:bg-row-hover">
                    <td className="px-3 py-2 font-mono text-muted text-xs">OFFSET</td>
                    <td className="px-3 py-2"><SideBadge side="SELL" /></td>
                    <td className="px-3 py-2"><span className={zcBadgeCls}>{o.futuresMonth}</span></td>
                    <td className="px-3 py-2 text-secondary">{o.lots}</td>
                    <td className="px-3 py-2 text-secondary">{fmtVol(o.bushels)}</td>
                    <td className="px-3 py-2 text-faint text-xs font-mono tabular-nums">{o.offsetDate}</td>
                    <td className="px-3 py-2 text-profit font-mono tabular-nums">{fmtPerBu(o.exitPrice)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {offsets.length > 0 && (
        <div className="px-5 py-3 border-t border-b-default bg-input-bg/30">
          <span className="text-xs text-muted">
            Total Realized (Offset):{" "}
            <span className={cn("font-semibold", pnlColor(totalPnl))}>
              {fmtPnl(totalPnl)}
            </span>
          </span>
        </div>
      )}
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
        className="p-1.5 rounded-lg bg-input-bg hover:bg-hover text-muted hover:text-secondary transition-colors border border-b-input"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-[120px] text-center">
        <span className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-muted"
        )}>
          {selected ? monthLabel(selected) : "All Months"}
        </span>
      </div>
      <button
        onClick={goNext}
        className="p-1.5 rounded-lg bg-input-bg hover:bg-hover text-muted hover:text-secondary transition-colors border border-b-input"
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

    // Convert targetAllIn from $/MT to $/bu
    const targetAllInBu = targetAllIn != null ? targetAllIn / BUSHELS_PER_MT : null;

    const futuresMonth = suggestFuturesMonth(budgetMonth);
    const settle = futuresMonth ? settles[futuresMonth] : null;
    let marketEstBu: number | null = null;
    if (settle != null) {
      let totalBasisBu = 0, totalFreightBu = 0, basisCount = 0, freightCount = 0;
      for (const l of lines) {
        for (const c of l.components) {
          const name = c.componentName.toLowerCase();
          if (name.includes("basis")) {
            const perBu = c.unit === "$/bu" ? c.targetValue
              : c.targetValue / BUSHELS_PER_MT;
            totalBasisBu += perBu;
            basisCount++;
          } else if (name.includes("freight")) {
            const perBu = c.unit === "$/bu" ? c.targetValue
              : c.targetValue / BUSHELS_PER_MT;
            totalFreightBu += perBu;
            freightCount++;
          }
        }
      }
      const avgBasisPerBu = basisCount > 0 ? totalBasisBu / basisCount : 0;
      const avgFreightPerBu = freightCount > 0 ? totalFreightBu / freightCount : 0;
      const boardPerBu = settle;
      marketEstBu = boardPerBu + avgBasisPerBu + avgFreightPerBu;
    }

    return { budgetMt, hedgedMt, coveragePct, targetAllInBu, marketEstBu, futuresMonth };
  }, [budgetMonth, budgetLines, siteFilter, settles]);

  if (!summary) {
    return (
      <div className="bg-tbl-header border border-b-input/50 rounded-lg px-5 py-4">
        <p className="text-sm text-faint">No budget data for {monthLabel(budgetMonth)}</p>
      </div>
    );
  }

  return (
    <div className="bg-tbl-header border border-b-input/50 rounded-lg px-5 py-4 space-y-3">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-faint uppercase tracking-wider mb-1">Budget</p>
          <p className="text-lg font-bold tabular-nums text-primary">
            {fmtVol(summary.budgetMt, "MT")} <span className="text-xs text-faint font-normal">bu</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-faint uppercase tracking-wider mb-1">Hedged</p>
          <p className="text-lg font-bold tabular-nums text-primary">
            {fmtVol(summary.hedgedMt, "MT")} <span className="text-xs text-faint font-normal">bu</span>
          </p>
          <p className="text-xs tabular-nums text-profit font-medium">
            {summary.coveragePct.toFixed(0)}% covered
          </p>
        </div>
        <div>
          <p className="text-xs text-faint uppercase tracking-wider mb-1">Target All-In</p>
          <p className="text-lg font-bold tabular-nums text-primary">
            {summary.targetAllInBu != null ? `$${summary.targetAllInBu.toFixed(4)}` : "\u2013"}
            <span className="text-xs text-faint font-normal">/bu</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-warning/80 uppercase tracking-wider mb-1">Market Est (Unhedged)</p>
          <p className={cn("text-lg font-bold tabular-nums", summary.marketEstBu != null ? "text-warning" : "text-faint")}>
            {summary.marketEstBu != null ? `$${summary.marketEstBu.toFixed(4)}` : "\u2013"}
            <span className="text-xs text-faint font-normal">/bu</span>
          </p>
          {summary.futuresMonth && summary.marketEstBu != null && (
            <p className="text-xs text-ph">via {summary.futuresMonth} settle</p>
          )}
        </div>
      </div>
      {/* Coverage progress bar */}
      <div className="h-2 bg-input-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-profit rounded-full transition-all"
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
  const { positions, isLoading, error, mutate } = usePositions(book);
  const { sites } = useSites();
  const [siteFilter, setSiteFilter] = useState("");
  const [budgetMonth, setBudgetMonth] = useState<string | null>(null);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"open" | "efp" | "offset" | null>("open");

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
    return result.filter((a) => a.openAllocatedLots > 0);
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

  const filteredOffsets = useMemo(() => {
    let result = offsets;
    if (siteFilter) result = result.filter((o) => o.siteCode === siteFilter);
    return result;
  }, [offsets, siteFilter]);

  const filterLabel = [siteFilter, budgetMonth ? monthLabel(budgetMonth) : ""].filter(Boolean).join(" \u00b7 ");

  const openHedgeMtm = filteredAllocations.reduce((s, a) => s + (a.mtmPnlUsd ?? 0), 0);
  const efpRealizedPnl = filteredLocked.reduce((s, l) => s + (l.gainLossUsd ?? 0), 0);
  const offsetRealizedPnl = filteredOffsets.reduce((s, o) => s + o.pnlUsd, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Sites</h1>
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
        <MapPin className="h-5 w-5 text-action" />
        <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Sites</h1>
      </div>

      {/* Controls: Book toggle */}
      <div className="flex items-center gap-4">
        {/* Book toggle */}
        <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => { setBook(b); setSiteFilter(""); setBudgetMonth(null); }}
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

      {/* Site tabs + Month Navigator */}
      <div className="flex items-center gap-4 bg-surface/50 border border-b-default rounded-lg px-5 py-3">
        {dataSitesMapped.length > 0 ? (
          <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg">
            {dataSitesMapped.map((s) => (
              <button
                key={s.code}
                onClick={() => { setSiteFilter(s.code); setBudgetMonth(null); }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  siteFilter === s.code ? "bg-action text-white shadow" : "text-muted hover:text-secondary"
                )}
              >
                {s.code} &middot; {s.name}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-faint">No sites with data</span>
        )}

        {/* Divider */}
        <div className="w-px h-8 bg-b-input" />

        <BudgetMonthNavigator
          months={fyMonths}
          selected={budgetMonth}
          onChange={setBudgetMonth}
        />
        {budgetMonth && (
          <span className="text-xs text-ph">
            Futures: <span className="text-action font-mono">{suggestFuturesMonth(budgetMonth)}</span>
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
        />
      )}

      {/* 1. Site Summary */}
      {siteFilter && (
        <SiteSummary
          allocations={allocations}
          lockedPositions={locked}
          offsets={offsets}
          siteCode={siteFilter}
        />
      )}

      {/* 2. Hedge Book (accordion) */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        {/* Hedge Book header */}
        <div className="px-5 py-4 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">
            Hedge Book{filterLabel && ` \u00b7 ${filterLabel}`}
          </h2>
          <p className="text-xs text-faint mt-0.5">
            {filteredAllocations.length} open &middot; {filteredLocked.length} EFP &middot; {filteredOffsets.length} offset
          </p>
        </div>

        {/* Section 1: Open Hedges */}
        <button
          onClick={() => setExpandedSection(expandedSection === "open" ? null : "open")}
          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left border-t border-b-default"
        >
          {expandedSection === "open"
            ? <ChevronDown className="h-4 w-4 text-faint" />
            : <ChevronRight className="h-4 w-4 text-faint" />}
          <span className="text-sm font-semibold text-secondary">Open Hedges</span>
          <span className="text-xs text-faint">
            {filteredAllocations.length} position{filteredAllocations.length !== 1 ? "s" : ""} &middot;{" "}
            {fmtVol(filteredAllocations.reduce((s, a) => s + a.openAllocatedLots * 5000, 0))} bu
          </span>
          <span className={cn("text-sm font-semibold ml-auto tabular-nums", pnlColor(openHedgeMtm))}>
            {fmtPnl(openHedgeMtm)}
          </span>
        </button>
        {expandedSection === "open" && (
          <div className="animate-slide-down">
            <SiteAllocationsTable
              allocations={filteredAllocations}
              physicalPositions={filteredPhysical}
              sites={sites}
              settles={settles}
              onRefresh={() => mutate()}
            />
          </div>
        )}

        {/* Section 2: Exchange for Physical */}
        <button
          onClick={() => setExpandedSection(expandedSection === "efp" ? null : "efp")}
          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left border-t border-b-default"
        >
          {expandedSection === "efp"
            ? <ChevronDown className="h-4 w-4 text-faint" />
            : <ChevronRight className="h-4 w-4 text-faint" />}
          <span className="text-sm font-semibold text-secondary">Exchange for Physical</span>
          <span className="text-xs text-faint">
            {filteredLocked.length} ticket{filteredLocked.length !== 1 ? "s" : ""} &middot;{" "}
            {filteredLocked.reduce((s, l) => s + l.lots, 0)} lots
          </span>
          <span className={cn("text-sm font-semibold ml-auto tabular-nums", pnlColor(efpRealizedPnl))}>
            {fmtPnl(efpRealizedPnl)}
          </span>
        </button>
        {expandedSection === "efp" && (
          <div className="animate-slide-down">
            <EFPHedgesTable locked={filteredLocked} />
          </div>
        )}

        {/* Section 3: Offset Hedges */}
        <button
          onClick={() => setExpandedSection(expandedSection === "offset" ? null : "offset")}
          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-row-hover transition-colors text-left border-t border-b-default"
        >
          {expandedSection === "offset"
            ? <ChevronDown className="h-4 w-4 text-faint" />
            : <ChevronRight className="h-4 w-4 text-faint" />}
          <span className="text-sm font-semibold text-secondary">Offset Hedges</span>
          <span className="text-xs text-faint">
            {filteredOffsets.length} offset{filteredOffsets.length !== 1 ? "s" : ""} &middot;{" "}
            {fmtVol(filteredOffsets.reduce((s, o) => s + o.bushels, 0))} bu
          </span>
          <span className={cn("text-sm font-semibold ml-auto tabular-nums", pnlColor(offsetRealizedPnl))}>
            {fmtPnl(offsetRealizedPnl)}
          </span>
        </button>
        {expandedSection === "offset" && (
          <div className="animate-slide-down">
            <OffsetHedgesTable offsets={filteredOffsets} />
          </div>
        )}
      </div>

      {/* 5. Physical Positions */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-b-default flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-secondary">
              Physical Positions{filterLabel && ` \u00b7 ${filterLabel}`}
            </h2>
            <p className="text-xs text-faint mt-0.5">
              {filteredPhysical.length} contract{filteredPhysical.length !== 1 ? "s" : ""} &middot;{" "}
              {fmtVol(filteredPhysical.reduce((s, p) => s + p.committedMt, 0), "MT")} bu committed
            </p>
          </div>
          <button
            onClick={() => setNewPurchaseOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-hover/50 hover:bg-hover text-secondary rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Purchase
          </button>
        </div>
        {newPurchaseOpen && (
          <div className="px-5 py-4 border-b border-b-default animate-slide-down">
            <NewPurchaseForm
              siteCode={siteFilter}
              sites={sites}
              onDone={() => { setNewPurchaseOpen(false); mutate(); }}
              onCancel={() => setNewPurchaseOpen(false)}
            />
          </div>
        )}
        <PhysicalPositionsTable positions={filteredPhysical} allocations={allocations} settles={settles} />
      </div>
    </div>
  );
}
