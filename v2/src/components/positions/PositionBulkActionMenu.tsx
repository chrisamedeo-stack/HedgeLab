"use client";

import { useState, useRef, useEffect } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import type { TradeCategory, FeatureFlag, TradeInstrument } from "@/types/pm";

interface BulkActionDef {
  label: string;
  action: string;
  flag: FeatureFlag | null;
}

const FINANCIAL_BULK_ACTIONS: BulkActionDef[] = [
  { label: "Define Site", action: "define-site", flag: null },
  { label: "Define Budget Month", action: "define-budget-month", flag: "budget_month" },
  { label: "Assign Portfolio", action: "assign-portfolio", flag: "multi_portfolio" },
];

const PHYSICAL_BULK_ACTIONS: BulkActionDef[] = [
  { label: "Define Location", action: "define-site", flag: null },
  { label: "Define Budget Month", action: "define-budget-month", flag: "budget_month" },
  { label: "Assign Portfolio", action: "assign-portfolio", flag: "multi_portfolio" },
];

interface PositionBulkActionMenuProps {
  category: TradeCategory;
  selectedCount: number;
  onAction: (action: string) => void;
}

export function PositionBulkActionMenu({ category, selectedCount, onAction }: PositionBulkActionMenuProps) {
  const { isEnabled } = useFeatureFlags();
  const { leafTier } = useOrgScope();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = category === "financial" ? FINANCIAL_BULK_ACTIONS : PHYSICAL_BULK_ACTIONS;
  const visibleActions = actions.filter((a) => !a.flag || isEnabled(a.flag));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-sm font-medium text-white hover:bg-action-hover transition-colors"
      >
        Take Action ({selectedCount})
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-40 min-w-[180px] rounded-lg border border-b-default bg-surface shadow-lg py-1">
          {visibleActions.map((a) => {
            let label = a.label;
            if ((label === "Define Site" || label === "Define Location") && leafTier) {
              label = `Define ${leafTier.tier_name}`;
            }
            return (
              <button
                key={a.action}
                onClick={() => {
                  onAction(a.action);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-secondary hover:bg-hover hover:text-primary transition-colors"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
