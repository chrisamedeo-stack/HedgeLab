"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { CoverageResponse, CornPositionResponse, PhysicalContractResponse } from "@/hooks/useCorn";
import { cn } from "@/lib/utils";

interface AlertsPanelProps {
  coverage: CoverageResponse[];
  positions: CornPositionResponse | undefined;
  contracts: PhysicalContractResponse[];
  filterSiteCodes?: string[];
}

interface Alert {
  type: "warning" | "info";
  message: string;
}

export function AlertsPanel({ coverage, positions, contracts, filterSiteCodes }: AlertsPanelProps) {
  const alerts: Alert[] = [];

  const filteredCoverage = filterSiteCodes
    ? coverage.filter((c) => filterSiteCodes.includes(c.siteCode))
    : coverage;
  const filteredContracts = filterSiteCodes
    ? contracts.filter((c) => filterSiteCodes.includes(c.siteCode))
    : contracts;

  // Over-hedged months
  for (const site of filteredCoverage) {
    for (const m of site.months ?? []) {
      if (m.coveragePct > 100) {
        alerts.push({
          type: "warning",
          message: `${site.siteName} is over-hedged in ${m.month} (${m.coveragePct.toFixed(0)}% coverage)`,
        });
      }
    }
  }

  // Unallocated hedge lots
  const unallocLots = positions?.hedgeBook?.reduce((s, h) => s + (h.unallocatedLots ?? 0), 0) ?? 0;
  if (unallocLots > 0) {
    alerts.push({
      type: "info",
      message: `${unallocLots} hedge lot${unallocLots !== 1 ? "s" : ""} unallocated — assign to budget months in Position Manager`,
    });
  }

  // Upcoming deliveries (contracts with delivery month within 30 days)
  const now = new Date();
  const thirtyDaysOut = new Date(now);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const upcoming = filteredContracts.filter((c) => {
    if (c.status === "CANCELLED" || c.status === "CLOSED") return false;
    if (!c.deliveryMonth) return false;
    const deliveryDate = new Date(c.deliveryMonth + "-01");
    return deliveryDate >= now && deliveryDate <= thirtyDaysOut;
  });
  if (upcoming.length > 0) {
    alerts.push({
      type: "info",
      message: `${upcoming.length} contract${upcoming.length !== 1 ? "s" : ""} with delivery in the next 30 days`,
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-profit-5 border border-profit-20 rounded-lg p-5 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-profit shrink-0" />
        <div>
          <p className="text-sm font-medium text-profit">All clear</p>
          <p className="text-xs text-faint mt-0.5">No alerts or actions needed right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-b-default rounded-lg p-5">
      <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-3">
        Alerts
      </h2>
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              alert.type === "warning"
                ? "bg-warning-5 border-warning-20"
                : "bg-action-5 border-action-20"
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                alert.type === "warning" ? "text-warning" : "text-action"
              )}
            />
            <p className={cn(
              "text-sm",
              alert.type === "warning" ? "text-warning" : "text-action"
            )}>
              {alert.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
