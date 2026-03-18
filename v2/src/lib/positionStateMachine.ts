// ─── Position Status State Machine ──────────────────────────────────────────
// Pure functions — no DB calls. Validates transitions and returns available actions.

import type { PositionStatus } from "@/types/positions";
import type { TradeType } from "@/types/trades";

// ─── Transition Map ─────────────────────────────────────────────────────────

const TRANSITIONS: Record<PositionStatus, PositionStatus[]> = {
  unallocated:      ["budget_allocated", "site_allocated", "partial"],
  budget_allocated: ["site_allocated", "partial"],
  site_allocated:   ["efp", "offset", "exercised", "expired", "partial"],
  efp:              [],
  offset:           [],
  exercised:        [],
  expired:          [],
  partial:          [],
};

// ─── Instrument Constraints ─────────────────────────────────────────────────

const INSTRUMENT_ONLY: Partial<Record<PositionStatus, TradeType[]>> = {
  efp:       ["futures"],
  exercised: ["options"],
  expired:   ["options"],
};

// ─── Actions ────────────────────────────────────────────────────────────────

export interface PositionAction {
  key: string;
  label: string;
  targetStatus: PositionStatus;
  requiresModal: boolean;
}

const ACTION_DEFS: Record<string, PositionAction> = {
  allocate_budget: {
    key: "allocate_budget",
    label: "Assign Budget Month",
    targetStatus: "budget_allocated",
    requiresModal: true,
  },
  allocate_site: {
    key: "allocate_site",
    label: "Allocate to Site",
    targetStatus: "site_allocated",
    requiresModal: true,
  },
  efp: {
    key: "efp",
    label: "Execute EFP",
    targetStatus: "efp",
    requiresModal: true,
  },
  offset: {
    key: "offset",
    label: "Offset",
    targetStatus: "offset",
    requiresModal: true,
  },
  exercise: {
    key: "exercise",
    label: "Exercise Option",
    targetStatus: "exercised",
    requiresModal: true,
  },
  expire: {
    key: "expire",
    label: "Expire Option",
    targetStatus: "expired",
    requiresModal: true,
  },
  split: {
    key: "split",
    label: "Split",
    targetStatus: "partial",
    requiresModal: true,
  },
};

// Map from target status to action key
const STATUS_TO_ACTION: Record<string, string> = {
  budget_allocated: "allocate_budget",
  site_allocated: "allocate_site",
  efp: "efp",
  offset: "offset",
  exercised: "exercise",
  expired: "expire",
  partial: "split",
};

// ─── Public API ─────────────────────────────────────────────────────────────

export function validateTransition(
  fromStatus: PositionStatus,
  toStatus: PositionStatus,
  instrumentType: TradeType
): { valid: boolean; reason?: string } {
  // Check basic transition is allowed
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed || !allowed.includes(toStatus)) {
    return { valid: false, reason: `Cannot transition from '${fromStatus}' to '${toStatus}'` };
  }

  // Check instrument constraints
  const constraint = INSTRUMENT_ONLY[toStatus];
  if (constraint && !constraint.includes(instrumentType)) {
    return {
      valid: false,
      reason: `Status '${toStatus}' is only valid for ${constraint.join("/")} trades, not '${instrumentType}'`,
    };
  }

  return { valid: true };
}

// Actions excluded from the position-manager context (terminal actions belong at site level)
const PM_EXCLUDED_ACTIONS = new Set(["efp", "offset", "exercise", "expire"]);

export function getAvailableActions(
  fromStatus: PositionStatus,
  instrumentType: TradeType,
  context?: "position-manager" | "site"
): PositionAction[] {
  const targets = TRANSITIONS[fromStatus] ?? [];
  const actions: PositionAction[] = [];

  for (const target of targets) {
    const actionKey = STATUS_TO_ACTION[target];
    if (!actionKey) continue;
    const action = ACTION_DEFS[actionKey];
    if (!action) continue;

    // Check instrument constraint
    const constraint = INSTRUMENT_ONLY[target];
    if (constraint && !constraint.includes(instrumentType)) continue;

    // Exclude terminal actions from position-manager context
    if (context === "position-manager" && PM_EXCLUDED_ACTIONS.has(actionKey)) continue;

    actions.push(action);
  }

  return actions;
}
