"use client";

import type { SiteOperationalData } from "@/types/dashboard";

interface Props {
  data: SiteOperationalData | null;
  siteId: string;
  commodityId?: string;
  loading: boolean;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">{title}</h3>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-6 text-center text-xs text-faint">{message}</td>
    </tr>
  );
}

const thCls = "px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap text-left";
const tdCls = "px-4 py-2.5 text-xs tabular-nums";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: "bg-action/15 text-action",
    efp_closed: "bg-profit/15 text-profit",
    offset: "bg-muted/15 text-muted",
    rolled: "bg-warning/15 text-warning",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[status] ?? "bg-input-bg text-muted"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function SiteOperationalView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface border border-b-default rounded-lg p-4">
            <div className="h-3 w-32 mb-3 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
            <div className="h-24 rounded bg-gradient-to-r from-input-bg via-b-input to-input-bg bg-[length:200%_100%] animate-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { hedges, physicals, openBoard, allInSummary, coverageSummary } = data;

  return (
    <div className="space-y-4">
      {/* Coverage summary card */}
      {coverageSummary && (
        <div className="flex items-center gap-4 bg-surface border border-b-default rounded-lg px-4 py-3">
          <span className="text-xs text-muted">Site Coverage</span>
          <div className="flex-1 h-2 bg-input-bg rounded-full overflow-hidden max-w-xs">
            <div
              className={`h-full rounded-full ${
                coverageSummary.pct >= 80 ? "bg-profit" : coverageSummary.pct >= 50 ? "bg-warning" : "bg-loss"
              }`}
              style={{ width: `${Math.min(coverageSummary.pct, 100)}%` }}
            />
          </div>
          <span className={`text-sm font-bold tabular-nums ${
            coverageSummary.pct >= 80 ? "text-profit" : coverageSummary.pct >= 50 ? "text-warning" : "text-loss"
          }`}>
            {coverageSummary.pct}%
          </span>
          <span className="text-[10px] text-faint">
            {coverageSummary.covered.toLocaleString()} / {coverageSummary.budgeted.toLocaleString()}
          </span>
        </div>
      )}

      {/* Section 1: Hedge Positions */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <SectionHeader title="Hedge Positions" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default bg-input-bg/50">
                <th className={thCls}>Month</th>
                <th className={thCls}>Direction</th>
                <th className={`${thCls} text-right`}>Volume</th>
                <th className={`${thCls} text-right`}>Trade Price</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} text-right`}>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {hedges.length === 0 ? (
                <EmptyRow message="No hedge positions" />
              ) : (
                hedges.map((h) => (
                  <tr key={h.id} className="hover:bg-row-hover transition-colors">
                    <td className={tdCls}>{h.contract_month}</td>
                    <td className={tdCls}>
                      <span className={h.direction === "long" ? "text-profit" : "text-loss"}>
                        {h.direction}
                      </span>
                    </td>
                    <td className={`${tdCls} text-right`}>{Number(h.allocated_volume).toLocaleString()}</td>
                    <td className={`${tdCls} text-right`}>
                      {h.trade_price != null ? `$${Number(h.trade_price).toFixed(4)}` : "\u2014"}
                    </td>
                    <td className={tdCls}><StatusBadge status={h.status} /></td>
                    <td className={`${tdCls} text-right font-medium ${
                      h.unrealized_pnl != null && h.unrealized_pnl > 0 ? "text-profit" :
                      h.unrealized_pnl != null && h.unrealized_pnl < 0 ? "text-loss" : "text-muted"
                    }`}>
                      {h.unrealized_pnl != null ? `$${h.unrealized_pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Physical Commitments */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <SectionHeader title="Physical Commitments" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default bg-input-bg/50">
                <th className={thCls}>Month</th>
                <th className={thCls}>Direction</th>
                <th className={`${thCls} text-right`}>Volume</th>
                <th className={`${thCls} text-right`}>Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {physicals.length === 0 ? (
                <EmptyRow message="No physical commitments" />
              ) : (
                physicals.map((p) => (
                  <tr key={p.id} className="hover:bg-row-hover transition-colors">
                    <td className={tdCls}>{p.delivery_month}</td>
                    <td className={tdCls}>
                      <span className={p.direction === "purchase" ? "text-profit" : "text-loss"}>
                        {p.direction}
                      </span>
                    </td>
                    <td className={`${tdCls} text-right`}>{Number(p.volume).toLocaleString()}</td>
                    <td className={`${tdCls} text-right`}>
                      {p.price != null ? `$${Number(p.price).toFixed(4)}` : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Open Board */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <SectionHeader title="Open Board" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default bg-input-bg/50">
                <th className={thCls}>Month</th>
                <th className={thCls}>Direction</th>
                <th className={`${thCls} text-right`}>Volume</th>
                <th className={`${thCls} text-right`}>Trade Price</th>
                <th className={`${thCls} text-right`}>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {openBoard.length === 0 ? (
                <EmptyRow message="No open positions" />
              ) : (
                openBoard.map((o, i) => (
                  <tr key={i} className="hover:bg-row-hover transition-colors">
                    <td className={tdCls}>{o.contract_month}</td>
                    <td className={tdCls}>
                      {o.direction ? (
                        <span className={o.direction === "long" ? "text-profit" : "text-loss"}>
                          {o.direction}
                        </span>
                      ) : "\u2014"}
                    </td>
                    <td className={`${tdCls} text-right`}>{o.volume.toLocaleString()}</td>
                    <td className={`${tdCls} text-right`}>
                      {o.trade_price != null ? `$${o.trade_price.toFixed(4)}` : "\u2014"}
                    </td>
                    <td className={`${tdCls} text-right font-medium ${
                      o.unrealized_pnl != null && o.unrealized_pnl > 0 ? "text-profit" :
                      o.unrealized_pnl != null && o.unrealized_pnl < 0 ? "text-loss" : "text-muted"
                    }`}>
                      {o.unrealized_pnl != null ? `$${o.unrealized_pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 4: All-In Summary */}
      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <SectionHeader title="All-In Summary" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-b-default bg-input-bg/50">
                <th className={thCls}>Delivery Month</th>
                <th className={`${thCls} text-right`}>Volume</th>
                <th className={`${thCls} text-right`}>Avg Futures</th>
                <th className={`${thCls} text-right`}>Avg Basis</th>
                <th className={`${thCls} text-right`}>Roll Costs</th>
                <th className={`${thCls} text-right`}>All-In Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-b-default">
              {allInSummary.length === 0 ? (
                <EmptyRow message="No locked positions" />
              ) : (
                allInSummary.map((a) => (
                  <tr key={a.delivery_month} className="hover:bg-row-hover transition-colors">
                    <td className={tdCls}>{a.delivery_month}</td>
                    <td className={`${tdCls} text-right`}>{a.total_volume.toLocaleString()}</td>
                    <td className={`${tdCls} text-right`}>
                      {a.vwap_locked_price != null ? `$${a.vwap_locked_price.toFixed(4)}` : "\u2014"}
                    </td>
                    <td className={`${tdCls} text-right`}>
                      {a.avg_basis != null ? `$${a.avg_basis.toFixed(4)}` : "\u2014"}
                    </td>
                    <td className={`${tdCls} text-right`}>${a.total_roll_costs.toFixed(2)}</td>
                    <td className={`${tdCls} text-right font-medium text-secondary`}>
                      {a.all_in_price != null ? `$${a.all_in_price.toFixed(4)}` : "\u2014"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
