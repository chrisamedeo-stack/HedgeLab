import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { emit, EventTypes } from "./eventBus";
import type {
  FctScenario,
  FctScenarioResult,
  CreateScenarioParams,
  ScenarioFilters,
  PriceMoveAssumptions,
  VolumeChangeAssumptions,
  WhatIfAssumptions,
  StressTestAssumptions,
} from "@/types/forecast";

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createScenario(params: CreateScenarioParams): Promise<FctScenario> {
  const {
    orgId, userId, name, description, scenarioType,
    baseDate, baseCommodity, baseSiteId, assumptions,
  } = params;

  const row = await queryOne<FctScenario>(
    `INSERT INTO fct_scenarios
       (org_id, name, description, scenario_type, base_date, base_commodity, base_site_id, assumptions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      orgId, name, description ?? null, scenarioType,
      baseDate ?? new Date().toISOString().slice(0, 10),
      baseCommodity ?? null, baseSiteId ?? null,
      JSON.stringify(assumptions), userId,
    ]
  );
  if (!row) throw new Error("Failed to create scenario");

  await auditLog({
    orgId, userId,
    module: "forecast",
    entityType: "scenario",
    entityId: row.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  return row;
}

export async function getScenario(scenarioId: string): Promise<FctScenario | null> {
  const scenario = await queryOne<FctScenario>(
    `SELECT s.*,
            c.name as commodity_name,
            st.name as site_name
     FROM fct_scenarios s
     LEFT JOIN commodities c ON c.id = s.base_commodity
     LEFT JOIN sites st ON st.id = s.base_site_id
     WHERE s.id = $1`,
    [scenarioId]
  );
  if (!scenario) return null;

  const results = await queryAll<FctScenarioResult>(
    `SELECT r.*, st.name as site_name
     FROM fct_scenario_results r
     LEFT JOIN sites st ON st.id = r.site_id
     WHERE r.scenario_id = $1
     ORDER BY r.id`,
    [scenarioId]
  );
  scenario.result_rows = results;

  return scenario;
}

export async function listScenarios(
  orgId: string,
  filters?: ScenarioFilters
): Promise<FctScenario[]> {
  let sql = `
    SELECT s.*,
           c.name as commodity_name,
           st.name as site_name
    FROM fct_scenarios s
    LEFT JOIN commodities c ON c.id = s.base_commodity
    LEFT JOIN sites st ON st.id = s.base_site_id
    WHERE s.org_id = $1
  `;
  const params: unknown[] = [orgId];

  if (filters?.scenarioType) {
    params.push(filters.scenarioType);
    sql += ` AND s.scenario_type = $${params.length}`;
  }
  if (filters?.status) {
    params.push(filters.status);
    sql += ` AND s.status = $${params.length}`;
  }
  if (filters?.baseCommodity) {
    params.push(filters.baseCommodity);
    sql += ` AND s.base_commodity = $${params.length}`;
  }

  sql += ` ORDER BY s.updated_at DESC`;

  return queryAll<FctScenario>(sql, params);
}

export async function deleteScenario(
  scenarioId: string,
  userId: string
): Promise<void> {
  const before = await queryOne<FctScenario>(
    `SELECT * FROM fct_scenarios WHERE id = $1`,
    [scenarioId]
  );
  if (!before) throw new Error("Scenario not found");

  await query(`DELETE FROM fct_scenarios WHERE id = $1`, [scenarioId]);

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "forecast",
    entityType: "scenario",
    entityId: scenarioId,
    action: "delete",
    before: before as unknown as Record<string, unknown>,
  });
}

export async function cloneScenario(
  scenarioId: string,
  userId: string
): Promise<FctScenario> {
  const source = await queryOne<FctScenario>(
    `SELECT * FROM fct_scenarios WHERE id = $1`,
    [scenarioId]
  );
  if (!source) throw new Error("Scenario not found");

  const row = await queryOne<FctScenario>(
    `INSERT INTO fct_scenarios
       (org_id, name, description, scenario_type, base_date, base_commodity, base_site_id, assumptions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      source.org_id,
      `${source.name} (copy)`,
      source.description,
      source.scenario_type,
      source.base_date,
      source.base_commodity,
      source.base_site_id,
      JSON.stringify(source.assumptions),
      userId,
    ]
  );
  if (!row) throw new Error("Failed to clone scenario");

  await auditLog({
    orgId: source.org_id,
    userId,
    module: "forecast",
    entityType: "scenario",
    entityId: row.id,
    action: "clone",
    after: { sourceId: scenarioId, ...row as unknown as Record<string, unknown> },
  });

  return row;
}

