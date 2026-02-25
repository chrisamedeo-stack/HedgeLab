"use client";

import Link from "next/link";
import { BookOpen, BarChart2, Activity, FileText, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KpiRowProps {
  totalBudgetBu: number;
  hedgeCoveragePct: number;
  openHedgeLots: number;
  activeContracts: number;
}

export function KpiRow({ totalBudgetBu, hedgeCoveragePct, openHedgeLots, activeContracts }: KpiRowProps) {
  const coverageColor =
    hedgeCoveragePct >= 80 ? "profit" :
    hedgeCoveragePct >= 50 ? "warning" : "destructive";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total Budget"
        value={`${formatNumber(Math.round(totalBudgetBu))} bu`}
        icon={BookOpen}
        href="/corn/budget"
      />
      <KpiCard
        label="Hedge Coverage"
        value={`${hedgeCoveragePct.toFixed(1)}%`}
        icon={BarChart2}
        href="/corn/coverage"
        highlight={coverageColor}
      />
      <KpiCard
        label="Open Hedge Lots"
        value={String(openHedgeLots)}
        icon={Activity}
        href="/corn/positions"
      />
      <KpiCard
        label="Active Contracts"
        value={String(activeContracts)}
        icon={FileText}
        href="/corn/contracts"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  highlight,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  href: string;
  highlight?: "profit" | "warning" | "destructive";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bg-surface border border-b-default rounded-lg p-5 block hover:border-b-input transition-colors group",
        highlight === "destructive" && "border-destructive-30 bg-destructive-5",
        highlight === "warning" && "border-warning-30 bg-warning-5",
        highlight === "profit" && "border-profit-30 bg-profit-5"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
        <Icon
          className={cn(
            "h-4 w-4",
            highlight === "destructive" ? "text-destructive" :
            highlight === "warning" ? "text-warning" :
            highlight === "profit" ? "text-profit" :
            "text-ph group-hover:text-muted transition-colors"
          )}
        />
      </div>
      <p className={cn(
        "text-2xl font-bold",
        highlight === "destructive" ? "text-destructive" :
        highlight === "warning" ? "text-warning" :
        highlight === "profit" ? "text-profit" :
        "text-primary"
      )}>
        {value}
      </p>
    </Link>
  );
}
