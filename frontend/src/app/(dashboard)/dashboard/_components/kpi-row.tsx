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
    hedgeCoveragePct >= 80 ? "emerald" :
    hedgeCoveragePct >= 50 ? "amber" : "red";

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
  highlight?: "emerald" | "amber" | "red";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bg-slate-900 border border-slate-800 rounded-xl p-5 block hover:border-slate-700 transition-colors group",
        highlight === "red" && "border-red-500/30 bg-red-500/5",
        highlight === "amber" && "border-amber-500/30 bg-amber-500/5",
        highlight === "emerald" && "border-emerald-500/30 bg-emerald-500/5"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <Icon
          className={cn(
            "h-4 w-4",
            highlight === "red" ? "text-red-400" :
            highlight === "amber" ? "text-amber-400" :
            highlight === "emerald" ? "text-emerald-400" :
            "text-slate-600 group-hover:text-slate-400 transition-colors"
          )}
        />
      </div>
      <p className={cn(
        "text-2xl font-bold",
        highlight === "red" ? "text-red-300" :
        highlight === "amber" ? "text-amber-300" :
        highlight === "emerald" ? "text-emerald-300" :
        "text-slate-100"
      )}>
        {value}
      </p>
    </Link>
  );
}
