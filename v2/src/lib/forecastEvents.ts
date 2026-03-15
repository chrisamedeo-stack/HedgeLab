import { on, EventTypes, type KernelEvent } from "./eventBus";

// ─── Forecast Event Listeners ───────────────────────────────────────────────
// Stub listeners for upstream changes that may invalidate scenarios.
// Future: automatically mark affected scenarios as stale and re-run.

export function registerForecastEventListeners(): void {
  on(EventTypes.PRICE_UPDATED, "forecast", async (_event: KernelEvent) => {
    // Future: mark price-move scenarios as stale
  });

  on(EventTypes.MTM_CALCULATED, "forecast", async (_event: KernelEvent) => {
    // Future: refresh scenario baselines
  });

  on(EventTypes.POSITION_ALLOCATED, "forecast", async (_event: KernelEvent) => {
    // Future: mark what-if and coverage scenarios as stale
  });

  on(EventTypes.POSITION_DEALLOCATED, "forecast", async (_event: KernelEvent) => {
    // Future: mark what-if and coverage scenarios as stale
  });

  on(EventTypes.POSITION_ROLLED, "forecast", async (_event: KernelEvent) => {
    // Future: trigger scenario recalculation
  });
}
