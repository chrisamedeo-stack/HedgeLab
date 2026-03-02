import { on, EventTypes, type KernelEvent } from "./eventBus";

/**
 * Register Market Data event listeners.
 * Handles events from Import module for auto-detection of price data.
 */
export function registerMarketEventListeners(): void {
  // When an import is committed, check if it contained price data
  on(EventTypes.IMPORT_COMMITTED, "market", async (event: KernelEvent) => {
    const { targetTable, jobId } = event.payload as {
      targetTable?: string;
      jobId?: string;
    };

    if (targetTable === "md_prices") {
      console.log("[MD] Import committed with price data, job:", jobId);
      // Future: auto-refresh caches, notify WebSocket subscribers
    }
  });
}
