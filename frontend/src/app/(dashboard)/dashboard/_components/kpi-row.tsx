"use client";

import Link from "next/link";
import { BookOpen, BarChart2, Activity, FileText, DollarSign, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { fmtPnl, pnlColor } from "@/lib/corn-format";
import { cn } from "@/lib/utils";

// ─── Generic cards-based API ─────────────────────────────────────────────────

export interface KpiCardDef {
  label: string;
  value: number;
  unit: "bu" | "pct" | "count" | "usd";
}

interface GenericKpiRowProps {
  cards: KpiCardDef[];
}

// ─── Legacy props (still used by the company-level page.tsx) ─────────────────

interface LegacyKpiRowProps {
  totalBudgetBu: number;
  hedgeCoveragePct: number;
  openHedgeLots: number;
  activeContracts: number;
}

type KpiRowProps = GenericKpiRowProps | LegacyKpiRowProps;

function isGeneric(props: KpiRowProps): props is GenericKpiRowProps {
  return "cards" in props;
}

const iconMap: Record<string, LucideIcon> = {
  "Total Budget": BookOpen,
  "Budget": BookOpen,
  "Site Budget": BookOpen,
  "Hedge Coverage": BarChart2,
  "Open Hedge Lots": Activity,
  "Active Contracts": FileText,
  "Portfolio MTM": DollarSign,
};

const hrefMap: Record<string, string> = {
  "Total Budget": "/corn/budget",
  "Budget": "/corn/budget",
  "Site Budget": "/corn/budget",
  "Hedge Coverage": "/corn/coverage",
  "Open Hedge Lots": "/corn/positions",
  "Active Contracts": "/corn/contracts",
  "Portfolio MTM": "/corn/positions",
};

function formatCardValue(value: number, unit: string): string {
  switch (unit) {
    case "bu":
      return `${formatNumber(Math.round(value))} bu`;
    case "pct":
      return `${value.toFixed(1)}%`;
    case "usd":
      return fmtPnl(value);
    case "count":
    default:
      return String(Math.round(value));
  }
}

function highlightForCard(value: number, unit: string): "profit" | "warning" | "destructive" | undefined {
  if (unit === "pct") {
    return value >= 80 ? "profit" : value >= 50 ? "warning" : "destructive";
  }
  if (unit === "usd") {
    return value >= 0 ? "profit" : "destructive";
  }
  return undefined;
}

export function KpiRow(props: KpiRowProps) {
  if (isGeneric(props)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {props.cards.map((card) => {
          const highlight = highlightForCard(card.value, card.unit);
          return (
            <KpiCard
              key={card.label}
              label={card.label}
              value={formatCardValue(card.value, card.unit)}
              icon={iconMap[card.label] ?? BookOpen}
              href={hrefMap[card.label] ?? "#"}
              highlight={highlight}
            />
          );
        })}
      </div>
    );
  }

  // Legacy path
  const { totalBudgetBu, hedgeCoveragePct, openHedgeLots, activeContracts } = props;
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
