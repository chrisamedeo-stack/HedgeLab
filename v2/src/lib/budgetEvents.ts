import { on, EventTypes, type KernelEvent } from "./eventBus";
import { query, queryOne, queryAll } from "./db";
import { auditLog } from "./audit";

/**
 * Register Budget module event listeners.
 * Consumes events from Position Manager to update budget line items.
 * Graceful degradation: if bgt_ tables don't exist yet, log and skip.
 */
export function registerBudgetEventListeners(): void {
  // When a hedge is allocated to a site, increment hedged_volume
  on(EventTypes.POSITION_ALLOCATED, "budget", async (event: KernelEvent) => {
    try {
      const {
        siteId,
        commodityId,
        budgetMonth,
        allocatedVolume,
        tradePrice,
      } = event.payload as {
        siteId?: string;
        commodityId?: string;
        budgetMonth?: string;
        allocatedVolume?: number;
        tradePrice?: number;
      };

      if (!siteId || !commodityId || !budgetMonth || !allocatedVolume) return;

      // Find matching budget line items across all active periods for this site+commodity
      const lineItems = await queryAll<{
        id: string;
        period_id: string;
        hedged_volume: string;
        hedged_avg_price: string | null;
        hedged_cost: string;
      }>(
        `SELECT li.id, li.period_id, li.hedged_volume, li.hedged_avg_price, li.hedged_cost
         FROM bgt_line_items li
         JOIN bgt_periods p ON p.id = li.period_id
         WHERE p.site_id = $1 AND p.commodity_id = $2 AND li.budget_month = $3
           AND p.status IN ('draft', 'submitted', 'approved')`,
        [siteId, commodityId, budgetMonth]
      );

      for (const li of lineItems) {
        const oldVol = Number(li.hedged_volume);
        const oldPrice = li.hedged_avg_price ? Number(li.hedged_avg_price) : 0;
        const oldCost = Number(li.hedged_cost);
        const newVol = oldVol + allocatedVolume;
        const newCost = oldCost + allocatedVolume * (tradePrice ?? 0);
        const newAvgPrice = newVol > 0 ? newCost / newVol : null;

        await query(
          `UPDATE bgt_line_items
           SET hedged_volume = $1, hedged_avg_price = $2, hedged_cost = $3, updated_at = NOW()
           WHERE id = $4`,
          [newVol, newAvgPrice, newCost, li.id]
        );

        await auditLog({
          orgId: event.orgId,
          userId: event.userId,
          module: "budget",
          entityType: "line_item",
          entityId: li.id,
          action: "hedge_allocated",
          before: { hedged_volume: oldVol, hedged_avg_price: oldPrice, hedged_cost: oldCost },
          after: { hedged_volume: newVol, hedged_avg_price: newAvgPrice, hedged_cost: newCost },
          notes: `Allocation event: +${allocatedVolume} @ ${tradePrice}`,
        });
      }

    } catch (err) {
      console.error("[Budget] Error handling POSITION_ALLOCATED:", err);
    }
  });

  // When a hedge is deallocated, decrement hedged_volume
  on(EventTypes.POSITION_DEALLOCATED, "budget", async (event: KernelEvent) => {
    try {
      const {
        siteId,
        commodityId,
        budgetMonth,
        deallocatedVolume,
        tradePrice,
      } = event.payload as {
        siteId?: string;
        commodityId?: string;
        budgetMonth?: string;
        deallocatedVolume?: number;
        tradePrice?: number;
      };

      if (!siteId || !commodityId || !budgetMonth || !deallocatedVolume) return;

      const lineItems = await queryAll<{
        id: string;
        hedged_volume: string;
        hedged_cost: string;
      }>(
        `SELECT li.id, li.hedged_volume, li.hedged_cost
         FROM bgt_line_items li
         JOIN bgt_periods p ON p.id = li.period_id
         WHERE p.site_id = $1 AND p.commodity_id = $2 AND li.budget_month = $3
           AND p.status IN ('draft', 'submitted', 'approved')`,
        [siteId, commodityId, budgetMonth]
      );

      for (const li of lineItems) {
        const oldVol = Number(li.hedged_volume);
        const oldCost = Number(li.hedged_cost);
        const newVol = Math.max(0, oldVol - deallocatedVolume);
        const newCost = Math.max(0, oldCost - deallocatedVolume * (tradePrice ?? 0));
        const newAvgPrice = newVol > 0 ? newCost / newVol : null;

        await query(
          `UPDATE bgt_line_items
           SET hedged_volume = $1, hedged_avg_price = $2, hedged_cost = $3, updated_at = NOW()
           WHERE id = $4`,
          [newVol, newAvgPrice, newCost, li.id]
        );
      }

    } catch (err) {
      console.error("[Budget] Error handling POSITION_DEALLOCATED:", err);
    }
  });

  // When a physical position is created, increment committed_volume
  on(EventTypes.PHYSICAL_POSITION_CREATED, "budget", async (event: KernelEvent) => {
    try {
      const {
        siteId,
        commodityId,
        budgetMonth,
        volume,
        price,
      } = event.payload as {
        siteId?: string;
        commodityId?: string;
        budgetMonth?: string;
        volume?: number;
        price?: number;
      };

      if (!siteId || !commodityId || !budgetMonth || !volume) return;

      const lineItems = await queryAll<{
        id: string;
        committed_volume: string;
        committed_avg_price: string | null;
        committed_cost: string;
      }>(
        `SELECT li.id, li.committed_volume, li.committed_avg_price, li.committed_cost
         FROM bgt_line_items li
         JOIN bgt_periods p ON p.id = li.period_id
         WHERE p.site_id = $1 AND p.commodity_id = $2 AND li.budget_month = $3
           AND p.status IN ('draft', 'submitted', 'approved')`,
        [siteId, commodityId, budgetMonth]
      );

      for (const li of lineItems) {
        const oldVol = Number(li.committed_volume);
        const oldCost = Number(li.committed_cost);
        const newVol = oldVol + volume;
        const newCost = oldCost + volume * (price ?? 0);
        const newAvgPrice = newVol > 0 ? newCost / newVol : null;

        await query(
          `UPDATE bgt_line_items
           SET committed_volume = $1, committed_avg_price = $2, committed_cost = $3, updated_at = NOW()
           WHERE id = $4`,
          [newVol, newAvgPrice, newCost, li.id]
        );
      }

    } catch (err) {
      console.error("[Budget] Error handling PHYSICAL_POSITION_CREATED:", err);
    }
  });

  // Note: PHYSICAL_CONTRACT_CREATED is NOT handled here because createContract()
  // already bridges to createPhysicalPosition() which emits PHYSICAL_POSITION_CREATED.
  // Handling both would double-count committed_volume.

  // When a position is rolled, move hedged_volume between months
  on(EventTypes.POSITION_ROLLED, "budget", async (event: KernelEvent) => {
    try {
      const {
        siteId,
        commodityId,
        closeMonth,
        openMonth,
        volume,
        closePrice,
        openPrice,
      } = event.payload as {
        siteId?: string;
        commodityId?: string;
        closeMonth?: string;
        openMonth?: string;
        volume?: number;
        closePrice?: number;
        openPrice?: number;
      };

      if (!siteId || !commodityId || !closeMonth || !openMonth || !volume) return;

      // Decrement from close month
      const closeItems = await queryAll<{ id: string; hedged_volume: string; hedged_cost: string }>(
        `SELECT li.id, li.hedged_volume, li.hedged_cost
         FROM bgt_line_items li JOIN bgt_periods p ON p.id = li.period_id
         WHERE p.site_id = $1 AND p.commodity_id = $2 AND li.budget_month = $3
           AND p.status IN ('draft', 'submitted', 'approved')`,
        [siteId, commodityId, closeMonth]
      );

      for (const li of closeItems) {
        const newVol = Math.max(0, Number(li.hedged_volume) - volume);
        const newCost = Math.max(0, Number(li.hedged_cost) - volume * (closePrice ?? 0));
        await query(
          `UPDATE bgt_line_items SET hedged_volume = $1, hedged_avg_price = CASE WHEN $1 > 0 THEN $2 / $1 ELSE NULL END, hedged_cost = $2, updated_at = NOW() WHERE id = $3`,
          [newVol, newCost, li.id]
        );
      }

      // Increment on open month
      const openItems = await queryAll<{ id: string; hedged_volume: string; hedged_cost: string }>(
        `SELECT li.id, li.hedged_volume, li.hedged_cost
         FROM bgt_line_items li JOIN bgt_periods p ON p.id = li.period_id
         WHERE p.site_id = $1 AND p.commodity_id = $2 AND li.budget_month = $3
           AND p.status IN ('draft', 'submitted', 'approved')`,
        [siteId, commodityId, openMonth]
      );

      for (const li of openItems) {
        const newVol = Number(li.hedged_volume) + volume;
        const newCost = Number(li.hedged_cost) + volume * (openPrice ?? 0);
        await query(
          `UPDATE bgt_line_items SET hedged_volume = $1, hedged_avg_price = CASE WHEN $1 > 0 THEN $2 / $1 ELSE NULL END, hedged_cost = $2, updated_at = NOW() WHERE id = $3`,
          [newVol, newCost, li.id]
        );
      }

    } catch (err) {
      console.error("[Budget] Error handling POSITION_ROLLED:", err);
    }
  });
}
