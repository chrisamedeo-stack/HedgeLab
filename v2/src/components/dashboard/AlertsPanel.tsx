"use client";

import Link from "next/link";
import type { RolloverCandidate } from "@/types/positions";

interface Props {
  totalOpen: number;
  pendingApproval: number;
  criticalRolls: RolloverCandidate[];
}

export function AlertsPanel({ totalOpen, pendingApproval, criticalRolls }: Props) {
  const alertCount = (totalOpen > 0 ? 1 : 0) + (pendingApproval > 0 ? 1 : 0) + (criticalRolls.length > 0 ? 1 : 0);

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Alerts</h2>
        {alertCount > 0 && (
          <span className="rounded-full bg-loss/20 text-loss text-[10px] font-bold px-1.5 py-0.5 tabular-nums">
            {alertCount}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {totalOpen > 0 && (
          <div className="flex items-center gap-3 rounded border border-warning-30 bg-warning-10 px-3 py-2.5 animate-fade-in">
            <svg className="h-4 w-4 text-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-warning font-medium">{Number(totalOpen).toLocaleString()} unhedged volume</span>
            <Link href="/coverage" className="ml-auto text-[11px] font-medium text-action hover:underline">View</Link>
          </div>
        )}
        {pendingApproval > 0 && (
          <div className="flex items-center gap-3 rounded border border-action-20 bg-action-10 px-3 py-2.5 animate-fade-in">
            <svg className="h-4 w-4 text-action shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-action font-medium">{pendingApproval} period{pendingApproval !== 1 ? "s" : ""} pending approval</span>
            <Link href="/budget" className="ml-auto text-[11px] font-medium text-action hover:underline">View</Link>
          </div>
        )}
        {criticalRolls.length > 0 && (
          <div className="flex items-center gap-3 rounded border border-loss-30 bg-loss-10 px-3 py-2.5 animate-fade-in">
            <svg className="h-4 w-4 text-loss shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-loss font-medium">
              {criticalRolls.length} critical roll{criticalRolls.length !== 1 ? "s" : ""}
            </span>
            <Link href="/position-manager" className="ml-auto text-[11px] font-medium text-action hover:underline">View</Link>
          </div>
        )}
        {alertCount === 0 && (
          <div className="flex flex-col items-center justify-center py-5 text-center">
            <svg className="h-5 w-5 text-profit mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-faint">All clear</span>
          </div>
        )}
      </div>
    </div>
  );
}
