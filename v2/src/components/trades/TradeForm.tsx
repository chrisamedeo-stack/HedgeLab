"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTradeStore } from "@/store/tradeStore";
import { useAuth } from "@/contexts/AuthContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { generateFuturesMonths } from "@/lib/commodity-utils";
import { API_BASE } from "@/lib/api";
import type { Commodity } from "@/hooks/usePositions";
import type { TradeFormRow, CreateTradeParams, TradeType, OptionType, SwapType, PaymentFrequency, SettlementType } from "@/types/trades";
import type { Direction } from "@/types/positions";

interface TradeFormProps {
  orgId: string;
  commodities: Commodity[];
  onClose: () => void;
  onSuccess: () => void;
}

function emptyRow(): TradeFormRow {
  return {
    key: crypto.randomUUID(),
    commodityId: "",
    direction: "long",
    contractMonth: "",
    numContracts: "",
    contractSize: "",
    volume: "",
    tradePrice: "",
    notes: "",
  };
}

const inputClass = "w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none";
const selectClass = "w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none";

interface Counterparty {
  id: string;
  name: string;
  credit_limit: number | null;
  credit_used: number;
  credit_status: string;
}

export function TradeForm({ orgId, commodities, onClose, onSuccess }: TradeFormProps) {
  const { createTrades, createTrade } = useTradeStore();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trade type selector
  const [tradeType, setTradeType] = useState<TradeType>("futures");

  // Shared fields
  const [broker, setBroker] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10));

  // ─── Futures: multi-row grid ───────────────────────────────────────────
  const [rows, setRows] = useState<TradeFormRow[]>([emptyRow()]);

  // ─── Options fields ────────────────────────────────────────────────────
  const [optCommodityId, setOptCommodityId] = useState("");
  const [optDirection, setOptDirection] = useState<Direction>("long");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [optContractMonth, setOptContractMonth] = useState("");
  const [optStrikePrice, setOptStrikePrice] = useState("");
  const [optPremium, setOptPremium] = useState("");
  const [optExpirationDate, setOptExpirationDate] = useState("");
  const [optVolume, setOptVolume] = useState("");
  const [optContractSize, setOptContractSize] = useState("");
  const [optStyle, setOptStyle] = useState<"american" | "european">("american");
  const [optNotes, setOptNotes] = useState("");

  // ─── Swap fields ───────────────────────────────────────────────────────
  const [swCommodityId, setSwCommodityId] = useState("");
  const [swDirection, setSwDirection] = useState<Direction>("long");
  const [swCounterpartyId, setSwCounterpartyId] = useState("");
  const [swCounterpartyName, setSwCounterpartyName] = useState("");
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [swSwapType, setSwSwapType] = useState<SwapType>("fixed_for_floating");
  const [swFixedPrice, setSwFixedPrice] = useState("");
  const [swFloatingRef, setSwFloatingRef] = useState("");
  const [swContractMonth, setSwContractMonth] = useState("");
  const [swNotionalVolume, setSwNotionalVolume] = useState("");
  const [swVolumeUnit, setSwVolumeUnit] = useState("bushels");
  const [swStartDate, setSwStartDate] = useState("");
  const [swEndDate, setSwEndDate] = useState("");
  const [swPayFreq, setSwPayFreq] = useState<PaymentFrequency>("monthly");
  const [swSettleType, setSwSettleType] = useState<SettlementType>("cash");
  const [swIsdaRef, setSwIsdaRef] = useState("");
  const [swNotes, setSwNotes] = useState("");

  // Fetch counterparties for swap form
  useEffect(() => {
    if (tradeType === "swap" && counterparties.length === 0) {
      fetch(`${API_BASE}/api/contracts/counterparties?orgId=${orgId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setCounterparties)
        .catch(() => {});
    }
  }, [tradeType, orgId, counterparties.length]);

  // Build per-commodity futures month options
  const futuresMonthCache: Record<string, string[]> = {};
  const getFuturesMonths = (commodityId: string): string[] => {
    if (!commodityId) return [];
    if (futuresMonthCache[commodityId]) return futuresMonthCache[commodityId];
    const c = commodities.find((c) => c.id === commodityId) ?? null;
    const months = generateFuturesMonths(c, 3);
    futuresMonthCache[commodityId] = months;
    return months;
  };

  // ─── Futures grid helpers ──────────────────────────────────────────────
  const updateRow = (key: string, field: keyof TradeFormRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        if (field === "commodityId") {
          const c = commodities.find((c) => c.id === value);
          if (c?.contract_size) {
            updated.contractSize = String(c.contract_size);
            updated.volume = String(c.contract_size);
            updated.numContracts = "1";
          }
        }
        if (field === "volume") {
          const size = Number(updated.contractSize) || 1;
          const vol = Number(value) || 0;
          updated.numContracts = String(Math.round(vol / size));
        }
        return updated;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (key: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const calcVolume = (r: TradeFormRow) => Number(r.volume) || 0;
  const calcNotional = (r: TradeFormRow) => calcVolume(r) * (Number(r.tradePrice) || 0);

  // ─── Swap settlement preview ───────────────────────────────────────────
  const swapPreview = useCallback(() => {
    if (!swStartDate || !swEndDate) return null;
    const start = new Date(swStartDate);
    const end = new Date(swEndDate);
    if (end <= start) return null;
    const totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
    if (totalMonths <= 0) return null;
    const periods = swPayFreq === "at_expiry" ? 1 : swPayFreq === "quarterly" ? Math.ceil(totalMonths / 3) : totalMonths;
    const startStr = start.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const label = swPayFreq === "at_expiry" ? "single" : swPayFreq;
    return `This swap will have ${periods} ${label} settlement period${periods !== 1 ? "s" : ""} from ${startStr} to ${endStr}`;
  }, [swStartDate, swEndDate, swPayFreq]);

  // ─── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (tradeType === "futures") {
        const validRows = rows.filter(
          (r) => r.commodityId && r.contractMonth && r.volume && r.tradePrice
        );
        if (validRows.length === 0) {
          setError("At least one complete row is required");
          setSubmitting(false);
          return;
        }
        const params: CreateTradeParams[] = validRows.map((r) => ({
          orgId,
          userId: user!.id,
          commodityId: r.commodityId,
          tradeType: "futures" as TradeType,
          direction: r.direction as Direction,
          tradeDate,
          contractMonth: r.contractMonth,
          broker: broker || undefined,
          numContracts: Number(r.numContracts) || 1,
          contractSize: Number(r.contractSize) || 1,
          tradePrice: Number(r.tradePrice),
          notes: r.notes || undefined,
        }));
        await createTrades(params);
      } else if (tradeType === "options") {
        if (!optCommodityId || !optContractMonth || !optStrikePrice || !optPremium || !optExpirationDate || !optVolume) {
          setError("All option fields are required");
          setSubmitting(false);
          return;
        }
        const cs = Number(optContractSize) || 1;
        const vol = Number(optVolume);
        await createTrade({
          orgId,
          userId: user!.id,
          commodityId: optCommodityId,
          tradeType: "options",
          direction: optDirection,
          tradeDate,
          contractMonth: optContractMonth,
          broker: broker || undefined,
          numContracts: Math.round(vol / cs) || 1,
          contractSize: cs,
          tradePrice: Number(optStrikePrice),
          optionType,
          optionStyle: optStyle,
          strikePrice: Number(optStrikePrice),
          premium: Number(optPremium),
          expirationDate: optExpirationDate,
          underlyingContract: optContractMonth,
          exchange: "CME",
          notes: optNotes || undefined,
        });
      } else if (tradeType === "swap") {
        if (!swCommodityId || !swFixedPrice || !swNotionalVolume || !swStartDate || !swEndDate) {
          setError("Commodity, fixed price, notional volume, start and end dates are required");
          setSubmitting(false);
          return;
        }
        const floatRef = swFloatingRef || `${swCommodityId}:${swContractMonth}`;
        await createTrade({
          orgId,
          userId: user!.id,
          commodityId: swCommodityId,
          tradeType: "swap",
          direction: swDirection,
          tradeDate,
          contractMonth: swContractMonth || "SWAP",
          numContracts: 1,
          contractSize: Number(swNotionalVolume),
          tradePrice: Number(swFixedPrice),
          counterpartyId: swCounterpartyId || undefined,
          counterpartyName: swCounterpartyName || counterparties.find((c) => c.id === swCounterpartyId)?.name || undefined,
          swapType: swSwapType,
          fixedPrice: Number(swFixedPrice),
          floatingReference: floatRef,
          notionalVolume: Number(swNotionalVolume),
          volumeUnit: swVolumeUnit,
          startDate: swStartDate,
          endDate: swEndDate,
          paymentFrequency: swPayFreq,
          settlementType: swSettleType,
          isdaRef: swIsdaRef || undefined,
          notes: swNotes || undefined,
        });
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Selected counterparty credit info
  const selectedCp = counterparties.find((c) => c.id === swCounterpartyId);

  return (
    <Modal open onClose={onClose} title="Book Trade" width="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        {/* Trade Type Selector */}
        <div className="flex gap-1 rounded-lg border border-b-default bg-input-bg p-1">
          {(["futures", "options", "swap"] as TradeType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTradeType(t)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tradeType === t
                  ? t === "futures"
                    ? "bg-[#1a6b7a] text-white"
                    : t === "options"
                    ? "bg-action text-white"
                    : "bg-[#EF9F27] text-white"
                  : "text-muted hover:text-secondary"
              }`}
            >
              {t === "futures" ? "Futures" : t === "options" ? "Options" : "Swap"}
            </button>
          ))}
        </div>

        {/* Shared fields */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Trade Date *</span>
            <input
              type="date"
              required
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className={inputClass}
            />
          </label>
          {tradeType !== "swap" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Broker</span>
              <input
                type="text"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className={inputClass}
                placeholder="e.g. ADM, Marex"
              />
            </label>
          )}
        </div>

        {/* ═══ FUTURES GRID ═══ */}
        {tradeType === "futures" && (
          <>
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_80px_130px_110px_100px_1fr_32px] gap-1.5 text-xs font-medium text-muted px-1">
                <span>Commodity</span>
                <span>Dir</span>
                <span>Futures Month</span>
                <span>Volume</span>
                <span>Price ($)</span>
                <span>Notes</span>
                <span></span>
              </div>

              {rows.map((row) => {
                const contractSize = Number(row.contractSize) || 1;
                const contracts = Number(row.numContracts) || 0;
                const rowMonths = getFuturesMonths(row.commodityId);
                const rowCommodity = commodities.find((c) => c.id === row.commodityId);
                const unitLabel = rowCommodity?.unit ? `/${rowCommodity.unit.replace(/s$/, "")}` : "";
                return (
                  <div key={row.key} className="grid grid-cols-[1fr_80px_130px_110px_100px_1fr_32px] gap-1.5 items-center">
                    <select value={row.commodityId} onChange={(e) => updateRow(row.key, "commodityId", e.target.value)} className={selectClass}>
                      <option value="">Commodity...</option>
                      {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={row.direction} onChange={(e) => updateRow(row.key, "direction", e.target.value)} className={selectClass}>
                      <option value="long">Long</option>
                      <option value="short">Short</option>
                    </select>
                    <select value={row.contractMonth} onChange={(e) => updateRow(row.key, "contractMonth", e.target.value)} className={selectClass}>
                      <option value="">{row.commodityId ? "Month..." : "Select commodity"}</option>
                      {rowMonths.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="relative">
                      <input type="number" min={contractSize} step={contractSize} value={row.volume} onChange={(e) => updateRow(row.key, "volume", e.target.value)} className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none tabular-nums" placeholder={String(contractSize)} />
                      {contracts > 0 && <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-faint pointer-events-none">{contracts}ct</span>}
                    </div>
                    <div className="relative">
                      <input type="number" step="0.0025" value={row.tradePrice} onChange={(e) => updateRow(row.key, "tradePrice", e.target.value)} className="w-full rounded border border-b-input bg-input-bg px-2 py-1.5 text-sm text-primary focus:border-focus focus:outline-none tabular-nums pr-8" placeholder="4.50" />
                      {unitLabel && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-faint pointer-events-none">{unitLabel}</span>}
                    </div>
                    <input type="text" value={row.notes} onChange={(e) => updateRow(row.key, "notes", e.target.value)} className={selectClass} placeholder="Optional notes" />
                    <button type="button" onClick={() => removeRow(row.key)} className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-hover hover:text-loss disabled:opacity-30" disabled={rows.length <= 1}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {rows.some((r) => Number(r.volume) > 0) && (
              <div className="rounded-md bg-surface border border-b-default px-3 py-2 text-xs text-muted">
                <div className="flex gap-6">
                  <span>Rows: <span className="text-secondary font-medium">{rows.filter((r) => r.commodityId && r.volume).length}</span></span>
                  <span>Total Volume: <span className="text-secondary font-medium tabular-nums">{rows.reduce((s, r) => s + calcVolume(r), 0).toLocaleString()}</span></span>
                  <span>Notional: <span className="text-secondary font-medium tabular-nums">${rows.reduce((s, r) => s + calcNotional(r), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ OPTIONS FORM ═══ */}
        {tradeType === "options" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Commodity *</span>
                <select required value={optCommodityId} onChange={(e) => {
                  setOptCommodityId(e.target.value);
                  const c = commodities.find((c) => c.id === e.target.value);
                  if (c?.contract_size) setOptContractSize(String(c.contract_size));
                }} className={inputClass}>
                  <option value="">Select...</option>
                  {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Direction</span>
                <select value={optDirection} onChange={(e) => setOptDirection(e.target.value as Direction)} className={inputClass}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Type *</span>
                <div className="flex gap-1">
                  {(["call", "put"] as OptionType[]).map((t) => (
                    <button key={t} type="button" onClick={() => setOptionType(t)} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${optionType === t ? (t === "call" ? "bg-profit text-white" : "bg-loss text-white") : "border border-b-input bg-input-bg text-muted hover:text-secondary"}`}>
                      {t === "call" ? "Call" : "Put"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Underlying Month *</span>
                <select required value={optContractMonth} onChange={(e) => setOptContractMonth(e.target.value)} className={inputClass}>
                  <option value="">{optCommodityId ? "Month..." : "Select commodity"}</option>
                  {getFuturesMonths(optCommodityId).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Strike Price *</span>
                <input required type="number" step="0.0025" value={optStrikePrice} onChange={(e) => setOptStrikePrice(e.target.value)} className={inputClass} placeholder="4.80" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Premium ($/unit) *</span>
                <input required type="number" step="0.0025" value={optPremium} onChange={(e) => setOptPremium(e.target.value)} className={inputClass} placeholder="0.15" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Expiration Date *</span>
                <input required type="date" value={optExpirationDate} onChange={(e) => setOptExpirationDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Volume *</span>
                <input required type="number" step="any" value={optVolume} onChange={(e) => setOptVolume(e.target.value)} className={inputClass} placeholder="5000" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Style</span>
                <div className="flex gap-1">
                  {(["american", "european"] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setOptStyle(s)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${optStyle === s ? "bg-action text-white" : "border border-b-input bg-input-bg text-muted"}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
                <input type="text" value={optNotes} onChange={(e) => setOptNotes(e.target.value)} className={inputClass} placeholder="Optional" />
              </label>
            </div>
            {optVolume && optPremium && (
              <div className="rounded-md bg-surface border border-b-default px-3 py-2 text-xs text-muted">
                Premium Total: <span className="text-secondary font-medium tabular-nums">${(Number(optVolume) * Number(optPremium)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>
        )}

        {/* ═══ SWAP FORM ═══ */}
        {tradeType === "swap" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Commodity *</span>
                <select required value={swCommodityId} onChange={(e) => setSwCommodityId(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Direction</span>
                <select value={swDirection} onChange={(e) => setSwDirection(e.target.value as Direction)} className={inputClass}>
                  <option value="long">Long (pay fixed)</option>
                  <option value="short">Short (receive fixed)</option>
                </select>
              </label>
              <label className="block col-span-2">
                <span className="mb-1 block text-xs font-medium text-muted">Counterparty</span>
                <select value={swCounterpartyId} onChange={(e) => {
                  setSwCounterpartyId(e.target.value);
                  const cp = counterparties.find((c) => c.id === e.target.value);
                  if (cp) setSwCounterpartyName(cp.name);
                }} className={inputClass}>
                  <option value="">Select counterparty...</option>
                  {counterparties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>

            {/* Credit summary */}
            {selectedCp && (
              <div className="rounded-md bg-surface border border-b-default px-3 py-2 text-xs">
                <span className="text-muted">Credit: </span>
                <span className={`font-medium ${selectedCp.credit_status === "good" ? "text-profit" : selectedCp.credit_status === "warning" ? "text-warning" : "text-loss"}`}>
                  {selectedCp.credit_status.toUpperCase()}
                </span>
                {selectedCp.credit_limit && (
                  <span className="text-muted ml-2">
                    Used: ${Number(selectedCp.credit_used).toLocaleString()} / ${Number(selectedCp.credit_limit).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Swap Type</span>
                <div className="flex gap-1">
                  {(["fixed_for_floating", "basis"] as SwapType[]).map((t) => (
                    <button key={t} type="button" onClick={() => setSwSwapType(t)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${swSwapType === t ? "bg-[#EF9F27] text-white" : "border border-b-input bg-input-bg text-muted"}`}>
                      {t === "fixed_for_floating" ? "Fixed for Floating" : "Basis"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Fixed Price *</span>
                <input required type="number" step="0.0025" value={swFixedPrice} onChange={(e) => setSwFixedPrice(e.target.value)} className={inputClass} placeholder="4.50" />
              </label>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Floating Reference</span>
                <select value={swContractMonth} onChange={(e) => {
                  setSwContractMonth(e.target.value);
                  if (swCommodityId) setSwFloatingRef(`${swCommodityId}:${e.target.value}`);
                }} className={inputClass}>
                  <option value="">{swCommodityId ? "Month..." : "Select commodity"}</option>
                  {getFuturesMonths(swCommodityId).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Notional Volume *</span>
                <input required type="number" step="any" value={swNotionalVolume} onChange={(e) => setSwNotionalVolume(e.target.value)} className={inputClass} placeholder="50000" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Volume Unit</span>
                <select value={swVolumeUnit} onChange={(e) => setSwVolumeUnit(e.target.value)} className={inputClass}>
                  <option value="bushels">Bushels</option>
                  <option value="tonnes">Tonnes</option>
                  <option value="barrels">Barrels</option>
                </select>
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Payment Frequency</span>
                <select value={swPayFreq} onChange={(e) => setSwPayFreq(e.target.value as PaymentFrequency)} className={inputClass}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="at_expiry">At Expiry</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Start Date *</span>
                <input required type="date" value={swStartDate} onChange={(e) => setSwStartDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">End Date *</span>
                <input required type="date" value={swEndDate} onChange={(e) => setSwEndDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Settlement</span>
                <select value={swSettleType} onChange={(e) => setSwSettleType(e.target.value as SettlementType)} className={inputClass}>
                  <option value="cash">Cash</option>
                  <option value="physical">Physical</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">ISDA Ref</span>
                <input type="text" value={swIsdaRef} onChange={(e) => setSwIsdaRef(e.target.value)} className={inputClass} placeholder="Optional" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
              <input type="text" value={swNotes} onChange={(e) => setSwNotes(e.target.value)} className={inputClass} placeholder="Optional" />
            </label>

            {swapPreview() && (
              <div className="rounded-md bg-surface border border-b-default px-3 py-2 text-xs text-muted">
                {swapPreview()}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {tradeType === "futures" ? (
            <button type="button" onClick={addRow} className="flex items-center gap-1 rounded-lg border border-b-input px-3 py-1.5 text-xs text-secondary transition-colors hover:bg-hover">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Row
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50">
              {submitting
                ? "Booking..."
                : tradeType === "futures"
                ? `Book ${rows.filter((r) => r.commodityId && r.volume).length} Trade(s)`
                : tradeType === "options"
                ? "Book Option"
                : "Book Swap"
              }
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
