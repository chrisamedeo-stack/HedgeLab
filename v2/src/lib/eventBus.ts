import { query } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KernelEvent {
  type: string;
  source: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  orgId?: string;
  userId?: string;
}

type EventHandler = ((event: KernelEvent) => Promise<void>) & {
  moduleName?: string;
};

// ─── In-process listener registry ────────────────────────────────────────────

const listeners: Record<string, EventHandler[]> = {};
let listenersRegistered = false;

/**
 * Ensure cross-module event listeners are registered in this process.
 * Called lazily on first emit() so listeners always exist in the same
 * JS process/worker that fires events (Next.js may run API routes in
 * a different worker than instrumentation.ts).
 */
async function ensureListeners(): Promise<void> {
  if (listenersRegistered) return;
  listenersRegistered = true;
  try {
    const { registerBudgetEventListeners } = await import("./budgetEvents");
    const { registerPositionEventListeners } = await import("./positionEvents");
    registerBudgetEventListeners();
    registerPositionEventListeners();
    console.log("[EventBus] Listeners auto-registered: budget, positions");
  } catch (err) {
    console.error("[EventBus] Failed to auto-register listeners:", err);
  }
}

/** Register a handler for an event type */
export function on(
  eventType: string,
  moduleName: string,
  handler: (event: KernelEvent) => Promise<void>
): void {
  const wrapped = handler as EventHandler;
  wrapped.moduleName = moduleName;
  if (!listeners[eventType]) listeners[eventType] = [];
  listeners[eventType].push(wrapped);
}

/** Remove all handlers for a module */
export function off(eventType: string, moduleName: string): void {
  if (!listeners[eventType]) return;
  listeners[eventType] = listeners[eventType].filter(
    (h) => h.moduleName !== moduleName
  );
}

/** Emit an event — persists to event_log and invokes all registered handlers */
export async function emit(event: KernelEvent): Promise<bigint> {
  // Ensure listeners are registered in this process
  await ensureListeners();

  // Persist to event_log
  const result = await query<{ id: string }>(
    `INSERT INTO event_log
       (event_type, source_module, entity_type, entity_id, payload, org_id, user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      event.type,
      event.source,
      event.entityType ?? null,
      event.entityId ?? null,
      JSON.stringify(event.payload),
      event.orgId ?? null,
      event.userId ?? null,
    ]
  );
  const eventId = BigInt(result.rows[0].id);

  // Invoke registered handlers (fire-and-forget for non-critical, await for critical)
  const handlers = listeners[event.type] ?? [];
  const processed: string[] = [];

  for (const handler of handlers) {
    try {
      await handler(event);
      if (handler.moduleName) processed.push(handler.moduleName);
    } catch (err) {
      console.error(
        `[EventBus] Handler failed for ${event.type} (${handler.moduleName}):`,
        err
      );
    }
  }

  // Update processed_by
  if (processed.length > 0) {
    await query(
      `UPDATE event_log SET processed_by = $1 WHERE id = $2`,
      [processed, eventId.toString()]
    );
  }

  return eventId;
}

// ─── Known event types ───────────────────────────────────────────────────────

export const EventTypes = {
  TRADE_CREATED: "TRADE_CREATED",
  TRADE_UPDATED: "TRADE_UPDATED",
  TRADE_CANCELLED: "TRADE_CANCELLED",
  POSITION_ALLOCATED: "POSITION_ALLOCATED",
  POSITION_DEALLOCATED: "POSITION_DEALLOCATED",
  EFP_EXECUTED: "EFP_EXECUTED",
  POSITION_OFFSET: "POSITION_OFFSET",
  POSITION_ROLLED: "POSITION_ROLLED",
  ROLL_DEADLINE_WARNING: "ROLL_DEADLINE_WARNING",
  PHYSICAL_POSITION_CREATED: "PHYSICAL_POSITION_CREATED",
  PHYSICAL_CONTRACT_CREATED: "PHYSICAL_CONTRACT_CREATED",
  DELIVERY_RECORDED: "DELIVERY_RECORDED",
  PRICE_UPDATED: "PRICE_UPDATED",
  MTM_CALCULATED: "MTM_CALCULATED",
  LIMIT_BREACHED: "LIMIT_BREACHED",
  IMPORT_COMMITTED: "IMPORT_COMMITTED",
  SCENARIO_COMPLETED: "SCENARIO_COMPLETED",
} as const;
