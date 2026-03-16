"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardAlert } from "@/types/dashboard";

interface Props {
  alerts: DashboardAlert[];
  loading: boolean;
}

const COLLAPSED_COUNT = 3;

const severityStyles: Record<string, { border: string; bg: string; icon: string; text: string }> = {
  critical: { border: "border-loss-30", bg: "bg-loss-10", icon: "text-loss", text: "text-loss" },
  warning:  { border: "border-warning-30", bg: "bg-warning-10", icon: "text-warning", text: "text-warning" },
  info:     { border: "border-action-20", bg: "bg-action-10", icon: "text-action", text: "text-action" },
};

function AlertIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  }
  if (severity === "warning") {
    return (
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function AlertsPanel({ alerts, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading && alerts.length === 0) return null;

  const visible = expanded ? alerts : alerts.slice(0, COLLAPSED_COUNT);
  const hasMore = alerts.length > COLLAPSED_COUNT;

  return (
    <div className="bg-surface border border-b-default rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Alerts</h2>
        {alerts.length > 0 && (
          <span className="rounded-full bg-loss/20 text-loss text-[10px] font-bold px-1.5 py-0.5 tabular-nums">
            {alerts.length}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {visible.map((alert) => {
          const style = severityStyles[alert.severity] ?? severityStyles.info;
          return (
            <div key={alert.id} className={`flex items-center gap-3 rounded border ${style.border} ${style.bg} px-3 py-2.5 animate-fade-in`}>
              <span className={style.icon}><AlertIcon severity={alert.severity} /></span>
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${style.text}`}>{alert.title}</span>
                <p className="text-[10px] text-muted mt-0.5 truncate">{alert.detail}</p>
              </div>
              {alert.link && (
                <Link href={alert.link} className="ml-auto text-[11px] font-medium text-action hover:underline shrink-0">
                  View
                </Link>
              )}
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-5 text-center">
            <svg className="h-5 w-5 text-profit mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-faint">All clear</span>
          </div>
        )}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-action hover:underline mt-1"
          >
            {expanded ? "Show less" : `Show ${alerts.length - COLLAPSED_COUNT} more`}
          </button>
        )}
      </div>
    </div>
  );
}
