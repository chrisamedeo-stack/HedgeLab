"use client";

import Link from "next/link";
import type { RolloverCandidate } from "@/types/positions";
import { chartTheme } from "@/lib/chartTheme";

interface ExpiringPositionsCardProps {
  candidates: RolloverCandidate[];
}

const urgencyConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  CRITICAL: { label: "Critical", bg: "bg-loss/15", text: "text-loss", border: "border-loss/30" },
  URGENT: { label: "Urgent", bg: "bg-warning/15", text: "text-warning", border: "border-warning/30" },
  UPCOMING: { label: "Upcoming", bg: "bg-muted/15", text: "text-muted", border: "border-muted/30" },
};

export function ExpiringPositionsCard({ candidates }: ExpiringPositionsCardProps) {
  // Sort by urgency: CRITICAL → URGENT → UPCOMING
  const urgencyOrder = { CRITICAL: 0, URGENT: 1, UPCOMING: 2 };
  const sorted = [...candidates]
    .sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3))
    .slice(0, 5);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Expiring Positions</h2>
        <Link href="/roll-candidates" className="text-xs font-medium text-action hover:underline">
          View All
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <span className="text-sm text-faint">No roll candidates</span>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => {
            const cfg = urgencyConfig[c.urgency] ?? urgencyConfig.UPCOMING;
            const daysLabel = c.days_to_first_notice != null
              ? `${c.days_to_first_notice}d to FND`
              : c.days_to_last_trade != null
              ? `${c.days_to_last_trade}d to LTD`
              : "";

            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}
              >
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-secondary truncate">{c.site_name}</span>
                    <span className="text-[10px] text-faint">{c.commodity_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-muted">{c.contract_month}</span>
                    <span className="text-[10px] tabular-nums text-muted">{c.allocated_volume.toLocaleString()}</span>
                  </div>
                </div>
                {daysLabel && (
                  <span className={`shrink-0 text-xs font-medium tabular-nums ${cfg.text}`}>
                    {daysLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
