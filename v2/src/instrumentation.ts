/**
 * Next.js instrumentation — runs once on server startup.
 * Registers all cross-module event listeners so the event bus
 * actually routes events between plugins (budget <- positions, etc.).
 */
export async function register() {
  // Only register in the Node.js runtime (not Edge)
  // The edge runtime cannot use pg/crypto modules
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerBudgetEventListeners } = await import("./lib/budgetEvents");
    const { registerPositionEventListeners } = await import("./lib/positionEvents");
    const { registerTradeEventListeners } = await import("./lib/tradeEvents");
    const { registerLogisticsEventListeners } = await import("./lib/logisticsEvents");
    const { registerSettlementEventListeners } = await import("./lib/settlementEvents");
    const { registerRiskEventListeners } = await import("./lib/riskEvents");
    const { registerMarketEventListeners } = await import("./lib/marketEvents");
    const { registerForecastEventListeners } = await import("./lib/forecastEvents");

    registerBudgetEventListeners();
    registerPositionEventListeners();
    registerTradeEventListeners();
    registerLogisticsEventListeners();
    registerSettlementEventListeners();
    registerRiskEventListeners();
    registerMarketEventListeners();
    registerForecastEventListeners();

    // One-time reconciliation: fix any stale allocated_volume from before trade listeners were registered
    const { recalculateAllAllocatedVolumes } = await import("./lib/tradeService");
    recalculateAllAllocatedVolumes()
      .catch((err) => console.error("[Instrumentation] Reconciliation error:", err));
  }
}
