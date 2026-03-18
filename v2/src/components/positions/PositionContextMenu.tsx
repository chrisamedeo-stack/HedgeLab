"use client";

import { useEffect, useRef } from "react";
import { useFeatureFlags } from "@/contexts/FeatureFlagContext";
import { useOrgScope } from "@/contexts/OrgScopeContext";
import type { PmTrade, TradeInstrument, FeatureFlag } from "@/types/pm";

interface ActionDef {
  label: string;
  instruments: TradeInstrument[];
  flag: FeatureFlag | null;
}

const FINANCIAL_ACTIONS: ActionDef[] = [
  { label: "Define Site", instruments: ["futures", "swap_otc", "call_option", "put_option"], flag: null },
  { label: "Define Budget Month", instruments: ["futures", "swap_otc", "call_option", "put_option"], flag: "budget_month" },
  { label: "EFP", instruments: ["futures"], flag: "efp_module" },
  { label: "Roll", instruments: ["futures"], flag: "roll_action" },
  { label: "Offset / Close", instruments: ["futures", "swap_otc"], flag: "offset_close_action" },
  { label: "Exercise", instruments: ["call_option", "put_option"], flag: "options_trading" },
  { label: "View Details", instruments: ["futures", "swap_otc", "call_option", "put_option"], flag: null },
];

const PHYSICAL_ACTIONS: ActionDef[] = [
  { label: "Define Location", instruments: ["fixed_price", "hta", "basis", "index"], flag: null },
  { label: "Define Budget Month", instruments: ["fixed_price", "hta", "basis", "index"], flag: "budget_month" },
  { label: "Assign Portfolio", instruments: ["fixed_price", "hta", "basis", "index"], flag: "multi_portfolio" },
  { label: "Add Basis", instruments: ["hta", "index"], flag: "basis_trading" },
  { label: "Price / Fix", instruments: ["hta", "basis", "index"], flag: null },
  { label: "EFP", instruments: ["fixed_price", "hta"], flag: "efp_module" },
  { label: "Logistics", instruments: ["fixed_price", "hta", "basis", "index"], flag: "logistics_module" },
  { label: "View Details", instruments: ["fixed_price", "hta", "basis", "index"], flag: null },
];

interface PositionContextMenuProps {
  trade: PmTrade;
  x: number;
  y: number;
  onClose: () => void;
  onAction: (action: string, trade: PmTrade) => void;
}

export function PositionContextMenu({ trade, x, y, onClose, onAction }: PositionContextMenuProps) {
  const { isEnabled } = useFeatureFlags();
  const { leafTier } = useOrgScope();
  const menuRef = useRef<HTMLDivElement>(null);

  const actions = trade.category === "financial" ? FINANCIAL_ACTIONS : PHYSICAL_ACTIONS;

  const visibleActions = actions.filter((a) => {
    if (!a.instruments.includes(trade.instrument)) return false;
    if (a.flag && !isEnabled(a.flag)) return false;
    return true;
  });

  // Adapt "Define Site" label to leaf tier name
  const getLabel = (action: ActionDef): string => {
    if (action.label === "Define Site" && leafTier) {
      return `Define ${leafTier.tier_name}`;
    }
    if (action.label === "Define Location" && leafTier) {
      return `Define ${leafTier.tier_name}`;
    }
    return action.label;
  };

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg border border-b-default bg-surface shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {visibleActions.map((action) => (
        <button
          key={action.label}
          onClick={() => {
            onAction(action.label, trade);
            onClose();
          }}
          className="w-full text-left px-3 py-1.5 text-sm text-secondary hover:bg-hover hover:text-primary transition-colors"
        >
          {getLabel(action)}
        </button>
      ))}
    </div>
  );
}
