"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { useAuth } from "@/contexts/AuthContext";
import { getContractMonthOptions } from "@/lib/commodity-utils";
import { detectStrategy } from "@/lib/optionStrategyDetector";
import { API_BASE } from "@/lib/api";
import type { Commodity } from "@/hooks/usePositions";
import type { CreateTradeParams } from "@/types/trades";
import type { Direction } from "@/types/positions";

// ─── Types ───────────────────────────────────────────────────────────────────

type InstrumentType = "futures" | "options" | "swap" | "spread";

interface FuturesRow {
  key: string;
  month: string;
  contracts: string;
  price: string;
}

interface OptionLegRow {
  key: string;
  type: "call" | "put";
  side: "buy" | "sell";
  strike: string;
  premium: string;
}

interface Counterparty {
  id: string;
  name: string;
}

interface TradeFormProps {
  orgId: string;
  commodity: Commodity;
  commodities: Commodity[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Style constants ─────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-[#020812] border border-[#1E3A5F] rounded-[6px] px-3 py-[10px] text-[13px] text-[#E8ECF1] focus:outline-none focus:ring-1 focus:ring-[#378ADD] focus:border-[#378ADD] placeholder:text-[#556170]";
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

function fmtNum(v: number, dec = 2): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
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

// ─── Month Pills ─────────────────────────────────────────────────────────────

function MonthPills({
  months,
  selected,
  onToggle,
  onAll,
  onClear,
}: {
  months: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  onAll: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {months.map((m) => {
        const active = selected.includes(m.value);
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onToggle(m.value)}
            className={`rounded-[6px] px-3.5 py-1.5 text-[13px] transition-colors ${
              active
                ? "bg-[#378ADD] text-[#E8ECF1] font-medium"
                : "bg-transparent text-[#556170] border border-[#1E3A5F] hover:text-[#8B95A5]"
            }`}
          >
            {m.label}
          </button>
        );
      })}
      <span className="text-[#1E3A5F] mx-1">|</span>
      <button
        type="button"
        onClick={onAll}
        className="text-[12px] text-[#378ADD] hover:underline"
      >
        All
      </button>
      <button
        type="button"
        onClick={onClear}
        className="text-[12px] text-[#8B95A5] hover:underline ml-1"
      >
        Clear
      </button>
    </div>
  );
}

// ─── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#0B1426] border border-[#1E3A5F] rounded-lg px-4 py-3 text-[12px] text-[#8B95A5]">
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE FORM
// ═══════════════════════════════════════════════════════════════════════════════

export function TradeForm({
  orgId,
  commodity,
  commodities,
  onClose,
  onSuccess,
}: TradeFormProps) {
  const { createTrades, createTrade } = useTradeStore();
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Instrument tab ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<InstrumentType>("futures");

  // ─── Shared fields ─────────────────────────────────────────────────────────
  const [tradeDate, setTradeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [direction, setDirection] = useState<Direction>("long");
  const [optionStyle, setOptionStyle] = useState<"american" | "european">(
    "american"
  );
  const [counterpartyId, setCounterpartyId] = useState("");
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  // ─── Commodity config ──────────────────────────────────────────────────────
  const contractSize = commodity.contract_size || 1;
  const tickSize = commodity.tick_size || 0.0001;
  const priceDecimals =
    commodity.price_decimal_places || commodity.decimal_places || 4;
  const code = commodity.ticker_root || commodity.id;
  const volUnit = commodity.trade_volume_unit || commodity.volume_unit || "bu";

  const monthOptions = useMemo(
    () => getContractMonthOptions(commodity, 3),
    [commodity]
  );

  // ─── Futures state ─────────────────────────────────────────────────────────
  const [futuresRows, setFuturesRows] = useState<FuturesRow[]>([
    {
      key: crypto.randomUUID(),
      month: monthOptions[0]?.value || "",
      contracts: "1",
      price: "",
    },
  ]);

  // ─── Options state ─────────────────────────────────────────────────────────
  const [optionLegs, setOptionLegs] = useState<OptionLegRow[]>([
    {
      key: crypto.randomUUID(),
      type: "put",
      side: "buy",
      strike: "",
      premium: "",
    },
  ]);
  const [optSelectedMonths, setOptSelectedMonths] = useState<string[]>([]);
  const [optMonthContracts, setOptMonthContracts] = useState<
    Record<string, string>
  >({});

  // ─── Swap state ────────────────────────────────────────────────────────────
  const [swapSubType, setSwapSubType] = useState<
    "fixed_for_floating" | "basis"
  >("fixed_for_floating");
  const [swapFixedPrice, setSwapFixedPrice] = useState("");
  const [swapFloatingRef, setSwapFloatingRef] = useState("");
  const [swapRefA, setSwapRefA] = useState("");
  const [swapRefB, setSwapRefB] = useState("");
  const [swapSpread, setSwapSpread] = useState("");
  const [swapFrequency, setSwapFrequency] = useState("monthly");
  const [swapSettlement, setSwapSettlement] = useState("cash");
  const [swapIsda, setSwapIsda] = useState("");
  const [swSelectedMonths, setSwSelectedMonths] = useState<string[]>([]);
  const [swMonthVolumes, setSwMonthVolumes] = useState<
    Record<string, string>
  >({});

  // ─── Spread state ──────────────────────────────────────────────────────────
  const [spreadSubType, setSpreadSubType] = useState<
    "calendar" | "inter_commodity"
  >("calendar");
  const [nearMonth, setNearMonth] = useState(monthOptions[0]?.value || "");
  const [farMonth, setFarMonth] = useState(monthOptions[1]?.value || "");
  const [nearPrice, setNearPrice] = useState("");
  const [farPrice, setFarPrice] = useState("");
  const [farCommodityId, setFarCommodityId] = useState(commodity.id);
  const [activeSpreadPairs, setActiveSpreadPairs] = useState<string[]>([]);
  const [spreadPairContracts, setSpreadPairContracts] = useState<
    Record<string, string>
  >({});

  // ─── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // ─── Fetch counterparties ──────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/contracts/counterparties?orgId=${orgId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Counterparty[]) => setCounterparties(data))
      .catch(() => {});
  }, [orgId]);

