import { on, EventTypes, type KernelEvent } from "./eventBus";
import { query } from "./db";

/**
 * Register Logistics event listeners.
 * Handles DELIVERY_RECORDED → update contract delivered_volume.
 */
export function registerLogisticsEventListeners(): void {
  // When a delivery is recorded with status 'delivered', update the linked contract
  on(EventTypes.DELIVERY_RECORDED, "logistics", async (event: KernelEvent) => {
    try {
      const { contractId, volume, status } = event.payload as {
        contractId?: string | null;
        volume?: number;
        status?: string;
      };

      // Only update contract on actual delivery from logistics (not from contracts — it already updates itself)
      if (!contractId || !volume || status !== "delivered") return;
      if (event.source === "contracts") return;

      // Check if ct_physical_contracts table exists (soft reference — contracts plugin optional)
      try {
        await query(
          `UPDATE ct_physical_contracts
           SET delivered_volume = delivered_volume + $1, updated_at = NOW()
           WHERE id = $2`,
          [volume, contractId]
        );
      } catch (err) {
        // Table may not exist if contracts plugin not installed — graceful degradation
        console.warn("[Logistics] Could not update contract delivered_volume:", (err as Error).message);
      }
    } catch (err) {
      console.error("[Logistics] Error handling DELIVERY_RECORDED:", err);
    }
  });
}
