import { queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  Delivery,
  Inventory,
  RecordDeliveryParams,
  UpdateDeliveryParams,
  DeliveryFilters,
} from "@/types/logistics";

// ─── Delivery CRUD ───────────────────────────────────────────────────────────

export async function recordDelivery(params: RecordDeliveryParams): Promise<Delivery> {
  await requirePermission(params.userId, "logistics.record_delivery");

  const row = await queryOne<Delivery>(
    `INSERT INTO lg_deliveries
       (org_id, site_id, commodity_id, contract_id, delivery_date, volume, unit,
        status, carrier, vehicle_id, origin, destination, freight_cost,
        quality_results, weight_ticket, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      params.orgId,
      params.siteId,
      params.commodityId,
      params.contractId ?? null,
      params.deliveryDate,
      params.volume,
      params.unit,
      params.status ?? "scheduled",
      params.carrier ?? null,
      params.vehicleId ?? null,
      params.origin ?? null,
      params.destination ?? null,
      params.freightCost ?? null,
      params.qualityResults ? JSON.stringify(params.qualityResults) : "{}",
      params.weightTicket ?? null,
      params.notes ?? null,
    ]
  );

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "logistics",
    entityType: "delivery",
    entityId: row!.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.DELIVERY_RECORDED,
    source: "logistics",
    entityType: "delivery",
    entityId: row!.id,
    payload: {
      deliveryId: row!.id,
      contractId: params.contractId ?? null,
      siteId: params.siteId,
      commodityId: params.commodityId,
      volume: params.volume,
      unit: params.unit,
      deliveryDate: params.deliveryDate,
      status: params.status ?? "scheduled",
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return row!;
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  return queryOne<Delivery>(
    `SELECT d.*, s.name as site_name, c.name as commodity_name
     FROM lg_deliveries d
     LEFT JOIN sites s ON s.id = d.site_id
     LEFT JOIN commodities c ON c.id = d.commodity_id
     WHERE d.id = $1`,
    [id]
  );
}

export async function listDeliveries(filters: DeliveryFilters): Promise<Delivery[]> {
  let sql = `
    SELECT d.*, s.name as site_name, c.name as commodity_name
    FROM lg_deliveries d
    LEFT JOIN sites s ON s.id = d.site_id
    LEFT JOIN commodities c ON c.id = d.commodity_id
    WHERE d.org_id = $1
  `;
  const params: unknown[] = [filters.orgId];

  if (filters.siteId) {
    params.push(filters.siteId);
    sql += ` AND d.site_id = $${params.length}`;
  }
  if (filters.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND d.commodity_id = $${params.length}`;
  }
  if (filters.contractId) {
    params.push(filters.contractId);
    sql += ` AND d.contract_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND d.status = $${params.length}`;
  }

  sql += ` ORDER BY d.delivery_date DESC, d.created_at DESC`;
  return queryAll<Delivery>(sql, params);
}

export async function updateDelivery(
  id: string,
  userId: string,
  changes: UpdateDeliveryParams
): Promise<Delivery> {
  const before = await queryOne<Delivery>(`SELECT * FROM lg_deliveries WHERE id = $1`, [id]);
  if (!before) throw new Error("Delivery not found");

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];

  if (changes.status !== undefined) { params.push(changes.status); sets.push(`status = $${params.length}`); }
  if (changes.carrier !== undefined) { params.push(changes.carrier); sets.push(`carrier = $${params.length}`); }
  if (changes.vehicleId !== undefined) { params.push(changes.vehicleId); sets.push(`vehicle_id = $${params.length}`); }
  if (changes.origin !== undefined) { params.push(changes.origin); sets.push(`origin = $${params.length}`); }
  if (changes.destination !== undefined) { params.push(changes.destination); sets.push(`destination = $${params.length}`); }
  if (changes.freightCost !== undefined) { params.push(changes.freightCost); sets.push(`freight_cost = $${params.length}`); }
  if (changes.qualityResults !== undefined) { params.push(JSON.stringify(changes.qualityResults)); sets.push(`quality_results = $${params.length}`); }
  if (changes.weightTicket !== undefined) { params.push(changes.weightTicket); sets.push(`weight_ticket = $${params.length}`); }
  if (changes.notes !== undefined) { params.push(changes.notes); sets.push(`notes = $${params.length}`); }

  params.push(id);
  const updated = await queryOne<Delivery>(
    `UPDATE lg_deliveries SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "logistics",
    entityType: "delivery",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  // If status changed to 'delivered' and has a contract, emit for contract update
  if (changes.status === "delivered" && before.status !== "delivered") {
    await emit({
      type: EventTypes.DELIVERY_RECORDED,
      source: "logistics",
      entityType: "delivery",
      entityId: id,
      payload: {
        deliveryId: id,
        contractId: before.contract_id,
        siteId: before.site_id,
        commodityId: before.commodity_id,
        volume: Number(before.volume),
        unit: before.unit,
        deliveryDate: before.delivery_date,
        status: "delivered",
      },
      orgId: before.org_id,
      userId,
    });
  }

  return updated!;
}

export async function cancelDelivery(id: string, userId: string): Promise<Delivery> {
  const before = await queryOne<Delivery>(`SELECT * FROM lg_deliveries WHERE id = $1`, [id]);
  if (!before) throw new Error("Delivery not found");
  if (before.status === "cancelled") throw new Error("Delivery already cancelled");

  const updated = await queryOne<Delivery>(
    `UPDATE lg_deliveries SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "logistics",
    entityType: "delivery",
    entityId: id,
    action: "cancel",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return updated!;
}

// ─── Inventory ───────────────────────────────────────────────────────────────

export async function getInventory(
  siteId?: string,
  commodityId?: string,
  asOfDate?: string
): Promise<Inventory[]> {
  let sql = `
    SELECT i.*, s.name as site_name, c.name as commodity_name
    FROM lg_inventory i
    LEFT JOIN sites s ON s.id = i.site_id
    LEFT JOIN commodities c ON c.id = i.commodity_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (siteId) {
    params.push(siteId);
    sql += ` AND i.site_id = $${params.length}`;
  }
  if (commodityId) {
    params.push(commodityId);
    sql += ` AND i.commodity_id = $${params.length}`;
  }
  if (asOfDate) {
    params.push(asOfDate);
    sql += ` AND i.as_of_date = $${params.length}`;
  }

  sql += ` ORDER BY i.as_of_date DESC, s.name`;
  return queryAll<Inventory>(sql, params);
}

export async function recordInventorySnapshot(params: {
  userId: string;
  siteId: string;
  commodityId: string;
  asOfDate: string;
  onHandVolume: number;
  committedOut?: number;
  unit: string;
  avgCost?: number;
}): Promise<Inventory> {
  await requirePermission(params.userId, "logistics.manage_inventory");

  const row = await queryOne<Inventory>(
    `INSERT INTO lg_inventory (site_id, commodity_id, as_of_date, on_hand_volume, committed_out, unit, avg_cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (site_id, commodity_id, as_of_date)
     DO UPDATE SET on_hand_volume = EXCLUDED.on_hand_volume,
                   committed_out = EXCLUDED.committed_out,
                   unit = EXCLUDED.unit,
                   avg_cost = EXCLUDED.avg_cost
     RETURNING *`,
    [
      params.siteId,
      params.commodityId,
      params.asOfDate,
      params.onHandVolume,
      params.committedOut ?? 0,
      params.unit,
      params.avgCost ?? null,
    ]
  );

  await auditLog({
    userId: params.userId,
    module: "logistics",
    entityType: "inventory",
    entityId: row!.id,
    action: "snapshot",
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}