  // ═══ COMPUTED VALUES ═══════════════════════════════════════════════════════

  // Futures summary
  const futuresSummary = useMemo(() => {
    const valid = futuresRows.filter((r) => r.month && r.contracts && r.price);
    const totalContracts = valid.reduce(
      (s, r) => s + (Number(r.contracts) || 0),
      0
    );
    const totalVolume = totalContracts * contractSize;
    const totalNotional = valid.reduce(
      (s, r) => s + (Number(r.contracts) || 0) * contractSize * (Number(r.price) || 0),
      0
    );
    const vwap =
      totalVolume > 0
        ? valid.reduce(
            (s, r) =>
              s +
              (Number(r.contracts) || 0) *
                contractSize *
                (Number(r.price) || 0),
            0
          ) / totalVolume
        : 0;
    return {
      months: valid.length,
      contracts: totalContracts,
      volume: totalVolume,
      notional: totalNotional,
      vwap,
    };
  }, [futuresRows, contractSize]);

  // Option strategy detection
  const detectedStrategy = useMemo(() => {
    const legs = optionLegs
      .filter((l) => l.strike && l.premium)
      .map((l) => ({
        type: l.type,
        side: l.side,
        strike: Number(l.strike),
        premium: Number(l.premium),
      }));
    return detectStrategy(legs);
  }, [optionLegs]);

  // Option net premium per unit
  const optNetPremium = useMemo(() => {
    return optionLegs.reduce((s, l) => {
      const p = Number(l.premium) || 0;
      return s + (l.side === "sell" ? p : -p);
    }, 0);
  }, [optionLegs]);

  // Spread pairs
  const spreadPairs = useMemo(() => {
    if (!nearMonth || !farMonth) return [];
    const nearIdx = monthOptions.findIndex((m) => m.value === nearMonth);
    const farIdx = monthOptions.findIndex((m) => m.value === farMonth);
    if (nearIdx < 0 || farIdx < 0 || farIdx <= nearIdx) return [];
    const offset = farIdx - nearIdx;
    const pairs: { key: string; nearValue: string; farValue: string; label: string }[] = [];
    for (let i = nearIdx; i + offset < monthOptions.length; i++) {
      const n = monthOptions[i];
      const f = monthOptions[i + offset];
      pairs.push({
        key: `${n.value}/${f.value}`,
        nearValue: n.value,
        farValue: f.value,
        label: `${n.label}/${f.label}`,
      });
    }
    return pairs;
  }, [nearMonth, farMonth, monthOptions]);

  // ═══ FUTURES HANDLERS ═════════════════════════════════════════════════════

  const addFuturesRow = () => {
    const last = futuresRows[futuresRows.length - 1];
    const lastIdx = monthOptions.findIndex((m) => m.value === last?.month);
    const nextMonth = monthOptions[lastIdx + 1]?.value || monthOptions[0]?.value || "";
    setFuturesRows((prev) => [
      ...prev,
      { key: crypto.randomUUID(), month: nextMonth, contracts: "1", price: "" },
    ]);
  };

  const fillEqual = () => {
    const first = futuresRows[0];
    if (!first) return;
    setFuturesRows((prev) =>
      prev.map((r) => ({ ...r, contracts: first.contracts }))
    );
  };

  const copyPriceDown = () => {
    const first = futuresRows[0];
    if (!first) return;
    setFuturesRows((prev) =>
      prev.map((r) => ({ ...r, price: first.price }))
    );
  };

  // ═══ OPTIONS HANDLERS ═════════════════════════════════════════════════════

