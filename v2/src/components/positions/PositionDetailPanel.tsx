"use client";

import { InstrumentBadge } from "./InstrumentBadge";
import type { PmTrade } from "@/types/pm";

interface PositionDetailPanelProps {
  trade: PmTrade;
  onClose: () => void;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtNum(n: number | null, decimals = 2): string {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function Row({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-tbl-border last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-sm font-medium ${color ?? "text-primary"}`}>{value}</span>
    </div>
  );
}

export function PositionDetailPanel({ trade, onClose }: PositionDetailPanelProps) {
  const dirColor = (trade.direction === "long" || trade.direction === "buy") ? "text-profit" : "text-loss";
  const dirLabel = { long: "▲ Long", short: "▼ Short", buy: "▲ Buy", sell: "▼ Sell" }[trade.direction];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-b-default bg-surface shadow-2xl overflow-y-auto animate-slideIn">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-b-default">
        <div>
          <p className="font-mono text-sm text-action">{trade.trade_ref}</p>
          <p className="text-xs text-muted mt-0.5">{trade.category === "financial" ? "Financial" : "Physical"} Position</p>
        </div>
        <button onClick={onClose} className="text-faint hover:text-primary transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-5">
        {/* Common */}
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">General</h4>
          <Row label="Trade Date" value={fmtDate(trade.trade_date)} />
          <Row label="Direction" value={dirLabel} color={dirColor} />
          <Row label="Commodity" value={trade.commodity} />
          <Row label="Instrument" value={<InstrumentBadge instrument={trade.instrument} />} />
          <Row label="Quantity" value={fmtNum(Number(trade.quantity), 0)} />
          {trade.site_name && <Row label="Site" value={trade.site_name} />}
          {trade.portfolio_name && <Row label="Portfolio" value={trade.portfolio_name} />}
          {trade.budget_month && <Row label="Budget Month" value={trade.budget_month} />}
        </div>

        {/* Financial fields */}
        {trade.category === "financial" && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Financial</h4>
            {trade.contracts !== null && <Row label="Contracts" value={trade.contracts} />}
            {trade.contract_month && <Row label="Contract Month" value={trade.contract_month} />}
            <Row label="Trade Price" value={fmtNum(trade.trade_price !== null ? Number(trade.trade_price) : null, 5)} />
            <Row label="Market Price" value={fmtNum(trade.market_price !== null ? Number(trade.market_price) : null, 5)} />
            {trade.strike !== null && <Row label="Strike" value={fmtNum(Number(trade.strike), 5)} />}
            {trade.put_call && <Row label="Put/Call" value={trade.put_call} color="text-warning" />}
            {trade.premium !== null && <Row label="Premium" value={fmtNum(Number(trade.premium), 5)} />}
            {trade.delta !== null && <Row label="Delta" value={fmtNum(Number(trade.delta), 4)} />}
          </div>
        )}

        {/* Physical fields */}
        {trade.category === "physical" && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Physical</h4>
            {trade.basis !== null && (
              <Row
                label="Basis"
                value={fmtNum(Number(trade.basis), 4)}
                color={Number(trade.basis) >= 0 ? "text-profit" : "text-loss"}
              />
            )}
            {trade.board_month && <Row label="Board Month" value={trade.board_month} />}
            {trade.flat_price !== null && <Row label="Flat Price" value={fmtNum(Number(trade.flat_price), 5)} />}
            <Row
              label="Status"
              value={trade.is_priced ? "Priced" : "Unpriced"}
              color={trade.is_priced ? "text-profit" : "text-warning"}
            />
            {trade.delivery_location_name && <Row label="Delivery Location" value={trade.delivery_location_name} />}
            <Row
              label="Logistics"
              value={trade.logistics_assigned ? "Assigned" : "None"}
              color={trade.logistics_assigned ? "text-profit" : "text-faint"}
            />
          </div>
        )}

        {/* EFP */}
        {trade.efp_id && (
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">EFP</h4>
            <Row label="EFP ID" value={<span className="font-mono text-xs">{trade.efp_id}</span>} />
          </div>
        )}

        {/* Metadata */}
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Metadata</h4>
          <Row label="Created" value={fmtDate(trade.created_at)} />
          <Row label="Updated" value={fmtDate(trade.updated_at)} />
          <Row label="Active" value={trade.is_active ? "Yes" : "No"} color={trade.is_active ? "text-profit" : "text-loss"} />
        </div>
      </div>
    </div>
  );
}
