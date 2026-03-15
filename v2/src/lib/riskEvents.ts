import { on, EventTypes, type KernelEvent } from "./eventBus";

/**
 * Register Risk module event listeners.
 * Handles price updates (auto-MTM) and position changes (auto-limit-check).
 */
export function registerRiskEventListeners(): void {
  on(EventTypes.PRICE_UPDATED, "risk", async (_event: KernelEvent) => {
    // Future: trigger auto-MTM run
  });

  on(EventTypes.POSITION_ALLOCATED, "risk", async (_event: KernelEvent) => {
    // Future: auto-check position limits
  });

  on(EventTypes.EFP_EXECUTED, "risk", async (_event: KernelEvent) => {
    // Future: re-check position limits after EFP
  });

  on(EventTypes.PHYSICAL_CONTRACT_CREATED, "risk", async (_event: KernelEvent) => {
    // Future: update counterparty exposure
  });

  on(EventTypes.DELIVERY_RECORDED, "risk", async (_event: KernelEvent) => {
    // Future: update exposure after delivery
  });

  // Limit breach — keep as error for alerting
  on(EventTypes.LIMIT_BREACHED, "risk", async (event: KernelEvent) => {
    const { limitType, currentValue, limitValue, utilizationPct } = event.payload as {
      limitType?: string;
      currentValue?: number;
      limitValue?: number;
      utilizationPct?: number;
    };
    console.error(
      `[Risk] LIMIT BREACHED — ${limitType}: ${currentValue} / ${limitValue} (${utilizationPct?.toFixed(1)}%)`
    );
  });
}