// ─── Engine Dispatcher ──────────────────────────────────────────────────────

export async function runScenario(
  scenarioId: string,
  userId: string
): Promise<FctScenario> {
  const scenario = await queryOne<FctScenario>(
    `SELECT * FROM fct_scenarios WHERE id = $1`,
    [scenarioId]
  );
  if (!scenario) throw new Error("Scenario not found");

  // Set running status
  await query(
    `UPDATE fct_scenarios SET status = 'running', updated_at = NOW() WHERE id = $1`,
    [scenarioId]
  );

  try {
    // Clear prior results
    await query(`DELETE FROM fct_scenario_results WHERE scenario_id = $1`, [scenarioId]);

    // Dispatch to engine
    switch (scenario.scenario_type) {
      case "price_move":
        await runPriceMoveEngine(scenario);
        break;
      case "volume_change":
        await runVolumeChangeEngine(scenario);
        break;
      case "what_if":
        await runWhatIfEngine(scenario);
        break;
      case "stress_test":
        await runStressTestEngine(scenario);
        break;
      default:
        throw new Error(`Unknown scenario type: ${scenario.scenario_type}`);
    }

    // Mark completed
    const completed = await queryOne<FctScenario>(
      `UPDATE fct_scenarios SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [scenarioId]
    );

    await auditLog({
      orgId: scenario.org_id,
      userId,
      module: "forecast",
      entityType: "scenario",
      entityId: scenarioId,
      action: "run",
      after: { status: "completed", scenario_type: scenario.scenario_type },
    });

    await emit({
      type: EventTypes.SCENARIO_COMPLETED,
      source: "forecast",
      entityType: "scenario",
      entityId: scenarioId,
      payload: { scenarioType: scenario.scenario_type, status: "completed" },
      orgId: scenario.org_id,
      userId,
    });

    return completed!;
  } catch (err) {
    await query(
      `UPDATE fct_scenarios SET status = 'failed', results = $2, updated_at = NOW() WHERE id = $1`,
      [scenarioId, JSON.stringify({ error: (err as Error).message })]
    );
    throw err;
  }
}

// ─── Price Move Engine ──────────────────────────────────────────────────────

async function runPriceMoveEngine(scenario: FctScenario): Promise<void> {
  const assumptions = scenario.assumptions as PriceMoveAssumptions;
  const commodityId = scenario.base_commodity;
  if (!commodityId) throw new Error("Price move scenario requires base_commodity");

  // Get latest market price for this commodity
  const latestPrice = await queryOne<{ settle_price: string }>(
    `SELECT settle_price FROM md_prices
     WHERE commodity_id = $1
     ORDER BY price_date DESC LIMIT 1`,
    [commodityId]
  );
  const currentPrice = latestPrice ? Number(latestPrice.settle_price) : 0;

  // Calculate projected price
  let projectedPrice: number;
  if (assumptions.isPercent) {
    projectedPrice = currentPrice * (1 + assumptions.priceChange / 100);
  } else {
    projectedPrice = currentPrice + assumptions.priceChange;
  }

  // Get open allocations grouped by site
  const allocations = await queryAll<{
    site_id: string; total_volume: string; avg_price: string;
  }>(
    `SELECT a.site_id,
            SUM(a.volume) as total_volume,
            CASE WHEN SUM(a.volume) > 0
              THEN SUM(a.volume * a.allocated_price) / SUM(a.volume)
              ELSE 0 END as avg_price
     FROM pm_allocations a
     WHERE a.org_id = $1 AND a.commodity_id = $2 AND a.status = 'open'
     GROUP BY a.site_id`,
    [scenario.org_id, commodityId]
  );

  // Get budget data for coverage calc
  const budgetData = await queryAll<{
    site_id: string; budgeted: string; hedged: string; committed: string;
  }>(
    `SELECT p.site_id,
            SUM(li.budgeted_volume) as budgeted,
            SUM(li.hedged_volume) as hedged,
            SUM(li.committed_volume) as committed
     FROM bgt_line_items li
     JOIN bgt_periods p ON p.id = li.period_id
     WHERE p.org_id = $1 AND p.commodity_id = $2
     GROUP BY p.site_id`,
    [scenario.org_id, commodityId]
  );
  const budgetMap = new Map(budgetData.map(b => [b.site_id, b]));

  for (const alloc of allocations) {
    const vol = Number(alloc.total_volume);
    const avgPrice = Number(alloc.avg_price);
    const currentPnl = vol * (currentPrice - avgPrice);
    const projectedPnl = vol * (projectedPrice - avgPrice);
    const budget = budgetMap.get(alloc.site_id);
    const budgeted = budget ? Number(budget.budgeted) : 0;
    const hedged = budget ? Number(budget.hedged) : 0;
    const committed = budget ? Number(budget.committed) : 0;
    const currentCoverage = budgeted > 0 ? ((hedged + committed) / budgeted) * 100 : 0;

    await query(
      `INSERT INTO fct_scenario_results
         (scenario_id, site_id, commodity_id, current_coverage_pct, current_all_in_price,
          current_mtm_pnl, current_open_volume, projected_coverage_pct, projected_all_in_price,
          projected_mtm_pnl, projected_open_volume, coverage_change, price_change, pnl_change, volume_change)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        scenario.id, alloc.site_id, commodityId,
        currentCoverage, avgPrice,
        currentPnl, vol,
        currentCoverage, projectedPrice,
        projectedPnl, vol,
        0, projectedPrice - currentPrice,
        projectedPnl - currentPnl, 0,
      ]
    );
  }

  // If no allocations, insert a summary row
  if (allocations.length === 0) {
    await query(
      `INSERT INTO fct_scenario_results
         (scenario_id, commodity_id, label, current_all_in_price, projected_all_in_price, price_change)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [scenario.id, commodityId, "No open positions", currentPrice, projectedPrice, projectedPrice - currentPrice]
    );
  }
}

// ─── Volume Change Engine ───────────────────────────────────────────────────

async function runVolumeChangeEngine(scenario: FctScenario): Promise<void> {
  const assumptions = scenario.assumptions as VolumeChangeAssumptions;
  const commodityId = scenario.base_commodity;
  if (!commodityId) throw new Error("Volume change scenario requires base_commodity");

  // Get budget line items grouped by site
  const budgetData = await queryAll<{
    site_id: string; budgeted: string; hedged: string; committed: string;
    open_vol: string;
  }>(
    `SELECT p.site_id,
            SUM(li.budgeted_volume) as budgeted,
            SUM(li.hedged_volume) as hedged,
            SUM(li.committed_volume) as committed,
            SUM(li.open_volume) as open_vol
     FROM bgt_line_items li
     JOIN bgt_periods p ON p.id = li.period_id
     WHERE p.org_id = $1 AND p.commodity_id = $2
     GROUP BY p.site_id`,
    [scenario.org_id, commodityId]
  );

  for (const row of budgetData) {
    const budgeted = Number(row.budgeted);
    const hedged = Number(row.hedged);
    const committed = Number(row.committed);
    const covered = hedged + committed;
    const currentCoverage = budgeted > 0 ? (covered / budgeted) * 100 : 0;
    const currentOpen = Number(row.open_vol);

    let projectedBudgeted: number;
    if (assumptions.isPercent) {
      projectedBudgeted = budgeted * (1 + assumptions.volumeChange / 100);
    } else {
      projectedBudgeted = budgeted + assumptions.volumeChange;
    }
    projectedBudgeted = Math.max(0, projectedBudgeted);

    const projectedCoverage = projectedBudgeted > 0 ? (covered / projectedBudgeted) * 100 : 0;
    const projectedOpen = Math.max(0, projectedBudgeted - covered);

    await query(
      `INSERT INTO fct_scenario_results
         (scenario_id, site_id, commodity_id, current_coverage_pct, current_open_volume,
          projected_coverage_pct, projected_open_volume, coverage_change, volume_change)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        scenario.id, row.site_id, commodityId,
        currentCoverage, currentOpen,
        projectedCoverage, projectedOpen,
        projectedCoverage - currentCoverage,
        projectedBudgeted - budgeted,
      ]
    );
  }

  if (budgetData.length === 0) {
    await query(
      `INSERT INTO fct_scenario_results (scenario_id, commodity_id, label) VALUES ($1,$2,$3)`,
      [scenario.id, commodityId, "No budget data found"]
    );
  }
}

