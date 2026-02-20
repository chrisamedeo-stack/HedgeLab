"use client";

import { useState } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Zap,
  Lock,
  AlertCircle,
} from "lucide-react";
import { usePositions, useSites, CorporatePoolItem, PhysicalPositionItem } from "@/hooks/useCorn";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmt2(n: number | null | undefined): string {
  if (n == null) return "–";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMt(n: number | null | undefined): string {
  if (n == null) return "–";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtPnl(n: number | null | undefined): string {
  if (n == null) return "–";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "–";
  return `$${fmt2(n)}`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── ZC → delivery month mapping (mirrors backend ZcMonthMapper) ─────────────

function getValidDeliveryMonths(futuresMonth: string): string[] {
  if (!futuresMonth || futuresMonth.length < 5) return [];
  const upper = futuresMonth.toUpperCase();
  if (!upper.startsWith("ZC")) return [];
  const mc   = upper[2];
  const year = 2000 + parseInt(upper.slice(3), 10);
  if (isNaN(year)) return [];
  const pad = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  switch (mc) {
    case "H": return [pad(year - 1, 12), pad(year, 1), pad(year, 2)];
    case "K": return [pad(year, 3), pad(year, 4)];
    case "N": return [pad(year, 5), pad(year, 6)];
    case "U": return [pad(year, 7), pad(year, 8)];
    case "Z": return [pad(year, 9), pad(year, 10), pad(year, 11)];
    default:  return [];
  }
}

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
      init[fm] = existingSettles[fm] != null ? String(existingSettles[fm]) : "";
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
          <input
            type="date"
            value={settleDate}
            onChange={(e) => setSettleDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
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
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 w-36 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Publish"}
        </button>
        <button
          onClick={onDone}
          className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── EFP Form ────────────────────────────────────────────────────────────────

function EFPForm({
  hedge,
  physicalPositions,
  sites,
  onDone,
  onCancel,
}: {
  hedge: CorporatePoolItem;
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const validMonths = getValidDeliveryMonths(hedge.futuresMonth);

  const [lots, setLots]           = useState("");
  const [site, setSite]           = useState("");
  const [month, setMonth]         = useState("");
  const [contractId, setContractId] = useState("");
  const [boardPrice, setBoardPrice] = useState(
    hedge.settlePrice != null ? String(hedge.settlePrice / 100) : ""
  );
  const [efpDate, setEfpDate]     = useState(today());
  const [confirmRef, setConfirmRef] = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);

  // Filter physical positions by site + valid delivery months
  const eligible = physicalPositions.filter(
    (p) =>
      (!site  || p.siteCode === site) &&
      (!month || p.deliveryMonth === month) &&
      validMonths.includes(p.deliveryMonth) &&
      !["CLOSED", "CANCELLED"].includes(p.status)
  );

  async function handleSubmit() {
    const lotsN = parseInt(lots, 10);
    if (!lotsN || lotsN <= 0 || lotsN > hedge.openLots) {
      toast.toast(`Lots must be 1–${hedge.openLots}`, "error");
      return;
    }
    if (!contractId) { toast.toast("Select a physical contract", "error"); return; }
    if (!boardPrice)  { toast.toast("Enter a board price", "error"); return; }
    if (!efpDate)     { toast.toast("Enter an EFP date", "error"); return; }

    const selectedContract = physicalPositions.find((p) => String(p.contractId) === contractId);
    setSaving(true);
    try {
      await api.post("/api/v1/corn/efp", {
        hedgeTradeId:      hedge.hedgeTradeId,
        physicalContractId: parseInt(contractId, 10),
        lots:              lotsN,
        boardPrice:        parseFloat(boardPrice) * 100,
        basisValue:        selectedContract?.basisValue ?? null,
        efpDate,
        confirmationRef:   confirmRef,
        notes,
      });
      toast.toast(`EFP executed — ${lotsN} lots allocated from ${hedge.tradeRef}`, "success");
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
          Execute EFP — {hedge.tradeRef} ({hedge.futuresMonth})
        </span>
        <span className="ml-auto text-xs text-slate-500">{hedge.openLots} lots available</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {/* Lots */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Lots (max {hedge.openLots})</label>
          <input
            type="number"
            min={1}
            max={hedge.openLots}
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            placeholder={`1–${hedge.openLots}`}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Site */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Site</label>
          <select
            value={site}
            onChange={(e) => { setSite(e.target.value); setContractId(""); }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
            ))}
          </select>
        </div>

        {/* Delivery Month */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Delivery Month</label>
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setContractId(""); }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All months</option>
            {validMonths.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Physical Contract */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Physical Contract</label>
          <select
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select contract…</option>
            {eligible.map((p) => (
              <option key={p.contractId} value={p.contractId}>
                {p.contractRef} — {p.siteCode} {p.deliveryMonth}
              </option>
            ))}
          </select>
          {eligible.length === 0 && (site || month) && (
            <span className="text-xs text-amber-400">No open contracts for selection</span>
          )}
        </div>

        {/* Board Price */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Board Price ($/bu)</label>
          <input
            type="number"
            step="0.0025"
            value={boardPrice}
            onChange={(e) => setBoardPrice(e.target.value)}
            placeholder="e.g. 4.39"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* EFP Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">EFP Date</label>
          <input
            type="date"
            value={efpDate}
            onChange={(e) => setEfpDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Confirmation Ref */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Confirmation Ref</label>
          <input
            type="text"
            value={confirmRef}
            onChange={(e) => setConfirmRef(e.target.value)}
            placeholder="Broker ref…"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional…"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
        >
          <Zap className="h-3.5 w-3.5" />
          {saving ? "Executing…" : "Execute EFP"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Corporate Pool Table ─────────────────────────────────────────────────────

function CorporatePoolTable({
  pool,
  physicalPositions,
  sites,
  onRefresh,
}: {
  pool: CorporatePoolItem[];
  physicalPositions: PhysicalPositionItem[];
  sites: { code: string; name: string }[];
  onRefresh: () => void;
}) {
  const [efpHedgeId, setEfpHedgeId] = useState<number | null>(null);
  const activeHedge = efpHedgeId != null ? pool.find((h) => h.hedgeTradeId === efpHedgeId) : null;

  function handleEfpDone() {
    setEfpHedgeId(null);
    onRefresh();
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/50">
              {["Trade Ref", "ZC Month", "Total Lots", "Open Lots", "Open MT", "Entry $/bu", "Settle $/bu", "MTM P&L", "Broker", ""].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {pool.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                  No open hedge positions
                </td>
              </tr>
            )}
            {pool.map((h) => {
              const hasMtm    = h.mtmPnlUsd != null;
              const mtmPos    = hasMtm && (h.mtmPnlUsd ?? 0) > 0;
              const mtmNeg    = hasMtm && (h.mtmPnlUsd ?? 0) < 0;
              const isEfpOpen = efpHedgeId === h.hedgeTradeId;
              return (
                <>
                  <tr
                    key={h.hedgeTradeId}
                    className={`border-t border-slate-800 hover:bg-slate-800/30 transition-colors ${isEfpOpen ? "bg-slate-800/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-slate-200 text-xs">{h.tradeRef}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                        {h.futuresMonth}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{h.lots}</td>
                    <td className="px-4 py-3">
                      <span className={h.openLots === 0 ? "text-slate-500" : "text-emerald-400 font-semibold"}>
                        {h.openLots}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtMt(h.openMt)}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{h.entryPrice != null ? (h.entryPrice / 100).toFixed(4) : "–"}</td>
                    <td className="px-4 py-3 font-mono">
                      {h.settlePrice != null ? (
                        <span className="text-slate-200">{(h.settlePrice / 100).toFixed(4)}</span>
                      ) : (
                        <span className="text-slate-600 italic text-xs">no settle</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {hasMtm ? (
                        <span className={`flex items-center gap-1 ${mtmPos ? "text-emerald-400" : mtmNeg ? "text-red-400" : "text-slate-400"}`}>
                          {mtmPos ? <TrendingUp className="h-3.5 w-3.5" /> : mtmNeg ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          {fmtPnl(h.mtmPnlUsd)}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{h.brokerAccount}</td>
                    <td className="px-4 py-3">
                      {h.openLots > 0 && (
                        <button
                          onClick={() => setEfpHedgeId(isEfpOpen ? null : h.hedgeTradeId)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Zap className="h-3 w-3" />
                          EFP
                          {isEfpOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isEfpOpen && activeHedge && (
                    <tr key={`${h.hedgeTradeId}-efp`} className="border-t border-slate-800">
                      <td colSpan={10} className="px-4 py-3">
                        <EFPForm
                          hedge={activeHedge}
                          physicalPositions={physicalPositions}
                          sites={sites}
                          onDone={handleEfpDone}
                          onCancel={() => setEfpHedgeId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Physical Positions Table ─────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "OPEN":         return "text-slate-400";
    case "BASIS_LOCKED": return "text-blue-400";
    case "EFP_EXECUTED": return "text-emerald-400";
    case "PO_ISSUED":    return "text-emerald-500";
    default:             return "text-slate-500";
  }
}

function PhysicalPositionsTable({ positions }: { positions: PhysicalPositionItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Month", "Site", "Contract", "Supplier", "Committed MT", "Basis $/bu", "Board $/bu", "All-In $/MT", "Status"].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                No active physical contracts
              </td>
            </tr>
          )}
          {positions.map((p) => (
            <tr key={p.contractId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 font-mono text-slate-300 text-xs">{p.deliveryMonth}</td>
              <td className="px-4 py-3">
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">
                  {p.siteCode}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-slate-400 text-xs">{p.contractRef}</td>
              <td className="px-4 py-3 text-slate-400 text-xs">{p.supplierName}</td>
              <td className="px-4 py-3 text-slate-300">{fmtMt(p.committedMt)}</td>
              <td className="px-4 py-3">
                {p.basisLocked ? (
                  <span className="flex items-center gap-1 text-blue-300 font-mono">
                    <Lock className="h-3 w-3 text-blue-400" />
                    {p.basisValue != null ? (p.basisValue / 100).toFixed(4) : "–"}
                  </span>
                ) : (
                  <span className="text-slate-600 italic text-xs">open</span>
                )}
              </td>
              <td className="px-4 py-3">
                {p.efpExecuted ? (
                  <span className="text-emerald-400 font-mono">{p.boardPriceLocked != null ? (p.boardPriceLocked / 100).toFixed(4) : "–"}</span>
                ) : (
                  <span className="text-slate-600 italic text-xs">open</span>
                )}
              </td>
              <td className="px-4 py-3">
                {p.allInPricePerMt != null ? (
                  <span className="text-emerald-300 font-semibold">{fmtUsd(p.allInPricePerMt)}</span>
                ) : (
                  <span className="text-slate-600 italic text-xs">–</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${statusColor(p.status)}`}>{p.status.replace("_", " ")}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Locked Positions Table ───────────────────────────────────────────────────

function LockedPositionsTable({
  locked,
}: {
  locked: import("@/hooks/useCorn").LockedPositionItem[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800/50">
            {["Ticket", "Site", "Delivery", "ZC Month", "Lots", "Board $/bu", "Basis $/bu", "Freight $/MT", "All-In $/MT", "MT", "EFP Date", "Confirm Ref"].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {locked.length === 0 && (
            <tr>
              <td colSpan={12} className="px-4 py-8 text-center text-slate-500 text-sm">
                No EFP positions locked yet
              </td>
            </tr>
          )}
          {locked.map((l) => (
            <tr key={l.efpTicketId} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 font-mono text-slate-300 text-xs">{l.ticketRef}</td>
              <td className="px-4 py-3">
                <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">{l.siteCode}</span>
              </td>
              <td className="px-4 py-3 font-mono text-slate-400 text-xs">{l.deliveryMonth}</td>
              <td className="px-4 py-3">
                <span className="bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20 px-2 py-0.5 rounded text-xs font-mono">
                  {l.futuresMonth}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-300">{l.lots}</td>
              <td className="px-4 py-3 text-emerald-400 font-mono">{l.boardPrice != null ? (l.boardPrice / 100).toFixed(4) : "–"}</td>
              <td className="px-4 py-3 text-slate-400 font-mono">{l.basisValue != null ? (l.basisValue / 100).toFixed(4) : "–"}</td>
              <td className="px-4 py-3 text-slate-400 font-mono">{fmt2(l.freightValue)}</td>
              <td className="px-4 py-3">
                <span className="text-emerald-300 font-semibold">{fmtUsd(l.allInPricePerMt)}</span>
              </td>
              <td className="px-4 py-3 text-slate-300">{fmtMt(l.quantityMt)}</td>
              <td className="px-4 py-3 text-slate-500 text-xs font-mono">{l.efpDate}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{l.confirmationRef || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { positions, isLoading, error, mutate } = usePositions();
  const { sites } = useSites();
  const [settleOpen, setSettleOpen] = useState(false);

  const pool     = positions?.corporatePool     ?? [];
  const physical = positions?.physicalPositions ?? [];
  const locked   = positions?.lockedPositions   ?? [];
  const settles  = positions?.latestSettles     ?? {};

  // Unique futures months with open lots — for settle publisher
  const openFuturesMonths = Array.from(new Set(pool.map((h) => h.futuresMonth)));

  // Gap detection: physical commitments with no open hedge covering that month
  const coveredMonths = new Set(
    pool.flatMap((h) => getValidDeliveryMonths(h.futuresMonth))
  );
  const uncoveredPhysical = physical.filter(
    (p) => !p.efpExecuted && !coveredMonths.has(p.deliveryMonth)
  );

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
    return (
      <EmptyState
        icon={AlertCircle}
        title="Failed to load positions"
        description={error.message}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">Position Manager</h1>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Canada</span>
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

      {/* Gap alert */}
      {uncoveredPhysical.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Coverage gap detected</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {uncoveredPhysical.length} physical contract{uncoveredPhysical.length > 1 ? "s" : ""} have delivery months not covered by open futures:{" "}
              {uncoveredPhysical.map((p) => `${p.contractRef} (${p.deliveryMonth})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Settle publisher */}
      {settleOpen && (
        <SettlePublisher
          futuresMonths={openFuturesMonths.length > 0 ? openFuturesMonths : ["ZCH26", "ZCK26", "ZCN26"]}
          existingSettles={settles}
          onDone={() => { setSettleOpen(false); mutate(); }}
        />
      )}

      {/* Panel 1 — Canada Hedge Book */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Canada Hedge Book — Corporate Pool</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {pool.length} position{pool.length !== 1 ? "s" : ""} ·{" "}
              {pool.reduce((s, h) => s + h.openLots, 0)} open lots ·{" "}
              {fmtMt(pool.reduce((s, h) => s + (h.openMt ?? 0), 0))} MT
            </p>
          </div>
          <span className="text-xs text-slate-600">Click EFP to allocate</span>
        </div>
        <CorporatePoolTable
          pool={pool}
          physicalPositions={physical}
          sites={sites}
          onRefresh={() => mutate()}
        />
      </div>

      {/* Panel 2 — Physical Commitments */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Physical Commitments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {physical.length} active contract{physical.length !== 1 ? "s" : ""} ·{" "}
            {fmtMt(physical.reduce((s, p) => s + p.committedMt, 0))} MT committed
          </p>
        </div>
        <PhysicalPositionsTable positions={physical} />
      </div>

      {/* Panel 3 — Locked Positions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">Locked Positions — EFP Executed</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {locked.length} EFP ticket{locked.length !== 1 ? "s" : ""} ·{" "}
            {locked.reduce((s, l) => s + l.lots, 0)} lots locked
          </p>
        </div>
        <LockedPositionsTable locked={locked} />
      </div>
    </div>
  );
}
