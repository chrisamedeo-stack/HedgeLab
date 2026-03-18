"use client";

import { useState, use } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { useSiteView, useCommodities } from "@/hooks/usePositions";
import { CommodityFilter } from "@/components/ui/CommodityFilter";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KPICard } from "@/components/ui/KPICard";
import { LockModal } from "@/components/positions/LockModal";
import { OffsetModal } from "@/components/positions/OffsetModal";
import { PhysicalForm } from "@/components/positions/PhysicalForm";
import { formatContractMonth } from "@/lib/commodity-utils";
import type { SitePositionHedge, PhysicalPosition, OpenBoardEntry, AllInSummaryEntry } from "@/types/positions";

function fmtVol(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPrice(v: unknown): string {
  const n = Number(v);
  if (!n) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export default function SiteViewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);
  const { orgId } = useOrgContext();
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);
  const [lockTarget, setLockTarget] = useState<SitePositionHedge | null>(null);
  const [offsetTarget, setOffsetTarget] = useState<SitePositionHedge | null>(null);
  const [showPhysicalForm, setShowPhysicalForm] = useState(false);

  const { data: siteView, loading, refetch } = useSiteView(siteId, selectedCommodity ?? undefined);
  const { data: commodities } = useCommodities();

  // ─── Section 1: Hedges ─────────────────────────────────────────────────────
  const hedgeColumns: Column<SitePositionHedge>[] = [
    { key: "contract_month", header: "Contract", width: "90px", render: (r) => formatContractMonth(r.contract_month) },
    {
      key: "direction", header: "Dir", width: "70px",
      render: (r) => (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          r.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
        }`}>
          {r.direction === "long" ? "LONG" : r.direction === "short" ? "SHORT" : "—"}
        </span>
      ),
    },
    { key: "allocated_volume", header: "Volume", align: "right", render: (r) => fmtVol(r.allocated_volume) },
    { key: "trade_price", header: "Trade Price", align: "right", render: (r) => fmtPrice(r.trade_price) },
    { key: "locked_price", header: "Lock Price", align: "right", render: (r) => fmtPrice(r.locked_price) },
    { key: "futures_pnl", header: "Futures P&L", align: "right", render: (r) => fmtPrice(r.futures_pnl) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "", sortable: false, width: "140px",
      render: (r) => r.status === "open" ? (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setLockTarget(r); }}
            className="rounded bg-profit px-2 py-1 text-xs font-medium text-white hover:bg-profit-hover"
          >
            Lock
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOffsetTarget(r); }}
            className="rounded bg-warning px-2 py-1 text-xs font-medium text-white hover:bg-warning-hover"
          >
            Offset
          </button>
        </div>
      ) : null,
    },
  ];

  // ─── Section 2: Physicals ──────────────────────────────────────────────────
  const physicalColumns: Column<PhysicalPosition>[] = [
    { key: "delivery_month", header: "Delivery", width: "90px", render: (r) => formatContractMonth(r.delivery_month) },
    {
      key: "direction", header: "Dir", width: "70px",
      render: (r) => (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          r.direction === "buy" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
        }`}>
          {r.direction === "buy" ? "BUY" : "SELL"}
        </span>
      ),
    },
    { key: "volume", header: "Volume", align: "right", render: (r) => fmtVol(r.volume) },
    { key: "price", header: "Price", align: "right", render: (r) => fmtPrice(r.price) },
    { key: "pricing_type", header: "Type", render: (r) => r.pricing_type },
    { key: "counterparty", header: "Counterparty", render: (r) => r.counterparty ?? "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // ─── Section 3: Open Board ─────────────────────────────────────────────────
  const openBoardColumns: Column<OpenBoardEntry>[] = [
    { key: "contract_month", header: "Contract", width: "90px", render: (r) => formatContractMonth(r.contract_month) },
    {
      key: "direction", header: "Dir", width: "70px",
      render: (r) => (
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          r.direction === "long" ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
        }`}>
          {r.direction === "long" ? "LONG" : r.direction === "short" ? "SHORT" : "—"}
        </span>
      ),
    },
    { key: "volume", header: "Volume", align: "right", render: (r) => fmtVol(r.volume) },
    { key: "trade_price", header: "Trade Price", align: "right", render: (r) => fmtPrice(r.trade_price) },
    {
      key: "market_price", header: "Market Price", align: "right",
      render: (r) => r.market_price ? fmtPrice(r.market_price) : <span className="text-faint">—</span>,
    },
    {
      key: "unrealized_pnl", header: "Unrealized P&L", align: "right",
      render: (r) => {
        if (r.unrealized_pnl == null) return <span className="text-faint">—</span>;
        const n = Number(r.unrealized_pnl);
        const color = n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-secondary";
        return <span className={color}>{fmtPrice(r.unrealized_pnl)}</span>;
      },
    },
  ];

  // ─── Section 4: All-In Summary ─────────────────────────────────────────────
  const summaryColumns: Column<AllInSummaryEntry>[] = [
    { key: "delivery_month", header: "Delivery", render: (r) => formatContractMonth(r.delivery_month) },
    { key: "total_volume", header: "Volume", align: "right", render: (r) => fmtVol(r.total_volume) },
    { key: "vwap_locked_price", header: "VWAP Lock", align: "right", render: (r) => fmtPrice(r.vwap_locked_price) },
    { key: "avg_basis", header: "Avg Basis", align: "right", render: (r) => fmtPrice(r.avg_basis) },
    { key: "total_roll_costs", header: "Roll Costs", align: "right", render: (r) => fmtPrice(r.total_roll_costs) },
    { key: "all_in_price", header: "All-In", align: "right", render: (r) => (
      <span className="font-semibold text-primary">{fmtPrice(r.all_in_price)}</span>
    )},
    { key: "currency", header: "CCY", width: "50px" },
  ];

  const totalOpen = siteView?.hedges.filter((h) => h.status === "open").length ?? 0;
  const totalLocked = siteView?.hedges.filter((h) => h.status === "efp_closed").length ?? 0;

  return (
    <div className="space-y-6 page-fade">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Site Position</h1>
          <p className="mt-0.5 text-lg font-semibold text-primary">
            {siteView?.siteName ?? "Loading..."}
            {siteView && <span className="ml-2 text-sm font-normal text-faint">{siteView.siteCode}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {commodities && (
            <CommodityFilter
              commodities={commodities}
              selected={selectedCommodity}
              onSelect={setSelectedCommodity}
            />
          )}
          <button
            onClick={() => setShowPhysicalForm(true)}
            className="rounded-lg bg-hover px-3 py-1.5 text-sm font-medium text-secondary transition-colors hover:bg-hover"
          >
            + Physical
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Open Hedges"
          value={totalOpen}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>}
        />
        <KPICard
          label="Locked Hedges"
          value={totalLocked}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
        />
        <KPICard
          label="Physical Positions"
          value={siteView?.physicals.length ?? 0}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>}
        />
        <KPICard
          label="All-In Months"
          value={siteView?.allInSummary.length ?? 0}
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-faint">Loading site position...</div>
      ) : (
        <>
          {/* Section 1: Hedges */}
          <Section title="Hedges" count={siteView?.hedges.length}>
            <DataTable<SitePositionHedge>
              columns={hedgeColumns}
              data={siteView?.hedges ?? []}
              emptyMessage="No hedges allocated to this site"
            />
          </Section>

          {/* Section 2: Physical Commitments */}
          <Section title="Physical Commitments" count={siteView?.physicals.length}>
            <DataTable<PhysicalPosition>
              columns={physicalColumns}
              data={siteView?.physicals ?? []}
              emptyMessage="No physical positions"
            />
          </Section>

          {/* Section 3: Open Board */}
          <Section title="Open Board" count={siteView?.openBoard.length}>
            <DataTable<OpenBoardEntry>
              columns={openBoardColumns}
              data={siteView?.openBoard ?? []}
              emptyMessage="No open positions"
            />
          </Section>

          {/* Section 4: All-In Summary */}
          <Section title="All-In Summary" count={siteView?.allInSummary.length}>
            <DataTable<AllInSummaryEntry>
              columns={summaryColumns}
              data={siteView?.allInSummary ?? []}
              emptyMessage="No locked positions to summarize"
            />
          </Section>
        </>
      )}

      {/* Action Modals */}
      {lockTarget && (
        <LockModal
          allocation={lockTarget}
          onClose={() => setLockTarget(null)}
          onSuccess={() => { setLockTarget(null); refetch(); }}
        />
      )}
      {offsetTarget && (
        <OffsetModal
          allocation={offsetTarget}
          onClose={() => setOffsetTarget(null)}
          onSuccess={() => { setOffsetTarget(null); refetch(); }}
        />
      )}
      {showPhysicalForm && siteView && (
        <PhysicalForm
          orgId={orgId}
          siteId={siteId}
          commodities={commodities ?? []}
          onClose={() => setShowPhysicalForm(false)}
          onSuccess={() => { setShowPhysicalForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-b-default bg-surface">
      <div className="border-b border-b-default px-4 py-2.5">
        <h2 className="text-sm font-semibold text-secondary">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-xs font-normal text-faint">({count})</span>
          )}
        </h2>
      </div>
      {children}
    </div>
  );
}
