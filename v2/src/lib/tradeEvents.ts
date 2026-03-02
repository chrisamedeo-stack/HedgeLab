import { on, EventTypes, type KernelEvent } from "./eventBus";
import { updateAllocatedVolume } from "./tradeService";

/**
 * Register Trade Capture event listeners.
 * Listens for Position Manager events to keep trade allocation status in sync.
 */
export function registerTradeEventListeners(): void {
  // When a position is allocated, recalculate the trade's allocated_volume
  on(EventTypes.POSITION_ALLOCATED, "trades", async (event: KernelEvent) => {
    const tradeId = event.payload.tradeId as string | undefined;
    if (!tradeId) return;
    console.log("[TC] Position allocated — updating trade volume:", tradeId);
    await updateAllocatedVolume(tradeId);
  });

  // When a position is deallocated, recalculate the trade's allocated_volume
  on(EventTypes.POSITION_DEALLOCATED, "trades", async (event: KernelEvent) => {
    const tradeId = event.payload.tradeId as string | undefined;
    if (!tradeId) return;
    console.log("[TC] Position deallocated — updating trade volume:", tradeId);
    await updateAllocatedVolume(tradeId);
  });

  // When a position is rolled, link new trade if created
  on(EventTypes.POSITION_ROLLED, "trades", async (event: KernelEvent) => {
    const sourceTradeId = event.payload.sourceTradeId as string | undefined;
    if (!sourceTradeId) return;
    console.log("[TC] Position rolled — recalculating source trade:", sourceTradeId);
    await updateAllocatedVolume(sourceTradeId);
  });
}