  const addOptionLeg = () => {
    setOptionLegs((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        type: "call",
        side: "sell",
        strike: "",
        premium: "",
      },
    ]);
  };

  const toggleOptMonth = (v: string) => {
    setOptSelectedMonths((prev) =>
      prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]
    );
  };

  const optFillEqual = () => {
    const first = Object.values(optMonthContracts)[0];
    if (!first) return;
    const updated: Record<string, string> = {};
    for (const m of optSelectedMonths) updated[m] = first;
    setOptMonthContracts(updated);
  };

  // ═══ SWAP HANDLERS ════════════════════════════════════════════════════════

  const toggleSwMonth = (v: string) => {
    setSwSelectedMonths((prev) =>
      prev.includes(v) ? prev.filter((m) => m !== v) : [...prev, v]
    );
  };

  const swFillEqual = () => {
    const first = Object.values(swMonthVolumes)[0];
    if (!first) return;
    const updated: Record<string, string> = {};
    for (const m of swSelectedMonths) updated[m] = first;
    setSwMonthVolumes(updated);
  };

  // ═══ SPREAD HANDLERS ══════════════════════════════════════════════════════

  const toggleSpreadPair = (key: string) => {
    setActiveSpreadPairs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // ═══ SUBMIT ═══════════════════════════════════════════════════════════════

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const cpName =
        counterparties.find((c) => c.id === counterpartyId)?.name || undefined;

      if (activeTab === "futures") {
        const valid = futuresRows.filter(
          (r) => r.month && r.contracts && r.price
        );
        if (valid.length === 0) {
          setError("At least one complete row is required");
          setSubmitting(false);
          return;
        }
        const params: CreateTradeParams[] = valid.map((r) => ({
          orgId,
          userId: user!.id,
          commodityId: commodity.id,
          tradeType: "futures" as const,
          direction,
          tradeDate,
          contractMonth: r.month,
          numContracts: Number(r.contracts) || 1,
          contractSize,
          tradePrice: Number(r.price),
          counterpartyId: counterpartyId || undefined,
          counterpartyName: cpName,
        }));
        await createTrades(params);
      } else if (activeTab === "options") {
        const validLegs = optionLegs.filter((l) => l.strike && l.premium);
        if (validLegs.length === 0 || optSelectedMonths.length === 0) {
          setError("Add at least one leg and select at least one month");
          setSubmitting(false);
          return;
        }
        const strategyGroupId = crypto.randomUUID();
        const params: CreateTradeParams[] = [];
        for (const month of optSelectedMonths) {
          const contracts = Number(optMonthContracts[month]) || 1;
          for (const leg of validLegs) {
            params.push({
              orgId,
              userId: user!.id,
              commodityId: commodity.id,
              tradeType: "options",
              direction: leg.side === "buy" ? "long" : "short",
              tradeDate,
              contractMonth: month,
              numContracts: contracts,
              contractSize,
              tradePrice: Number(leg.strike),
              optionType: leg.type,
              optionStyle: optionStyle,
              strikePrice: Number(leg.strike),
              premium: Number(leg.premium),
              expirationDate: tradeDate,
              counterpartyId: counterpartyId || undefined,
              counterpartyName: cpName,
              externalRef: strategyGroupId,
            });
          }
        }
        await createTrades(params);
      } else if (activeTab === "swap") {
        const totalVolume = swSelectedMonths.reduce(
          (s, m) => s + (Number(swMonthVolumes[m]) || 0),
          0
        );
        if (totalVolume <= 0) {
          setError("Total volume must be greater than zero");
          setSubmitting(false);
          return;
        }
        const startMonth = [...swSelectedMonths].sort()[0];
        const endMonth = [...swSelectedMonths].sort().pop()!;
        await createTrade({
          orgId,
          userId: user!.id,
          commodityId: commodity.id,
          tradeType: "swap",
          direction,
          tradeDate,
          contractMonth: startMonth || "SWAP",
          numContracts: 1,
          contractSize: totalVolume,
          tradePrice: Number(swapFixedPrice) || 0,
          counterpartyId: counterpartyId || undefined,
          counterpartyName: cpName,
          swapType: swapSubType,
          fixedPrice: Number(swapFixedPrice) || 0,
          floatingReference:
            swapSubType === "basis"
              ? `${swapRefA}/${swapRefB}`
              : swapFloatingRef || commodity.id,
          notionalVolume: totalVolume,
          volumeUnit: volUnit,
          startDate: startMonth,
          endDate: endMonth,
          paymentFrequency:
            swapFrequency === "monthly"
              ? "monthly"
              : swapFrequency === "quarterly"
                ? "quarterly"
                : "at_expiry",
          settlementType: swapSettlement as "cash" | "physical",
          isdaRef: swapIsda || undefined,
        });
      } else if (activeTab === "spread") {
        const activePairs = spreadPairs.filter((p) =>
          activeSpreadPairs.includes(p.key)
        );
        if (activePairs.length === 0) {
          setError("Select at least one spread pair");
          setSubmitting(false);
          return;
        }
        const spreadGroupId = crypto.randomUUID();
        const params: CreateTradeParams[] = [];
        for (const pair of activePairs) {
          const contracts = Number(spreadPairContracts[pair.key]) || 1;
          // Near leg
          params.push({
            orgId,
            userId: user!.id,
            commodityId: commodity.id,
            tradeType: "futures",
            direction: direction === "long" ? "long" : "short",
            tradeDate,
            contractMonth: pair.nearValue,
            numContracts: contracts,
            contractSize,
            tradePrice: Number(nearPrice) || 0,
            counterpartyId: counterpartyId || undefined,
            counterpartyName: cpName,
            externalRef: spreadGroupId,
          });
          // Far leg
          params.push({
            orgId,
            userId: user!.id,
            commodityId:
              spreadSubType === "inter_commodity"
                ? farCommodityId
                : commodity.id,
            tradeType: "futures",
            direction: direction === "long" ? "short" : "long",
            tradeDate,
            contractMonth: pair.farValue,
            numContracts: contracts,
            contractSize,
            tradePrice: Number(farPrice) || 0,
            counterpartyId: counterpartyId || undefined,
            counterpartyName: cpName,
            externalRef: spreadGroupId,
          });
        }
        await createTrades(params);
      }

      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ═══ SUBMIT LABEL ═════════════════════════════════════════════════════════

  const submitLabel = useMemo(() => {
    if (submitting) return "Booking...";
    if (activeTab === "futures") {
      const n = futuresRows.filter(
        (r) => r.month && r.contracts && r.price
      ).length;
      return n === 1 ? "Book Trade" : `Book ${n} Trades`;
    }
    if (activeTab === "options") {
      const legs = optionLegs.filter((l) => l.strike && l.premium).length;
      const total = legs * optSelectedMonths.length;
      if (detectedStrategy.name) {
        return `Book ${detectedStrategy.name} (${total} legs)`;
      }
      return `Book ${total} option${total !== 1 ? "s" : ""}`;
    }
    if (activeTab === "swap") return "Book swap";
    if (activeTab === "spread") {
      const n = activeSpreadPairs.length;
      return `Book spread (${n * 2} legs)`;
    }
    return "Book Trade";
  }, [
    activeTab,
    submitting,
    futuresRows,
    optionLegs,
    optSelectedMonths,
    detectedStrategy,
    activeSpreadPairs,
  ]);

  // ═══ RENDER ═══════════════════════════════════════════════════════════════

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-[#1E3A5F] bg-[#111D32] shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E3A5F] shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-[#E8ECF1]">
              Book Trade
            </h2>
            <span className="font-mono text-sm text-[#378ADD] bg-[rgba(55,138,221,0.1)] px-2.5 py-1 rounded">
              {code}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#556170] hover:text-[#8B95A5] transition-colors p-1"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* ─── Body (scrollable) ───────────────────────────────────────── */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-md bg-[rgba(216,90,48,0.08)] border border-[rgba(216,90,48,0.2)] px-3 py-2 text-[13px] text-[#D85A30]">
              {error}
            </div>
          )}

          {/* ─── Instrument tabs ───────────────────────────────────────── */}
          <div className="bg-[#1A2740] border border-[#1E3A5F] rounded-md p-[3px] flex">
            {(
              ["futures", "options", "swap", "spread"] as InstrumentType[]
            ).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm rounded transition-colors ${
                  activeTab === tab
                    ? "bg-[#378ADD] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    : "text-[#556170] hover:text-[#8B95A5]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ─── Shared fields ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={sectionLabel}>Trade date</label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={sectionLabel}>
                {activeTab === "options" ? "Style" : "Direction"}
              </label>
              {activeTab === "options" ? (
                <select
                  value={optionStyle}
                  onChange={(e) =>
                    setOptionStyle(
                      e.target.value as "american" | "european"
                    )
                  }
                  className={selectCls}
                >
                  <option value="american">American</option>
                  <option value="european">European</option>
                </select>
              ) : (
                <select
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as Direction)
                  }
                  className={selectCls}
                >
                  <option value="long">
                    {activeTab === "swap" ? "Long (pay fixed)" : "Long"}
                  </option>
                  <option value="short">
                    {activeTab === "swap"
                      ? "Short (receive fixed)"
                      : "Short"}
                  </option>
                </select>
              )}
            </div>
            <div>
              <label className={sectionLabel}>Counterparty</label>
              <select
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                className={selectCls}
              >
                <option value="">Select...</option>
                {counterparties.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* FUTURES TAB                                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "futures" && (
            <div className="space-y-4">
              {/* Strip grid */}
              <div className="border border-[#1E3A5F] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={thCls}>Month</th>
                      <th className={thCls}>Contracts</th>
                      <th className={thCls}>Volume</th>
                      <th className={thCls}>Price</th>
                      <th className={thCls}>Notional</th>
                      <th className={thCls + " w-9"}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {futuresRows.map((row) => {
                      const c = Number(row.contracts) || 0;
                      const vol = c * contractSize;
                      const notional = vol * (Number(row.price) || 0);
                      return (
                        <tr key={row.key} className={rowBorder}>
                          <td className={tdCls}>
                            <select
                              value={row.month}
                              onChange={(e) =>
                                setFuturesRows((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? { ...r, month: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className={selectCls}
                            >
                              <option value="">Month...</option>
                              {monthOptions.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={tdCls}>
                            <input
                              type="number"
                              min={1}
                              value={row.contracts}
                              onChange={(e) =>
                                setFuturesRows((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? { ...r, contracts: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className={inputCls + " font-mono"}
                            />
                          </td>
                          <td
                            className={
                              tdCls + " font-mono text-[#8B95A5]"
                            }
                          >
                            {vol > 0
                              ? vol.toLocaleString() + " " + volUnit
                              : "—"}
                          </td>
                          <td className={tdCls}>
                            <input
                              type="number"
                              step={tickSize}
                              value={row.price}
                              onChange={(e) =>
                                setFuturesRows((prev) =>
                                  prev.map((r) =>
                                    r.key === row.key
                                      ? { ...r, price: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className={inputCls + " font-mono"}
                              placeholder="0.00"
                            />
                          </td>
                          <td
                            className={
                              tdCls + " font-mono text-[#556170]"
                            }
                          >
                            {notional > 0
                              ? "$" + fmtNum(notional)
                              : "—"}
                          </td>
                          <td className={tdCls + " text-center"}>
                            <button
                              type="button"
                              onClick={() =>
                                futuresRows.length > 1 &&
                                setFuturesRows((prev) =>
                                  prev.filter((r) => r.key !== row.key)
                                )
                              }
                              className={`text-[#556170] hover:text-[#D85A30] transition-colors ${
                                futuresRows.length <= 1
                                  ? "opacity-0 pointer-events-none"
                                  : ""
                              }`}
                            >
                              <XIcon />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Helper actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addFuturesRow}
                  className={helperLink + " text-[#378ADD]"}
                >
                  + Add month
                </button>
                <span className="text-[#1E3A5F]">|</span>
                <button
                  type="button"
                  onClick={fillEqual}
                  className={helperLink + " text-[#8B95A5]"}
                >
                  Fill equal
                </button>
                <span className="text-[#1E3A5F]">|</span>
                <button
                  type="button"
                  onClick={copyPriceDown}
                  className={helperLink + " text-[#8B95A5]"}
                >
                  Copy price down
                </button>
              </div>

              {/* Summary */}
              {futuresSummary.contracts > 0 && (
                <SummaryBar>
                  {futuresSummary.months} month
                  {futuresSummary.months !== 1 ? "s" : ""} &middot;{" "}
                  {futuresSummary.contracts} contracts{"  "}
                  <span className="font-mono text-[#E8ECF1]">
                    {futuresSummary.volume.toLocaleString()} {volUnit}
                  </span>
                  {"  "}VWAP{" "}
                  <span className="font-mono text-[#E8ECF1]">
                    {fmtNum(futuresSummary.vwap, priceDecimals)}
                  </span>
                </SummaryBar>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* OPTIONS TAB                                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "options" && (
            <div className="space-y-5">
              {/* Strategy legs */}
              <div>
                <div className={sectionLabel}>Strategy legs</div>
                <div className="border border-[#1E3A5F] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={thCls} style={{ width: "16%" }}>
                          Type
                        </th>
                        <th className={thCls} style={{ width: "16%" }}>
                          Side
                        </th>
                        <th className={thCls} style={{ width: "22%" }}>
                          Strike
                        </th>
                        <th className={thCls} style={{ width: "22%" }}>
                          Premium
                        </th>
                        <th className={thCls} style={{ width: "18%" }}>
                          Net / unit
                        </th>
                        <th className={thCls + " w-9"}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionLegs.map((leg) => {
                        const prem = Number(leg.premium) || 0;
                        const netUnit =
                          leg.side === "sell" ? prem : -prem;
                        return (
                          <tr key={leg.key} className={rowBorder}>
                            <td className={tdCls}>
                              <select
                                value={leg.type}
                                onChange={(e) =>
                                  setOptionLegs((prev) =>
                                    prev.map((l) =>
                                      l.key === leg.key
                                        ? {
                                            ...l,
                                            type: e.target.value as
                                              | "call"
                                              | "put",
                                          }
                                        : l
                                    )
                                  )
                                }
                                className={selectCls}
                              >
                                <option value="put">Put</option>
                                <option value="call">Call</option>
                              </select>
                            </td>
                            <td className={tdCls}>
                              <select
                                value={leg.side}
                                onChange={(e) =>
                                  setOptionLegs((prev) =>
                                    prev.map((l) =>
                                      l.key === leg.key
                                        ? {
                                            ...l,
                                            side: e.target.value as
                                              | "buy"
                                              | "sell",
                                          }
                                        : l
                                    )
                                  )
                                }
                                className={selectCls}
                              >
                                <option value="buy">Buy</option>
                                <option value="sell">Sell</option>
                              </select>
                            </td>
                            <td className={tdCls}>
                              <input
                                type="number"
                                step={tickSize}
                                value={leg.strike}
                                onChange={(e) =>
                                  setOptionLegs((prev) =>
                                    prev.map((l) =>
                                      l.key === leg.key
                                        ? { ...l, strike: e.target.value }
                                        : l
                                    )
                                  )
                                }
                                className={inputCls + " font-mono"}
                                placeholder="0.00"
                              />
                            </td>
                            <td className={tdCls}>
                              <input
                                type="number"
                                step={tickSize}
                                value={leg.premium}
                                onChange={(e) =>
                                  setOptionLegs((prev) =>
                                    prev.map((l) =>
                                      l.key === leg.key
                                        ? {
                                            ...l,
                                            premium: e.target.value,
                                          }
                                        : l
                                    )
                                  )
                                }
                                className={inputCls + " font-mono"}
                                placeholder="0.00"
                              />
                            </td>
                            <td
                              className={
                                tdCls +
                                " font-mono " +
                                (netUnit >= 0
                                  ? "text-[#1D9E75]"
                                  : "text-[#D85A30]")
                              }
                            >
                              {prem > 0
                                ? (netUnit >= 0 ? "+" : "−") +
                                  "$" +
                                  Math.abs(netUnit).toFixed(priceDecimals)
                                : "—"}
                            </td>
                            <td className={tdCls + " text-center"}>
                              <button
                                type="button"
                                onClick={() =>
                                  optionLegs.length > 1 &&
                                  setOptionLegs((prev) =>
                                    prev.filter(
                                      (l) => l.key !== leg.key
                                    )
                                  )
                                }
                                className={`text-[#556170] hover:text-[#D85A30] transition-colors ${
                                  optionLegs.length <= 1
                                    ? "opacity-0 pointer-events-none"
                                    : ""
                                }`}
                              >
                                <XIcon />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addOptionLeg}
                  className={helperLink + " text-[#378ADD] mt-2 inline-block"}
                >
                  + Add leg
                </button>
              </div>

              {/* Strategy detection banner */}
              {detectedStrategy.name && (
                <div className="bg-[rgba(55,138,221,0.06)] border border-[rgba(55,138,221,0.2)] rounded-md px-3.5 py-2.5 flex items-center gap-4">
                  <span className="text-[13px] font-semibold text-[#378ADD]">
                    {detectedStrategy.name}
                  </span>
                  <span className="text-[13px] text-[#8B95A5]">
                    {Object.entries(detectedStrategy.metrics).map(
                      ([k, v], i) => (
                        <span key={k}>
                          {i > 0 && " · "}
                          {k}:{" "}
                          <span className="font-mono text-[#E8ECF1]">
                            {v}
                          </span>
                        </span>
                      )
                    )}
                  </span>
                </div>
              )}

              {/* Apply to months */}
              <div>
                <div className={sectionLabel}>Apply to months</div>
                <MonthPills
                  months={monthOptions}
                  selected={optSelectedMonths}
                  onToggle={toggleOptMonth}
                  onAll={() =>
                    setOptSelectedMonths(monthOptions.map((m) => m.value))
                  }
                  onClear={() => setOptSelectedMonths([])}
                />
              </div>

              {/* Volume by month */}
              {optSelectedMonths.length > 0 && (
                <div>
                  <div className={sectionLabel}>Volume</div>
                  <div className="border border-[#1E3A5F] rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className={thCls}>Month</th>
                          <th className={thCls}>Contracts</th>
                          <th className={thCls}>Volume</th>
                          <th className={thCls}>Net cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optSelectedMonths
                          .sort()
                          .map((mv) => {
                            const label =
                              monthOptions.find((m) => m.value === mv)
                                ?.label || mv;
                            const c =
                              Number(optMonthContracts[mv]) || 0;
                            const vol = c * contractSize;
                            const netCost = vol * optNetPremium;
                            return (
                              <tr key={mv} className={rowBorder}>
                                <td
                                  className={
                                    tdCls +
                                    " text-[13px] font-semibold text-[#E8ECF1]"
                                  }
                                >
                                  {label}
                                </td>
                                <td className={tdCls}>
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      optMonthContracts[mv] || ""
                                    }
                                    onChange={(e) =>
                                      setOptMonthContracts(
                                        (prev) => ({
                                          ...prev,
                                          [mv]: e.target.value,
                                        })
                                      )
                                    }
                                    className={
                                      inputCls + " font-mono"
                                    }
                                    placeholder="1"
                                  />
                                </td>
                                <td
                                  className={
                                    tdCls +
                                    " font-mono text-[#8B95A5]"
                                  }
                                >
                                  {vol > 0
                                    ? vol.toLocaleString() +
                                      " " +
                                      volUnit
                                    : "—"}
                                </td>
                                <td
                                  className={
                                    tdCls +
                                    " font-mono " +
                                    (netCost >= 0
                                      ? "text-[#1D9E75]"
                                      : "text-[#D85A30]")
                                  }
                                >
                                  {vol > 0
                                    ? (netCost >= 0 ? "+" : "−") +
                                      "$" +
                                      fmtNum(Math.abs(netCost))
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={optFillEqual}
                    className={
                      helperLink + " text-[#8B95A5] mt-2 inline-block"
                    }
                  >
                    Fill equal
                  </button>
                </div>
              )}

              {/* Options summary */}
              {optionLegs.some((l) => l.strike && l.premium) &&
                optSelectedMonths.length > 0 && (
                  <SummaryBar>
                    {optionLegs.filter((l) => l.strike && l.premium).length}{" "}
                    leg
                    {optionLegs.filter((l) => l.strike && l.premium)
                      .length !== 1
                      ? "s"
                      : ""}{" "}
                    &middot; {optSelectedMonths.length} month
                    {optSelectedMonths.length !== 1 ? "s" : ""}
                    {"  "}
                    <span className="font-mono text-[#E8ECF1]">
                      {(
                        optSelectedMonths.reduce(
                          (s, m) =>
                            s +
                            (Number(optMonthContracts[m]) || 0) *
                              contractSize,
                          0
                        )
                      ).toLocaleString()}{" "}
                      {volUnit}
                    </span>
                    {"  "}Net{" "}
                    <span
                      className={
                        "font-mono " +
                        (optNetPremium >= 0
                          ? "text-[#1D9E75]"
                          : "text-[#D85A30]")
                      }
                    >
                      {optNetPremium >= 0 ? "+" : "−"}$
                      {fmtNum(
                        Math.abs(optNetPremium) *
                          optSelectedMonths.reduce(
                            (s, m) =>
                              s +
                              (Number(optMonthContracts[m]) || 0) *
                                contractSize,
                            0
                          )
                      )}
                    </span>
                  </SummaryBar>
                )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SWAP TAB                                                       */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "swap" && (
            <div className="space-y-5">
              {/* Terms */}
              <div>
                <div className={sectionLabel}>Terms</div>

                {/* Sub-type selector */}
                <div className="bg-[#1A2740] border border-[#1E3A5F] rounded-md p-[3px] flex max-w-[320px] mb-4">
                  {(
                    [
                      ["fixed_for_floating", "Fixed for floating"],
                      ["basis", "Basis swap"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSwapSubType(val)}
                      className={`flex-1 py-2 text-[13px] rounded transition-colors ${
                        swapSubType === val
                          ? "bg-[#111D32] font-medium text-[#E8ECF1] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                          : "text-[#556170] hover:text-[#8B95A5]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Fields */}
                <div className="grid grid-cols-4 gap-3">
                  {swapSubType === "fixed_for_floating" ? (
                    <>
                      <div>
                        <label className={sectionLabel}>Fixed price</label>
                        <input
                          type="number"
                          step={tickSize}
                          value={swapFixedPrice}
                          onChange={(e) =>
                            setSwapFixedPrice(e.target.value)
                          }
                          className={inputCls + " font-mono"}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className={sectionLabel}>
                          Floating ref
                        </label>
                        <select
                          value={swapFloatingRef}
                          onChange={(e) =>
                            setSwapFloatingRef(e.target.value)
                          }
                          className={selectCls}
                        >
                          <option value="">Select...</option>
                          {monthOptions.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={sectionLabel}>Frequency</label>
                        <select
                          value={swapFrequency}
                          onChange={(e) =>
                            setSwapFrequency(e.target.value)
                          }
                          className={selectCls}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="semi_annual">
                            Semi-annual
                          </option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                      <div>
                        <label className={sectionLabel}>Settlement</label>
                        <select
                          value={swapSettlement}
                          onChange={(e) =>
                            setSwapSettlement(e.target.value)
                          }
                          className={selectCls}
                        >
                          <option value="cash">Cash</option>
                          <option value="physical">Physical</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={sectionLabel}>
                          Reference A
                        </label>
                        <input
                          type="text"
                          value={swapRefA}
                          onChange={(e) => setSwapRefA(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. NYMEX WTI"
                        />
                      </div>
                      <div>
                        <label className={sectionLabel}>
                          Reference B
                        </label>
                        <input
                          type="text"
                          value={swapRefB}
                          onChange={(e) => setSwapRefB(e.target.value)}
                          className={inputCls}
                          placeholder="e.g. Brent"
                        />
                      </div>
                      <div>
                        <label className={sectionLabel}>Spread</label>
                        <input
                          type="number"
                          step={tickSize}
                          value={swapSpread}
                          onChange={(e) =>
                            setSwapSpread(e.target.value)
                          }
                          className={inputCls + " font-mono"}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className={sectionLabel}>Frequency</label>
                        <select
                          value={swapFrequency}
                          onChange={(e) =>
                            setSwapFrequency(e.target.value)
                          }
                          className={selectCls}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="quarterly">Quarterly</option>
                          <option value="semi_annual">
                            Semi-annual
                          </option>
                          <option value="annual">Annual</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* ISDA ref */}
                <div className="mt-3 max-w-xs">
                  <label className={sectionLabel}>
                    ISDA ref (optional)
                  </label>
                  <input
                    type="text"
                    value={swapIsda}
                    onChange={(e) => setSwapIsda(e.target.value)}
                    className={inputCls}
                    placeholder="ISDA reference"
                  />
                </div>

                {/* Warning */}
                <div className="mt-3 rounded bg-[rgba(186,117,23,0.08)] border border-[rgba(186,117,23,0.15)] px-3 py-2 text-[10px] text-[#BA7517]">
                  Swaps settle on their own schedule — not allocatable to
                  sites
                </div>
              </div>

              {/* Volume by month */}
              <div>
                <div className={sectionLabel}>Volume by month</div>
                <MonthPills
                  months={monthOptions}
                  selected={swSelectedMonths}
                  onToggle={toggleSwMonth}
                  onAll={() =>
                    setSwSelectedMonths(
                      monthOptions.map((m) => m.value)
                    )
                  }
                  onClear={() => setSwSelectedMonths([])}
                />

                {swSelectedMonths.length > 0 && (
                  <>
                    <div className="border border-[#1E3A5F] rounded-lg overflow-hidden mt-3">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className={thCls}>Month</th>
                            <th className={thCls}>Volume</th>
                            <th className={thCls}>Notional</th>
                          </tr>
                        </thead>
                        <tbody>
                          {swSelectedMonths
                            .sort()
                            .map((mv) => {
                              const label =
                                monthOptions.find(
                                  (m) => m.value === mv
                                )?.label || mv;
                              const vol =
                                Number(swMonthVolumes[mv]) || 0;
                              const notional =
                                vol *
                                (Number(swapFixedPrice) || 0);
                              return (
                                <tr
                                  key={mv}
                                  className={rowBorder}
                                >
                                  <td
                                    className={
                                      tdCls +
                                      " text-[13px] font-semibold text-[#E8ECF1]"
                                    }
                                  >
                                    {label}
                                  </td>
                                  <td className={tdCls}>
                                    <input
                                      type="number"
                                      value={
                                        swMonthVolumes[mv] ||
                                        ""
                                      }
                                      onChange={(e) =>
                                        setSwMonthVolumes(
                                          (prev) => ({
                                            ...prev,
                                            [mv]: e.target
                                              .value,
                                          })
                                        )
                                      }
                                      className={
                                        inputCls + " font-mono"
                                      }
                                      placeholder="0"
                                    />
                                  </td>
                                  <td
                                    className={
                                      tdCls +
                                      " font-mono text-[#556170]"
                                    }
                                  >
                                    {notional > 0
                                      ? "$" + fmtNum(notional)
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextMonth = monthOptions.find(
                            (m) =>
                              !swSelectedMonths.includes(m.value)
                          );
                          if (nextMonth) {
                            setSwSelectedMonths((prev) => [
                              ...prev,
                              nextMonth.value,
                            ]);
                          }
                        }}
                        className={
                          helperLink + " text-[#378ADD]"
                        }
                      >
                        + Add month
                      </button>
                      <span className="text-[#1E3A5F]">|</span>
                      <button
                        type="button"
                        onClick={swFillEqual}
                        className={
                          helperLink + " text-[#8B95A5]"
                        }
                      >
                        Fill equal
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Swap summary */}
              {swSelectedMonths.length > 0 && (
                <SummaryBar>
                  Fixed{" "}
                  <span className="font-mono text-[#E8ECF1]">
                    {swapFixedPrice || "—"}
                  </span>
                  {swapSubType === "fixed_for_floating"
                    ? ` vs ${
                        monthOptions.find(
                          (m) => m.value === swapFloatingRef
                        )?.label || "floating"
                      }`
                    : ` vs ${swapRefA || "—"}/${swapRefB || "—"}`}
                  {"  "}
                  <span className="font-mono text-[#E8ECF1]">
                    {swSelectedMonths
                      .reduce(
                        (s, m) =>
                          s + (Number(swMonthVolumes[m]) || 0),
                        0
                      )
                      .toLocaleString()}{" "}
                    {volUnit}
                  </span>
                  {"  "}
                  {
                    monthOptions.find(
                      (m) =>
                        m.value === [...swSelectedMonths].sort()[0]
                    )?.label
                  }{" "}
                  to{" "}
                  {
                    monthOptions.find(
                      (m) =>
                        m.value ===
                        [...swSelectedMonths].sort().pop()
                    )?.label
                  }
                  {"  "}{swapFrequency}
                </SummaryBar>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SPREAD TAB                                                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "spread" && (
            <div className="space-y-5">
              {/* Spread legs */}
              <div>
                <div className={sectionLabel}>Spread legs</div>

                {/* Sub-type selector */}
                <div className="bg-[#1A2740] border border-[#1E3A5F] rounded-md p-[3px] flex max-w-[320px] mb-4">
                  {(
                    [
                      ["calendar", "Calendar"],
                      ["inter_commodity", "Inter-commodity"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSpreadSubType(val)}
                      className={`flex-1 py-2 text-[13px] rounded transition-colors ${
                        spreadSubType === val
                          ? "bg-[#111D32] font-medium text-[#E8ECF1] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                          : "text-[#556170] hover:text-[#8B95A5]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Leg table */}
                <div className="border border-[#1E3A5F] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className={thCls}>Leg</th>
                        {spreadSubType === "inter_commodity" && (
                          <th className={thCls}>Commodity</th>
                        )}
                        <th className={thCls}>Month</th>
                        <th className={thCls}>Side</th>
                        <th className={thCls}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Near leg */}
                      <tr className={rowBorder}>
                        <td
                          className={
                            tdCls +
                            " text-[13px] font-semibold text-[#E8ECF1]"
                          }
                        >
                          Near
                        </td>
                        {spreadSubType === "inter_commodity" && (
                          <td
                            className={
                              tdCls + " text-[13px] text-[#8B95A5]"
                            }
                          >
                            {commodity.name}
                          </td>
                        )}
                        <td className={tdCls}>
                          <select
                            value={nearMonth}
                            onChange={(e) =>
                              setNearMonth(e.target.value)
                            }
                            className={selectCls}
                          >
                            {monthOptions.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          className={
                            tdCls +
                            " text-[13px] font-medium text-[#1D9E75]"
                          }
                        >
                          Buy
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number"
                            step={tickSize}
                            value={nearPrice}
                            onChange={(e) =>
                              setNearPrice(e.target.value)
                            }
                            className={inputCls + " font-mono"}
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                      {/* Far leg */}
                      <tr className={rowBorder}>
                        <td
                          className={
                            tdCls +
                            " text-[13px] font-semibold text-[#E8ECF1]"
                          }
                        >
                          Far
                        </td>
                        {spreadSubType === "inter_commodity" && (
                          <td className={tdCls}>
                            <select
                              value={farCommodityId}
                              onChange={(e) =>
                                setFarCommodityId(e.target.value)
                              }
                              className={selectCls}
                            >
                              {commodities.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className={tdCls}>
                          <select
                            value={farMonth}
                            onChange={(e) =>
                              setFarMonth(e.target.value)
                            }
                            className={selectCls}
                          >
                            {monthOptions.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          className={
                            tdCls +
                            " text-[13px] font-medium text-[#D85A30]"
                          }
                        >
                          Sell
                        </td>
                        <td className={tdCls}>
                          <input
                            type="number"
                            step={tickSize}
                            value={farPrice}
                            onChange={(e) =>
                              setFarPrice(e.target.value)
                            }
                            className={inputCls + " font-mono"}
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Spread value */}
                {nearPrice && farPrice && (
                  <div className="mt-2 text-[13px] text-[#8B95A5]">
                    Spread:{" "}
                    <span className="font-mono text-[#E8ECF1]">
                      {fmtNum(
                        (Number(nearPrice) || 0) -
                          (Number(farPrice) || 0),
                        priceDecimals
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Volume */}
              <div>
                <div className={sectionLabel}>Volume</div>

                {/* Spread pair pills */}
                {spreadPairs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {spreadPairs.map((pair) => {
                      const active = activeSpreadPairs.includes(
                        pair.key
                      );
                      return (
                        <button
                          key={pair.key}
                          type="button"
                          onClick={() => toggleSpreadPair(pair.key)}
                          className={`rounded-[6px] px-3.5 py-1.5 text-[13px] transition-colors ${
                            active
                              ? "bg-[#378ADD] text-[#E8ECF1] font-medium"
                              : "bg-transparent text-[#556170] border border-[#1E3A5F] hover:text-[#8B95A5]"
                          }`}
                        >
                          {pair.label}
                        </button>
                      );
                    })}
                    <span className="text-[#1E3A5F] mx-1">|</span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSpreadPairs(
                          spreadPairs.map((p) => p.key)
                        )
                      }
                      className="text-[12px] text-[#378ADD] hover:underline"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSpreadPairs([])}
                      className="text-[12px] text-[#8B95A5] hover:underline ml-1"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Volume table */}
                {activeSpreadPairs.length > 0 && (
                  <div className="border border-[#1E3A5F] rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className={thCls}>Spread</th>
                          <th className={thCls}>Contracts</th>
                          <th className={thCls}>Volume</th>
                          <th className={thCls}>Spread value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spreadPairs
                          .filter((p) =>
                            activeSpreadPairs.includes(p.key)
                          )
                          .map((pair) => {
                            const c =
                              Number(
                                spreadPairContracts[pair.key]
                              ) || 0;
                            const vol = c * contractSize;
                            const spreadVal =
                              vol *
                              ((Number(nearPrice) || 0) -
                                (Number(farPrice) || 0));
                            return (
                              <tr
                                key={pair.key}
                                className={rowBorder}
                              >
                                <td
                                  className={
                                    tdCls +
                                    " text-[13px] font-semibold text-[#E8ECF1]"
                                  }
                                >
                                  {pair.label}
                                </td>
                                <td className={tdCls}>
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      spreadPairContracts[
                                        pair.key
                                      ] || ""
                                    }
                                    onChange={(e) =>
                                      setSpreadPairContracts(
                                        (prev) => ({
                                          ...prev,
                                          [pair.key]:
                                            e.target.value,
                                        })
                                      )
                                    }
                                    className={
                                      inputCls + " font-mono"
                                    }
                                    placeholder="1"
                                  />
                                </td>
                                <td
                                  className={
                                    tdCls +
                                    " font-mono text-[#8B95A5]"
                                  }
                                >
                                  {vol > 0
                                    ? vol.toLocaleString() +
                                      " " +
                                      volUnit
                                    : "—"}
                                </td>
                                <td
                                  className={
                                    tdCls +
                                    " font-mono text-[#556170]"
                                  }
                                >
                                  {vol > 0
                                    ? "$" + fmtNum(spreadVal)
                                    : "—"}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Spread summary */}
              {activeSpreadPairs.length > 0 && (
                <SummaryBar>
                  {activeSpreadPairs.length} spread
                  {activeSpreadPairs.length !== 1 ? "s" : ""}
                  {"  "}
                  <span className="font-mono text-[#E8ECF1]">
                    {spreadPairs
                      .filter((p) =>
                        activeSpreadPairs.includes(p.key)
                      )
                      .reduce(
                        (s, p) =>
                          s +
                          (Number(spreadPairContracts[p.key]) ||
                            0) *
                            contractSize,
                        0
                      )
                      .toLocaleString()}{" "}
                    {volUnit}
                  </span>
                  {"  "}Net{" "}
                  <span className="font-mono text-[#E8ECF1]">
                    $
                    {fmtNum(
                      spreadPairs
                        .filter((p) =>
                          activeSpreadPairs.includes(p.key)
                        )
                        .reduce(
                          (s, p) =>
                            s +
                            (Number(spreadPairContracts[p.key]) ||
                              0) *
                              contractSize *
                              ((Number(nearPrice) || 0) -
                                (Number(farPrice) || 0)),
                          0
                        )
                    )}
                  </span>
                </SummaryBar>
              )}
            </div>
          )}
        </div>

        {/* ─── Actions ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[#1E3A5F] flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-[#8B95A5] bg-[#1A2740] border border-[#1E3A5F] rounded-[6px] px-5 py-[10px] text-sm hover:text-[#E8ECF1] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#378ADD] text-white rounded-[6px] px-6 py-[10px] text-sm font-medium hover:bg-[#2B7ACC] disabled:opacity-50 transition-colors"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
