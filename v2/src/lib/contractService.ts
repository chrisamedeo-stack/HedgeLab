import { queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  Counterparty,
  CreateCounterpartyParams,
  UpdateCounterpartyParams,
  CounterpartyFilters,
  PhysicalContract,
  CreateContractParams,
  UpdateContractParams,
  ContractFilters,
  CreditStatus,
} from "@/types/contracts";

// ─── Counterparty CRUD ──────────────────────────────────────────────────────

export async function createCounterparty(params: CreateCounterpartyParams): Promise<Counterparty> {
  await requirePermission(params.userId, "counterparty.create");

  const row = await queryOne<Counterparty>(
    `INSERT INTO ct_counterparties
       (org_id, name, short_name, counterparty_type, entity_type, credit_limit, credit_rating,
        payment_terms_days, contact_name, contact_email, contact_phone, address, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      params.orgId,
      params.name,
      params.shortName ?? null,
      params.counterpartyType ?? "commercial",
      params.entityType ?? "both",
      params.creditLimit ?? null,
      params.creditRating ?? null,
      params.paymentTermsDays ?? 30,
      params.contactName ?? null,
      params.contactEmail ?? null,
      params.contactPhone ?? null,
      params.address ?? null,
      params.notes ?? null,
    ]
  );

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "contracts",
    entityType: "counterparty",
    entityId: row!.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function getCounterparty(id: string): Promise<Counterparty | null> {
  return queryOne<Counterparty>(`SELECT * FROM ct_counterparties WHERE id = $1`, [id]);
}

export async function listCounterparties(filters: CounterpartyFilters): Promise<Counterparty[]> {
  let sql = `SELECT * FROM ct_counterparties WHERE org_id = $1`;
  const params: unknown[] = [filters.orgId];

  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    sql += ` AND is_active = $${params.length}`;
  }

  if (filters.entityType) {
    params.push(filters.entityType);
    sql += ` AND entity_type IN ($${params.length}, 'both')`;
  }

  sql += ` ORDER BY name`;
  return queryAll<Counterparty>(sql, params);
}

export async function updateCounterparty(
  id: string,
  userId: string,
  changes: UpdateCounterpartyParams
): Promise<Counterparty> {
  await requirePermission(userId, "counterparty.update");
  const before = await getCounterparty(id);
  if (!before) throw new Error("Counterparty not found");

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields: [keyof UpdateCounterpartyParams, string][] = [
    ["name", "name"],
    ["shortName", "short_name"],
    ["counterpartyType", "counterparty_type"],
    ["entityType", "entity_type"],
    ["creditLimit", "credit_limit"],
    ["creditRating", "credit_rating"],
    ["paymentTermsDays", "payment_terms_days"],
    ["contactName", "contact_name"],
    ["contactEmail", "contact_email"],
    ["contactPhone", "contact_phone"],
    ["address", "address"],
    ["isActive", "is_active"],
    ["notes", "notes"],
  ];

  for (const [paramKey, colName] of fields) {
    if (changes[paramKey] !== undefined) {
      setClauses.push(`${colName} = $${idx}`);
      values.push(changes[paramKey]);
      idx++;
    }
  }

  if (setClauses.length === 0) return before;

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const row = await queryOne<Counterparty>(
    `UPDATE ct_counterparties SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "counterparty",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function deleteCounterparty(id: string, userId: string): Promise<void> {
  await requirePermission(userId, "counterparty.delete");
  const before = await getCounterparty(id);
  if (!before) throw new Error("Counterparty not found");

  await queryOne(`UPDATE ct_counterparties SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`, [id]);

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "counterparty",
    entityId: id,
    action: "deactivate",
    before: before as unknown as Record<string, unknown>,
  });
}

// ─── Credit Tracking ────────────────────────────────────────────────────────

export async function getCreditSummary(counterpartyId: string) {
  const row = await queryOne<Counterparty>(
    `SELECT * FROM ct_counterparties WHERE id = $1`,
    [counterpartyId]
  );
  if (!row) throw new Error("Counterparty not found");

  const creditLimit = row.credit_limit ? Number(row.credit_limit) : null;
  const creditUsed = Number(row.credit_used);
  return {
    credit_limit: creditLimit,
    credit_used: creditUsed,
    credit_available: creditLimit != null ? creditLimit - creditUsed : null,
    credit_status: row.credit_status,
  };
}

export async function updateCreditUsed(counterpartyId: string, delta: number): Promise<void> {
  const row = await queryOne<{ credit_limit: string | null; credit_used: string }>(
    `UPDATE ct_counterparties
     SET credit_used = GREATEST(credit_used + $2, 0),
         updated_at = NOW()
     WHERE id = $1
     RETURNING credit_limit, credit_used`,
    [counterpartyId, delta]
  );
  if (!row) return;

  const limit = row.credit_limit ? Number(row.credit_limit) : null;
  const used = Number(row.credit_used);

  let status: CreditStatus = "good";
  if (limit != null && limit > 0) {
    const ratio = used / limit;
    if (ratio > 1) status = "exceeded";
    else if (ratio >= 0.8) status = "warning";
  }

  await queryOne(
    `UPDATE ct_counterparties SET credit_status = $2, updated_at = NOW() WHERE id = $1`,
    [counterpartyId, status]
  );
}

