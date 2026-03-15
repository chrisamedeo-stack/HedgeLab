import { on, EventTypes, type KernelEvent } from "./eventBus";
import { query, queryAll } from "./db";
import { auditLog } from "./audit";

/**
 * Register Position Manager event listeners.
 * Handles events from Trade Capture and Market Data modules.
 */
export function registerPositionEventListeners(): void {
  // When a trade is created, PM may need to auto-allocate
  on(EventTypes.TRADE_CREATED, "positions", async (event: KernelEvent) => {
    // Auto-allocation not implemented — trades are allocated manually via the UI
  });

  // When a trade is updated, refresh snapshot fields on linked allocations
  on(EventTypes.TRADE_UPDATED, "positions", async (event: KernelEvent) => {
    const tradeId = event.entityId;
    if (!tradeId) return;

    const { tradePrice, tradeDate, contractMonth, direction } = event.payload as {
      tradePrice?: number;
      tradeDate?: string;
      contractMonth?: string;
      direction?: string;
    };

    const allocations = await queryAll<{ id: string; org_id: string }>(
      `SELECT id, org_id FROM pm_allocations WHERE trade_id = $1 AND status NOT IN ('cancelled')`,
      [tradeId]
    );

    for (const alloc of allocations) {
      const before = await import("./db").then((db) =>
        db.queryOne(`SELECT * FROM pm_allocations WHERE id = $1`, [alloc.id])
      );

      await query(
        `UPDATE pm_allocations
         SET trade_price = COALESCE($1, trade_price),
             trade_date = COALESCE($2, trade_date),
             contract_month = COALESCE($3, contract_month),
             direction = COALESCE($4, direction)
         WHERE id = $5`,
        [tradePrice ?? null, tradeDate ?? null, contractMonth ?? null, direction ?? null, alloc.id]
      );

      const after = await import("./db").then((db) =>
        db.queryOne(`SELECT * FROM pm_allocations WHERE id = $1`, [alloc.id])
      );

      await auditLog({
        orgId: alloc.org_id,
        userId: event.userId,
        module: "positions",
        entityType: "allocation",
        entityId: alloc.id,
        action: "snapshot_refresh",
        before: before as Record<string, unknown> | null,
        after: after as Record<string, unknown> | null,
        notes: `Refreshed from trade ${tradeId}`,
      });
    }
  });

  // When a trade is cancelled, auto-cancel open allocations linked to it
  on(EventTypes.TRADE_CANCELLED, "positions", async (event: KernelEvent) => {
    const tradeId = event.entityId;
    if (!tradeId) return;

    const openAllocs = await queryAll<{ id: string; org_id: string }>(
      `SELECT id, org_id FROM pm_allocations WHERE trade_id = $1 AND status = 'open'`,
      [tradeId]
    );

    for (const alloc of openAllocs) {
      await query(
        `UPDATE pm_allocations SET status = 'cancelled', notes = COALESCE(notes || E'\\n', '') || $1 WHERE id = $2`,
        [`[Auto-cancelled] Trade ${tradeId} was cancelled`, alloc.id]
      );

      await auditLog({
        orgId: alloc.org_id,
        userId: event.userId,
        module: "positions",
        entityType: "allocation",
        entityId: alloc.id,
        action: "cancel",
        notes: `Auto-cancelled: trade ${tradeId} was cancelled`,
      });
    }
  });

  // When a price update arrives, log for observability.
  // Open board P&L is calculated on-demand in getSitePosition(), so no cache to invalidate.
  on(EventTypes.PRICE_UPDATED, "positions", async (event: KernelEvent) => {
    const { commodityId, contractMonth, price } = event.payload as {
      commodityId?: string;
      contractMonth?: string;
      price?: number;
    };
    // Open board P&L is calculated on-demand in getSitePosition()
  });
}
