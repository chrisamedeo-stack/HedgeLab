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

    registerBudgetEventListeners();
    registerPositionEventListeners();
    registerTradeEventListeners();
    registerLogisticsEventListeners();
    registerSettlementEventListeners();

    console.log("[Instrumentation] Event listeners registered: budget, positions, trades, logistics, settlement");
  }
}