// ─── Physical Contract CRUD ─────────────────────────────────────────────────

export async function createContract(params: CreateContractParams): Promise<PhysicalContract> {
  await requirePermission(params.userId, "contract.create");

  const row = await queryOne<PhysicalContract>(
    `INSERT INTO ct_physical_contracts
       (org_id, counterparty_id, commodity_id, site_id, contract_ref,
        contract_type, pricing_type, direction, total_volume,
        price, basis_price, basis_month, formula_id, currency,
        delivery_start, delivery_end, delivery_location,
        payment_terms_days, incoterms, quality_specs, notes, entered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      params.orgId,
      params.counterpartyId ?? null,
      params.commodityId ?? null,
      params.siteId ?? null,
      params.contractRef ?? null,
      params.contractType,
      params.pricingType ?? "fixed",
      params.direction,
      params.totalVolume,
      params.price ?? null,
      params.basisPrice ?? null,
      params.basisMonth ?? null,
      params.formulaId ?? null,
      params.currency ?? "USD",
      params.deliveryStart ?? null,
      params.deliveryEnd ?? null,
      params.deliveryLocation ?? null,
      params.paymentTermsDays ?? null,
      params.incoterms ?? null,
      JSON.stringify(params.qualitySpecs ?? {}),
      params.notes ?? null,
      params.userId,
    ]
  );

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: row!.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.PHYSICAL_CONTRACT_CREATED,
    source: "contracts",
    entityType: "physical_contract",
    entityId: row!.id,
    payload: {
      commodityId: params.commodityId,
      direction: params.direction,
      totalVolume: params.totalVolume,
      counterpartyId: params.counterpartyId,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return row!;
}

export async function createBulkContracts(paramsList: CreateContractParams[]): Promise<PhysicalContract[]> {
  if (paramsList.length === 0) throw new Error("No contracts to create");
  await requirePermission(paramsList[0].userId, "contract.create");

  const results: PhysicalContract[] = [];
  for (const params of paramsList) {
    const row = await queryOne<PhysicalContract>(
      `INSERT INTO ct_physical_contracts
         (org_id, counterparty_id, commodity_id, site_id, contract_ref,
          contract_type, pricing_type, direction, total_volume,
          price, basis_price, basis_month, formula_id, currency,
          delivery_start, delivery_end, delivery_location,
          payment_terms_days, incoterms, quality_specs, notes, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        params.orgId,
        params.counterpartyId ?? null,
        params.commodityId ?? null,
        params.siteId ?? null,
        params.contractRef ?? null,
        params.contractType,
        params.pricingType ?? "fixed",
        params.direction,
        params.totalVolume,
        params.price ?? null,
        params.basisPrice ?? null,
        params.basisMonth ?? null,
        params.formulaId ?? null,
        params.currency ?? "USD",
        params.deliveryStart ?? null,
        params.deliveryEnd ?? null,
        params.deliveryLocation ?? null,
        params.paymentTermsDays ?? null,
        params.incoterms ?? null,
        JSON.stringify(params.qualitySpecs ?? {}),
        params.notes ?? null,
        params.userId,
      ]
    );

    await auditLog({
      orgId: params.orgId,
      userId: params.userId,
      module: "contracts",
      entityType: "physical_contract",
      entityId: row!.id,
      action: "create",
      after: row as unknown as Record<string, unknown>,
    });

    await emit({
      type: EventTypes.PHYSICAL_CONTRACT_CREATED,
      source: "contracts",
      entityType: "physical_contract",
      entityId: row!.id,
      payload: {
        commodityId: params.commodityId,
        direction: params.direction,
        totalVolume: params.totalVolume,
        counterpartyId: params.counterpartyId,
      },
      orgId: params.orgId,
      userId: params.userId,
    });

    results.push(row!);
  }

  return results;
}

export async function getContract(id: string): Promise<PhysicalContract | null> {
  return queryOne<PhysicalContract>(
    `SELECT c.*, cp.name as counterparty_name, com.name as commodity_name, s.name as site_name
     FROM ct_physical_contracts c
     LEFT JOIN ct_counterparties cp ON cp.id = c.counterparty_id
     LEFT JOIN commodities com ON com.id = c.commodity_id
     LEFT JOIN sites s ON s.id = c.site_id
     WHERE c.id = $1`,
    [id]
  );
}

export async function listContracts(filters: ContractFilters): Promise<PhysicalContract[]> {
  let sql = `
    SELECT c.*, cp.name as counterparty_name, com.name as commodity_name, s.name as site_name
    FROM ct_physical_contracts c
    LEFT JOIN ct_counterparties cp ON cp.id = c.counterparty_id
    LEFT JOIN commodities com ON com.id = c.commodity_id
    LEFT JOIN sites s ON s.id = c.site_id
    WHERE c.org_id = $1`;
  const params: unknown[] = [filters.orgId];

  if (filters.commodityId) {
    params.push(filters.commodityId);
    sql += ` AND c.commodity_id = $${params.length}`;
  }
  if (filters.counterpartyId) {
    params.push(filters.counterpartyId);
    sql += ` AND c.counterparty_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND c.status = $${params.length}`;
  }
  if (filters.contractType) {
    params.push(filters.contractType);
    sql += ` AND c.contract_type = $${params.length}`;
  }
  if (filters.direction) {
    params.push(filters.direction);
    sql += ` AND c.direction = $${params.length}`;
  }

  sql += ` ORDER BY c.created_at DESC`;
  return queryAll<PhysicalContract>(sql, params);
}

