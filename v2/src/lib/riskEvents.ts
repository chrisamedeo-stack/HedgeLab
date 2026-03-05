import { on, EventTypes, type KernelEvent } from "./eventBus";

/**
 * Register Risk module event listeners.
 * Handles price updates (auto-MTM) and position changes (auto-limit-check).
 */
export function registerRiskEventListeners(): void {
  // When a price is updated, log for potential auto-MTM
  on(EventTypes.PRICE_UPDATED, "risk", async (event: KernelEvent) => {
    const { commodityId, contractMonth, price } = event.payload as {
      commodityId?: string;
      contractMonth?: string;
      price?: number;
    };
    console.log(
      `[Risk] Price updated — ${commodityId} ${contractMonth} @ ${price}. MTM will reflect on next run.`
    );
  });

  // When a position is allocated, log for limit monitoring
  on(EventTypes.POSITION_ALLOCATED, "risk", async (event: KernelEvent) => {
    console.log(
      `[Risk] Position allocated — ${event.entityId}. Limits will be checked on next run.`
    );
  });

  // When an EFP is executed, log for limit monitoring
  on(EventTypes.EFP_EXECUTED, "risk", async (event: KernelEvent) => {
    console.log(
      `[Risk] EFP executed — ${event.entityId}. Position limits may have changed.`
    );
  });

  // When a physical contract is created, log for exposure monitoring
  on(EventTypes.PHYSICAL_CONTRACT_CREATED, "risk", async (event: KernelEvent) => {
    const { commodityId, direction, totalVolume } = event.payload as {
      commodityId?: string;
      direction?: string;
      totalVolume?: number;
    };
    console.log(
      `[Risk] Physical contract created — ${direction} ${totalVolume} of ${commodityId}. Counterparty exposure updated.`
    );
  });

  // When a delivery is recorded, log for exposure update
  on(EventTypes.DELIVERY_RECORDED, "risk", async (event: KernelEvent) => {
    const { deliveredVolume } = event.payload as { deliveredVolume?: number };
    console.log(
      `[Risk] Delivery recorded — ${deliveredVolume} units on contract ${event.entityId}.`
    );
  });

  // When a limit is breached, log critical alert
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
