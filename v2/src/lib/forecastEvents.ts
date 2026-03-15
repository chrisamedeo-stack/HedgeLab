import { on, EventTypes, type KernelEvent } from "./eventBus";

// ─── Forecast Event Listeners ───────────────────────────────────────────────
// Stub listeners that log when upstream changes may invalidate scenarios.
// Future: automatically mark affected scenarios as stale and re-run.

export function registerForecastEventListeners(): void {
  on(EventTypes.PRICE_UPDATED, "forecast", async (event: KernelEvent) => {
    console.log(
      `[forecast] PRICE_UPDATED for ${event.payload?.commodityId ?? "unknown"} — ` +
      `completed scenarios using this commodity may be stale`
    );
  });

  on(EventTypes.MTM_CALCULATED, "forecast", async (_event: KernelEvent) => {
    console.log(
      `[forecast] MTM_CALCULATED — scenario baselines may need refresh`
    );
  });

  on(EventTypes.POSITION_ALLOCATED, "forecast", async (_event: KernelEvent) => {
    console.log(
      `[forecast] POSITION_ALLOCATED — what-if and coverage scenarios may be stale`
    );
  });

  on(EventTypes.POSITION_DEALLOCATED, "forecast", async (_event: KernelEvent) => {
    console.log(
      `[forecast] POSITION_DEALLOCATED — what-if and coverage scenarios may be stale`
    );
  });

  on(EventTypes.POSITION_ROLLED, "forecast", async (_event: KernelEvent) => {
    console.log(
      `[forecast] POSITION_ROLLED — scenario results may need recalculation`
    );
  });
}