export async function updateContract(
  id: string,
  userId: string,
  changes: UpdateContractParams
): Promise<PhysicalContract> {
  await requirePermission(userId, "contract.update");
  const before = await getContract(id);
  if (!before) throw new Error("Contract not found");
  if (before.status === "cancelled") throw new Error("Cannot update a cancelled contract");

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const fields: [keyof UpdateContractParams, string][] = [
    ["counterpartyId", "counterparty_id"],
    ["siteId", "site_id"],
    ["contractRef", "contract_ref"],
    ["pricingType", "pricing_type"],
    ["totalVolume", "total_volume"],
    ["price", "price"],
    ["basisPrice", "basis_price"],
    ["basisMonth", "basis_month"],
    ["formulaId", "formula_id"],
    ["deliveryStart", "delivery_start"],
    ["deliveryEnd", "delivery_end"],
    ["deliveryLocation", "delivery_location"],
    ["paymentTermsDays", "payment_terms_days"],
    ["incoterms", "incoterms"],
    ["notes", "notes"],
  ];

  for (const [paramKey, colName] of fields) {
    if (changes[paramKey] !== undefined) {
      setClauses.push(`${colName} = $${idx}`);
      values.push(paramKey === "qualitySpecs" ? JSON.stringify(changes[paramKey]) : changes[paramKey]);
      idx++;
    }
  }

  if (changes.qualitySpecs !== undefined) {
    setClauses.push(`quality_specs = $${idx}`);
    values.push(JSON.stringify(changes.qualitySpecs));
    idx++;
  }

  if (setClauses.length === 0) return before;

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const row = await queryOne<PhysicalContract>(
    `UPDATE ct_physical_contracts SET ${setClauses.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

// ─── Status Transitions ─────────────────────────────────────────────────────

export async function activateContract(id: string, userId: string): Promise<PhysicalContract> {
  await requirePermission(userId, "contract.update");
  const before = await getContract(id);
  if (!before) throw new Error("Contract not found");
  if (before.status !== "draft") throw new Error("Only draft contracts can be activated");

  const row = await queryOne<PhysicalContract>(
    `UPDATE ct_physical_contracts
     SET status = 'active', approved_by = $1, approved_at = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [userId, id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: id,
    action: "activate",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function completeContract(id: string, userId: string): Promise<PhysicalContract> {
  await requirePermission(userId, "contract.update");
  const before = await getContract(id);
  if (!before) throw new Error("Contract not found");
  if (before.status !== "active") throw new Error("Only active contracts can be completed");

  const row = await queryOne<PhysicalContract>(
    `UPDATE ct_physical_contracts SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: id,
    action: "complete",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
  });

  return row!;
}

export async function cancelContract(id: string, userId: string, reason?: string): Promise<PhysicalContract> {
  await requirePermission(userId, "contract.delete");
  const before = await getContract(id);
  if (!before) throw new Error("Contract not found");
  if (before.status === "cancelled") throw new Error("Contract is already cancelled");

  const row = await queryOne<PhysicalContract>(
    `UPDATE ct_physical_contracts
     SET status = 'cancelled', cancelled_by = $1, cancelled_at = NOW(),
         cancel_reason = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [userId, reason ?? null, id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: id,
    action: "cancel",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
    notes: reason ?? null,
  });

  return row!;
}

// ─── Delivery Recording ─────────────────────────────────────────────────────

export async function recordDelivery(
  contractId: string,
  userId: string,
  volume: number
): Promise<PhysicalContract> {
  await requirePermission(userId, "contract.update");
  const before = await getContract(contractId);
  if (!before) throw new Error("Contract not found");
  if (before.status !== "active") throw new Error("Deliveries only on active contracts");

  const newDelivered = Number(before.delivered_volume) + volume;
  if (newDelivered > Number(before.total_volume)) {
    throw new Error("Delivery would exceed contract volume");
  }

  const row = await queryOne<PhysicalContract>(
    `UPDATE ct_physical_contracts
     SET delivered_volume = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [newDelivered, contractId]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "contracts",
    entityType: "physical_contract",
    entityId: contractId,
    action: "delivery",
    before: before as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
    notes: `Delivered ${volume} units`,
  });

  await emit({
    type: EventTypes.DELIVERY_RECORDED,
    source: "contracts",
    entityType: "physical_contract",
    entityId: contractId,
    payload: {
      contractId,
      volume,
      totalDelivered: newDelivered,
      status: "delivered",
      siteId: before.site_id,
      commodityId: before.commodity_id,
    },
    orgId: before.org_id,
    userId,
  });

  return row!;
}