// ─── What-If Engine ─────────────────────────────────────────────────────────

async function runWhatIfEngine(scenario: FctScenario): Promise<void> {
  const assumptions = scenario.assumptions as WhatIfAssumptions;
  const commodityId = scenario.base_commodity;
  if (!commodityId) throw new Error("What-if scenario requires base_commodity");

  const siteId = assumptions.siteId || scenario.base_site_id;
  if (!siteId) throw new Error("What-if scenario requires a site");

  // Get current position for this site
  const currentPos = await queryOne<{
    total_volume: string; avg_price: string;
  }>(
    `SELECT
       COALESCE(SUM(a.volume), 0) as total_volume,
       CASE WHEN SUM(a.volume) > 0
         THEN SUM(a.volume * a.allocated_price) / SUM(a.volume)
         ELSE 0 END as avg_price
     FROM pm_allocations a
     WHERE a.site_id = $1 AND a.commodity_id = $2 AND a.status = 'open'`,
    [siteId, commodityId]
  );

  const currentVol = Number(currentPos?.total_volume ?? 0);
  const currentAvg = Number(currentPos?.avg_price ?? 0);

  // Get latest market price
  const latestPrice = await queryOne<{ settle_price: string }>(
    `SELECT settle_price FROM md_prices WHERE commodity_id = $1 ORDER BY price_date DESC LIMIT 1`,
    [commodityId]
  );
  const mktPrice = latestPrice ? Number(latestPrice.settle_price) : 0;

  const currentPnl = currentVol * (mktPrice - currentAvg);

  // Simulate adding the hedge
  const projectedVol = currentVol + assumptions.hedgeVolume;
  const projectedAvg = projectedVol > 0
    ? (currentVol * currentAvg + assumptions.hedgeVolume * assumptions.hedgePrice) / projectedVol
    : 0;
  const projectedPnl = projectedVol * (mktPrice - projectedAvg);

  // Get budget coverage for this site
  const budget = await queryOne<{ budgeted: string; hedged: string; committed: string }>(
    `SELECT
       COALESCE(SUM(li.budgeted_volume), 0) as budgeted,
       COALESCE(SUM(li.hedged_volume), 0) as hedged,
       COALESCE(SUM(li.committed_volume), 0) as committed
     FROM bgt_line_items li
     JOIN bgt_periods p ON p.id = li.period_id
     WHERE p.site_id = $1 AND p.commodity_id = $2`,
    [siteId, commodityId]
  );

  const budgeted = Number(budget?.budgeted ?? 0);
  const hedged = Number(budget?.hedged ?? 0);
  const committed = Number(budget?.committed ?? 0);
  const currentCoverage = budgeted > 0 ? ((hedged + committed) / budgeted) * 100 : 0;
  const projectedCoverage = budgeted > 0
    ? ((hedged + committed + assumptions.hedgeVolume) / budgeted) * 100
    : 0;

  await query(
    `INSERT INTO fct_scenario_results
       (scenario_id, site_id, commodity_id, label,
        current_coverage_pct, current_all_in_price, current_mtm_pnl, current_open_volume,
        projected_coverage_pct, projected_all_in_price, projected_mtm_pnl, projected_open_volume,
        coverage_change, price_change, pnl_change, volume_change)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      scenario.id, siteId, commodityId,
      `Simulate +${assumptions.hedgeVolume} MT @ $${assumptions.hedgePrice}`,
      currentCoverage, currentAvg, currentPnl, currentVol,
      projectedCoverage, projectedAvg, projectedPnl, projectedVol,
      projectedCoverage - currentCoverage,
      projectedAvg - currentAvg,
      projectedPnl - currentPnl,
      assumptions.hedgeVolume,
    ]
  );
}

// ─── Stress Test Engine ─────────────────────────────────────────────────────

async function runStressTestEngine(scenario: FctScenario): Promise<void> {
  const assumptions = scenario.assumptions as StressTestAssumptions;
  const commodityId = scenario.base_commodity;
  if (!commodityId) throw new Error("Stress test scenario requires base_commodity");

  // Get latest market price
  const latestPrice = await queryOne<{ settle_price: string }>(
    `SELECT settle_price FROM md_prices WHERE commodity_id = $1 ORDER BY price_date DESC LIMIT 1`,
    [commodityId]
  );
  const currentPrice = latestPrice ? Number(latestPrice.settle_price) : 0;

  // Fetch all open allocations once
  const allocations = await queryAll<{
    site_id: string; total_volume: string; avg_price: string;
  }>(
    `SELECT a.site_id,
            SUM(a.volume) as total_volume,
            CASE WHEN SUM(a.volume) > 0
              THEN SUM(a.volume * a.allocated_price) / SUM(a.volume)
              ELSE 0 END as avg_price
     FROM pm_allocations a
     WHERE a.org_id = $1 AND a.commodity_id = $2 AND a.status = 'open'
     GROUP BY a.site_id`,
    [scenario.org_id, commodityId]
  );

  // Total across all sites
  let totalVol = 0;
  let totalWeightedPrice = 0;
  for (const a of allocations) {
    const v = Number(a.total_volume);
    totalVol += v;
    totalWeightedPrice += v * Number(a.avg_price);
  }
  const avgPrice = totalVol > 0 ? totalWeightedPrice / totalVol : 0;

  // Loop through deltas in-memory — single batch of inserts
  for (const delta of assumptions.priceDeltas) {
    const projectedPrice = currentPrice + delta;
    const currentPnl = totalVol * (currentPrice - avgPrice);
    const projectedPnl = totalVol * (projectedPrice - avgPrice);

    await query(
      `INSERT INTO fct_scenario_results
         (scenario_id, commodity_id, label,
          current_all_in_price, current_mtm_pnl, current_open_volume,
          projected_all_in_price, projected_mtm_pnl, projected_open_volume,
          price_change, pnl_change)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        scenario.id, commodityId,
        `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
        currentPrice, currentPnl, totalVol,
        projectedPrice, projectedPnl, totalVol,
        delta, projectedPnl - currentPnl,
      ]
    );
  }

  if (allocations.length === 0 && assumptions.priceDeltas.length > 0) {
    // Still insert rows so chart renders
    for (const delta of assumptions.priceDeltas) {
      await query(
        `INSERT INTO fct_scenario_results
           (scenario_id, commodity_id, label, current_all_in_price, projected_all_in_price, price_change, pnl_change)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [scenario.id, commodityId, `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`,
         currentPrice, currentPrice + delta, delta, 0]
      );
    }
  }
}
