import { on, EventTypes, type KernelEvent } from "./eventBus";

/**
 * Register Settlement event listeners.
 * Listens for DELIVERY_RECORDED to prepare auto-invoice stubs.
 */
export function registerSettlementEventListeners(): void {
  // When a delivery is recorded, log for future auto-invoice generation
  on(EventTypes.DELIVERY_RECORDED, "settlement", async (event: KernelEvent) => {
    try {
      const { deliveryId, status } = event.payload as {
        deliveryId?: string;
        status?: string;
      };

      if (status !== "delivered") return;

      // Auto-invoice generation can be implemented here:
      // 1. Look up delivery details
      // 2. Find matching counterparty
      // 3. Create draft invoice with delivery as line item
    } catch (err) {
      console.error("[Settlement] Error handling DELIVERY_RECORDED:", err);
    }
  });
}
