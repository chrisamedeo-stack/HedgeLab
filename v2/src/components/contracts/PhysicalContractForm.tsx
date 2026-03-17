"use client";

import { useState, useMemo } from "react";
import { useContractStore } from "@/hooks/useContracts";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateMonthRange,
  getContractMonthOptions,
} from "@/lib/commodity-utils";
import { API_BASE } from "@/lib/api";
import type { Commodity } from "@/hooks/usePositions";
import type {
  ContractType,
  ContractDirection,
  ContractPricingType,
} from "@/types/contracts";

// ─── Types ───────────────────────────────────────────────────────────────────

type PricingTab = "fixed" | "hta" | "basis" | "index";

interface DeliveryRow {
  month: string; // "2026-07"
  volume: string;
}

interface Counterparty {
  id: string;
  name: string;
  short_name?: string | null;
}

interface Site {
  id: string;
  name: string;
  code?: string;
}

interface PhysicalContractFormProps {
  orgId: string;
  commodity: Commodity;
  commodities: Commodity[];
  counterparties: Counterparty[];
  sites: Site[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Style constants (match TradeForm palette) ──────────────────────────────

const inputCls =
  "w-full bg-[#1A2740] border border-[#1E3A5F] rounded-[6px] px-3 py-[10px] text-[13px] text-[#E8ECF1] focus:outline-none focus:ring-1 focus:ring-[#378ADD] focus:border-[#378ADD] placeholder:text-[#556170]";
const selectCls = inputCls + " appearance-none";
const sectionLabel =
  "text-[11px] uppercase tracking-[0.04em] text-[#556170] mb-2 font-medium";
const thCls =
  "text-[10px] uppercase text-[#556170] bg-[rgba(26,39,64,0.5)] px-3 py-2 font-medium text-left";
const tdCls = "px-3 py-2 text-[13px]";
const rowBorder = "border-b border-[rgba(30,58,95,0.5)]";
const helperLink =
  "text-[12px] cursor-pointer hover:underline transition-colors";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function fmtNum(v: number, dec = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtDeliveryMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${String(y).slice(-2)}`;
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

// ─── Delivery Month Pills ───────────────────────────────────────────────────

function DeliveryMonthPills({
  months,
  selected,
  onToggle,
  onAll,
  onClear,
}: {
  months: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {months.map((m) => {
        const active = selected.includes(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => onToggle(m)}
            className={`rounded-[6px] px-3.5 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-[#378ADD] text-[#E8ECF1] font-medium"
                : "bg-transparent text-[#556170] border border-[#1E3A5F] hover:text-[#8B95A5]"
            }`}
          >
            {fmtDeliveryMonth(m)}
          </button>
        );
      })}
      <span className="ml-2 flex gap-2">
        <button
          type="button"
          onClick={onAll}
          className={`${helperLink} text-[#378ADD]`}
        >
          All
        </button>
        <button
          type="button"
          onClick={onClear}
          className={`${helperLink} text-[#8B95A5]`}
        >
          None
        </button>
      </span>
    </div>
  );
}

// ─── Summary Bar ────────────────────────────────────────────────────────────

function SummaryBar({
  items,
}: {
  items: { label: string; value: string; accent?: boolean }[];
}) {
  return (
    <div className="flex items-center gap-6 rounded-[8px] bg-[rgba(26,39,64,0.5)] border border-[rgba(30,58,95,0.5)] px-4 py-3">
      {items.map((it, i) => (
        <div key={i}>
          <span className="text-[10px] uppercase tracking-[0.04em] text-[#556170] mr-2">
            {it.label}
          </span>
          <span
            className={`text-[14px] font-semibold tabular-nums ${
              it.accent ? "text-[#378ADD]" : "text-[#E8ECF1]"
            }`}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PhysicalContractForm Component ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export function PhysicalContractForm({
  orgId,
  commodity,
  commodities,
  counterparties,
  sites,
  onClose,
  onSuccess,
}: PhysicalContractFormProps) {
  const { user } = useAuth();
  const { createContract, createBulkContracts } = useContractStore();

  // ─── Shared fields ──────────────────────────────────────────────────────────

  const [contractType, setContractType] = useState<ContractType>("purchase");
  const [direction, setDirection] = useState<ContractDirection>("buy");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [contractRef, setContractRef] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState(commodity.currency ?? "USD");

  // ─── Pricing tab ────────────────────────────────────────────────────────────

  const [pricingTab, setPricingTab] = useState<PricingTab>("fixed");

  // Fixed pricing
  const [flatPrice, setFlatPrice] = useState("");

  // HTA pricing (board locked, basis floating)
  const [htaFuturesPrice, setHtaFuturesPrice] = useState("");
  const [htaFuturesMonth, setHtaFuturesMonth] = useState("");

  // Basis pricing (basis locked, board floating)
  const [basisValue, setBasisValue] = useState("");
  const [basisFuturesMonth, setBasisFuturesMonth] = useState("");

  // Index pricing
  const [indexReference, setIndexReference] = useState("");
  const [indexPremium, setIndexPremium] = useState("");

  // ─── Delivery schedule ──────────────────────────────────────────────────────

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const futureEnd = `${now.getFullYear() + 2}-12`;
  const allDeliveryMonths = useMemo(
    () => generateMonthRange(currentMonth, futureEnd),
    [currentMonth, futureEnd]
  );

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>([]);
  const [defaultVolume, setDefaultVolume] = useState("");

  // ─── Futures month options for HTA/Basis dropdowns ──────────────────────────

  const futuresMonthOptions = useMemo(
    () => getContractMonthOptions(commodity as Parameters<typeof getContractMonthOptions>[0]),
    [commodity]
  );

  // ─── Submission state ───────────────────────────────────────────────────────

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Sync delivery rows with selected months ───────────────────────────────

  function toggleMonth(m: string) {
    setSelectedMonths((prev) => {
      const next = prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort();
      syncDeliveryRows(next);
      return next;
    });
  }

  function selectAllMonths() {
    // Select next 12 months
    const next12 = allDeliveryMonths.slice(0, 12);
    setSelectedMonths(next12);
    syncDeliveryRows(next12);
  }

  function clearMonths() {
    setSelectedMonths([]);
    setDeliveryRows([]);
  }

  function syncDeliveryRows(months: string[]) {
    setDeliveryRows((prev) => {
      const existing = new Map(prev.map((r) => [r.month, r]));
      return months.map(
        (m) => existing.get(m) ?? { month: m, volume: defaultVolume || "" }
      );
    });
  }

  function applyDefaultVolume() {
    if (!defaultVolume || Number(defaultVolume) <= 0) return;
    setDeliveryRows((prev) =>
      prev.map((r) => ({ ...r, volume: defaultVolume }))
    );
  }

  function updateRowVolume(month: string, value: string) {
    setDeliveryRows((prev) =>
      prev.map((r) => (r.month === month ? { ...r, volume: value } : r))
    );
  }

  // ─── Computed values ──────────────────────────────────────────────────────

  const activeRows = deliveryRows.filter((r) => Number(r.volume) > 0);
  const totalVolume = deliveryRows.reduce(
    (sum, r) => sum + (Number(r.volume) || 0),
    0
  );

  const volumeUnit = commodity.volume_unit ?? commodity.trade_volume_unit ?? "MT";
  const priceUnit = commodity.price_unit ?? commodity.trade_price_unit ?? "$/unit";

  const pricingTypeMap: Record<PricingTab, ContractPricingType> = {
    fixed: "fixed",
    hta: "hta",
    basis: "basis",
    index: "index",
  };

  // Estimated notional
  const notionalPrice = useMemo(() => {
    switch (pricingTab) {
      case "fixed":
        return Number(flatPrice) || 0;
      case "hta":
        return Number(htaFuturesPrice) || 0;
      case "basis":
        return 0; // unknown until priced
      case "index":
        return 0;
      default:
        return 0;
    }
  }, [pricingTab, flatPrice, htaFuturesPrice]);

  const estimatedNotional = totalVolume * notionalPrice;

  // Summary items
  const summaryItems = useMemo(() => {
    const items: { label: string; value: string; accent?: boolean }[] = [
      {
        label: "Months",
        value: `${activeRows.length}`,
      },
      {
        label: "Total Volume",
        value: `${fmtNum(totalVolume, 0)} ${volumeUnit}`,
        accent: true,
      },
      { label: "Pricing", value: pricingTab.toUpperCase() },
    ];
    if (notionalPrice > 0) {
      items.push({
        label: "Est. Notional",
        value: `$${fmtNum(estimatedNotional)}`,
      });
    }
    return items;
  }, [activeRows.length, totalVolume, volumeUnit, pricingTab, notionalPrice, estimatedNotional]);

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeRows.length === 0) {
      setError("Select at least one delivery month with volume > 0");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const userId = user!.id;
      const pricingType = pricingTypeMap[pricingTab];

      // Build price/basis fields per pricing type
      let price: number | undefined;
      let basisPrice: number | undefined;
      let basisMonth: string | undefined;

      switch (pricingTab) {
        case "fixed":
          price = Number(flatPrice) || undefined;
          break;
        case "hta":
          price = Number(htaFuturesPrice) || undefined;
          basisMonth = htaFuturesMonth || undefined;
          break;
        case "basis":
          basisPrice = Number(basisValue) || undefined;
          basisMonth = basisFuturesMonth || undefined;
          break;
        case "index":
          basisPrice = Number(indexPremium) || undefined;
          break;
      }

      if (activeRows.length === 1) {
        // Single contract
        const row = activeRows[0];
        const [y, m] = row.month.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        await createContract({
          orgId,
          userId,
          counterpartyId: counterpartyId || undefined,
          commodityId: commodity.id,
          siteId: siteId || undefined,
          contractRef: contractRef || undefined,
          contractType,
          direction,
          pricingType,
          totalVolume: Number(row.volume),
          price,
          basisPrice,
          basisMonth,
          currency,
          deliveryStart: `${row.month}-01`,
          deliveryEnd: `${row.month}-${String(lastDay).padStart(2, "0")}`,
          notes: notes || undefined,
        });
      } else {
        // Bulk create — one contract per active month
        const paramsList = activeRows.map((row) => {
          const [y, m] = row.month.split("-").map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          return {
            orgId,
            userId,
            counterpartyId: counterpartyId || undefined,
            commodityId: commodity.id,
            siteId: siteId || undefined,
            contractRef: contractRef || undefined,
            contractType,
            direction,
            pricingType,
            totalVolume: Number(row.volume),
            price,
            basisPrice,
            basisMonth,
            currency,
            deliveryStart: `${row.month}-01`,
            deliveryEnd: `${row.month}-${String(lastDay).padStart(2, "0")}`,
            notes: notes || undefined,
          };
        });
        await createBulkContracts(paramsList);
      }

      onSuccess();
    } catch {
      // store handles error
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Pricing tab labels ─────────────────────────────────────────────────────

  const pricingTabs: { key: PricingTab; label: string; desc: string }[] = [
    { key: "fixed", label: "Flat", desc: "Locked price per unit" },
    { key: "hta", label: "HTA", desc: "Board locked, basis floating" },
    { key: "basis", label: "Basis", desc: "Basis locked, board floating" },
    { key: "index", label: "Index", desc: "Reference-based pricing" },
  ];

  // ═════════════════════════════════════════════════════════════════════════════
  // ─── Render ───────────────────────────────────────────────────────────────
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[780px] max-h-[90vh] overflow-y-auto rounded-[12px] border border-[#1E3A5F] bg-[#111D32] shadow-2xl">
        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(30,58,95,0.6)] bg-[#111D32]/95 backdrop-blur px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-[#E8ECF1]">
              New Physical Contract
            </h2>
            <span className="rounded-[4px] bg-[#378ADD]/15 px-2 py-0.5 text-[11px] font-medium text-[#378ADD]">
              {commodity.ticker_root ?? commodity.name}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#556170] hover:text-[#8B95A5] transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          {/* ─── Row 1: Contract Type + Direction ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={sectionLabel}>Contract Type</label>
              <div className="flex rounded-[8px] border border-[#1E3A5F] overflow-hidden">
                {(["purchase", "sale"] as ContractType[]).map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => {
                      setContractType(ct);
                      setDirection(ct === "purchase" ? "buy" : "sell");
                    }}
                    className={`flex-1 py-[10px] text-[13px] font-medium transition-colors ${
                      contractType === ct
                        ? ct === "purchase"
                          ? "bg-[#378ADD]/20 text-[#378ADD]"
                          : "bg-[#E8443A]/20 text-[#E8443A]"
                        : "bg-transparent text-[#556170] hover:text-[#8B95A5]"
                    }`}
                  >
                    {ct === "purchase" ? "Purchase (Buy)" : "Sale (Sell)"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={sectionLabel}>Counterparty</label>
              <select
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select counterparty</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ─── Row 2: Site + Ref + Currency ─────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={sectionLabel}>Delivery Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} — ${s.name}` : s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={sectionLabel}>Contract Ref</label>
              <input
                type="text"
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
                placeholder="e.g. PO-2026-001"
                className={inputCls}
              />
            </div>
            <div>
              <label className={sectionLabel}>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={selectCls}
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ─── PRICING SECTION ──────────────────────────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}

          <div>
            <div className={sectionLabel}>Pricing</div>

            {/* Pricing tab switcher */}
            <div className="flex rounded-[8px] border border-[#1E3A5F] overflow-hidden mb-4">
              {pricingTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPricingTab(tab.key)}
                  className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${
                    pricingTab === tab.key
                      ? "bg-[#378ADD]/15 text-[#378ADD] border-b-2 border-[#378ADD]"
                      : "bg-transparent text-[#556170] hover:text-[#8B95A5]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Pricing type description */}
            <div className="text-[11px] text-[#556170] mb-3 italic">
              {pricingTabs.find((t) => t.key === pricingTab)?.desc}
            </div>

            {/* Pricing fields per tab */}
            <div className="rounded-[8px] border border-[rgba(30,58,95,0.5)] bg-[rgba(26,39,64,0.3)] p-4">
              {pricingTab === "fixed" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Price ({priceUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={flatPrice}
                      onChange={(e) => setFlatPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-end pb-[10px]">
                    <span className="text-[12px] text-[#556170]">
                      Price is locked for all delivery months
                    </span>
                  </div>
                </div>
              )}

              {pricingTab === "hta" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Futures Price ({priceUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={htaFuturesPrice}
                      onChange={(e) => setHtaFuturesPrice(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Futures Month
                    </label>
                    <select
                      value={htaFuturesMonth}
                      onChange={(e) => setHtaFuturesMonth(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select month</option>
                      {futuresMonthOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-[10px]">
                    <span className="text-[12px] text-[#556170]">
                      Board locked — basis priced later
                    </span>
                  </div>
                </div>
              )}

              {pricingTab === "basis" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Basis ({commodity.basis_unit ?? priceUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={basisValue}
                      onChange={(e) => setBasisValue(e.target.value)}
                      placeholder={
                        commodity.basis_sign_convention === "over"
                          ? "+0.25"
                          : "-0.25"
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Reference Futures Month
                    </label>
                    <select
                      value={basisFuturesMonth}
                      onChange={(e) => setBasisFuturesMonth(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">Select month</option>
                      {futuresMonthOptions.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-[10px]">
                    <span className="text-[12px] text-[#556170]">
                      Basis locked — board priced later
                    </span>
                  </div>
                </div>
              )}

              {pricingTab === "index" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Index Reference
                    </label>
                    <input
                      type="text"
                      value={indexReference}
                      onChange={(e) => setIndexReference(e.target.value)}
                      placeholder={
                        commodity.basis_reference ?? "e.g. CBOT Settle"
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#8B95A5] mb-1">
                      Premium/Discount ({priceUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={indexPremium}
                      onChange={(e) => setIndexPremium(e.target.value)}
                      placeholder="+0.00"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-end pb-[10px]">
                    <span className="text-[12px] text-[#556170]">
                      Final price = index + premium
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* ─── DELIVERY SCHEDULE ────────────────────────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════════ */}

          <div>
            <div className={sectionLabel}>Delivery Schedule</div>

            {/* Month pills — show next 18 months by default */}
            <DeliveryMonthPills
              months={allDeliveryMonths.slice(0, 18)}
              selected={selectedMonths}
              onToggle={toggleMonth}
              onAll={selectAllMonths}
              onClear={clearMonths}
            />

            {/* Default volume helper */}
            {selectedMonths.length > 0 && (
              <div className="flex items-end gap-3 mt-3">
                <div className="w-48">
                  <label className="block text-[11px] text-[#8B95A5] mb-1">
                    Default Volume ({volumeUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={defaultVolume}
                    onChange={(e) => setDefaultVolume(e.target.value)}
                    placeholder="Volume per month"
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={applyDefaultVolume}
                  disabled={!defaultVolume || Number(defaultVolume) <= 0}
                  className="rounded-[6px] border border-[#1E3A5F] bg-transparent px-3 py-[10px] text-[13px] text-[#8B95A5] hover:text-[#E8ECF1] hover:border-[#378ADD] transition-colors disabled:opacity-40"
                >
                  Fill equal
                </button>
                <span className="text-[11px] text-[#556170] pb-[10px]">
                  Override per month below
                </span>
              </div>
            )}

            {/* Per-month volume table */}
            {deliveryRows.length > 0 && (
              <div className="mt-3 rounded-[8px] border border-[rgba(30,58,95,0.5)] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={thCls} style={{ width: "30%" }}>
                        Delivery Month
                      </th>
                      <th className={thCls} style={{ width: "30%" }}>
                        Volume ({volumeUnit})
                      </th>
                      <th className={thCls} style={{ width: "25%" }}>
                        Notional
                      </th>
                      <th className={thCls} style={{ width: "15%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map((row) => {
                      const vol = Number(row.volume) || 0;
                      const rowNotional = vol * notionalPrice;
                      return (
                        <tr key={row.month} className={rowBorder}>
                          <td className={`${tdCls} text-[#E8ECF1] font-medium`}>
                            {fmtDeliveryMonth(row.month)}
                          </td>
                          <td className={tdCls}>
                            <input
                              type="number"
                              step="any"
                              value={row.volume}
                              onChange={(e) =>
                                updateRowVolume(row.month, e.target.value)
                              }
                              className="w-32 bg-[#1A2740] border border-[#1E3A5F] rounded-[4px] px-2 py-1.5 text-[13px] text-[#E8ECF1] tabular-nums focus:outline-none focus:ring-1 focus:ring-[#378ADD]"
                              placeholder="0"
                            />
                          </td>
                          <td
                            className={`${tdCls} text-[#8B95A5] tabular-nums`}
                          >
                            {notionalPrice > 0
                              ? `$${fmtNum(rowNotional)}`
                              : "—"}
                          </td>
                          <td className={tdCls}>
                            <button
                              type="button"
                              onClick={() => toggleMonth(row.month)}
                              className="text-[#556170] hover:text-[#E8443A] transition-colors"
                            >
                              <XIcon size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── Notes ────────────────────────────────────────────────────── */}
          <div>
            <label className={sectionLabel}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className={inputCls + " resize-none"}
            />
          </div>

          {/* ─── Summary bar ──────────────────────────────────────────────── */}
          {activeRows.length > 0 && <SummaryBar items={summaryItems} />}

          {/* ─── Error ────────────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-[6px] bg-[#E8443A]/10 border border-[#E8443A]/20 px-3 py-2 text-[13px] text-[#E8443A]">
              {error}
            </div>
          )}

          {/* ─── Footer ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-[rgba(30,58,95,0.6)] pt-4">
            <span className="text-[11px] text-[#556170]">
              {activeRows.length > 1
                ? `Creates ${activeRows.length} contracts (one per month)`
                : activeRows.length === 1
                  ? "Creates 1 contract"
                  : "Select delivery months above"}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[8px] border border-[#1E3A5F] bg-transparent px-5 py-[10px] text-[13px] font-medium text-[#8B95A5] hover:text-[#E8ECF1] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || activeRows.length === 0}
                className="rounded-[8px] bg-[#378ADD] px-5 py-[10px] text-[13px] font-semibold text-white hover:bg-[#2E75C0] transition-colors disabled:opacity-40"
              >
                {submitting
                  ? "Creating..."
                  : activeRows.length > 1
                    ? `Create ${activeRows.length} Contracts`
                    : "Create Contract"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
