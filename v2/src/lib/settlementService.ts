import { queryOne, queryAll } from "./db";
import { auditLog } from "./audit";
import { requirePermission } from "./permissions";
import { emit, EventTypes } from "./eventBus";
import type {
  Invoice,
  CreateInvoiceParams,
  UpdateInvoiceParams,
  InvoiceFilters,
} from "@/types/settlement";

// ─── Invoice CRUD ────────────────────────────────────────────────────────────

export async function createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
  await requirePermission(params.userId, "settlement.create_invoice");

  const row = await queryOne<Invoice>(
    `INSERT INTO stl_invoices
       (org_id, counterparty_id, counterparty_name, invoice_type, invoice_number,
        invoice_date, due_date, subtotal, tax, freight, adjustments, total,
        currency, line_items, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      params.orgId,
      params.counterpartyId ?? null,
      params.counterpartyName ?? null,
      params.invoiceType,
      params.invoiceNumber ?? null,
      params.invoiceDate ?? null,
      params.dueDate ?? null,
      params.subtotal,
      params.tax ?? 0,
      params.freight ?? 0,
      params.adjustments ?? 0,
      params.total,
      params.currency ?? "USD",
      JSON.stringify(params.lineItems ?? []),
      params.notes ?? null,
    ]
  );

  await auditLog({
    orgId: params.orgId,
    userId: params.userId,
    module: "settlement",
    entityType: "invoice",
    entityId: row!.id,
    action: "create",
    after: row as unknown as Record<string, unknown>,
  });

  await emit({
    type: EventTypes.INVOICE_CREATED,
    source: "settlement",
    entityType: "invoice",
    entityId: row!.id,
    payload: {
      invoiceId: row!.id,
      invoiceType: params.invoiceType,
      total: params.total,
      counterpartyId: params.counterpartyId ?? null,
    },
    orgId: params.orgId,
    userId: params.userId,
  });

  return row!;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  return queryOne<Invoice>(`SELECT * FROM stl_invoices WHERE id = $1`, [id]);
}

export async function listInvoices(filters: InvoiceFilters): Promise<Invoice[]> {
  let sql = `SELECT * FROM stl_invoices WHERE org_id = $1`;
  const params: unknown[] = [filters.orgId];

  if (filters.counterpartyId) {
    params.push(filters.counterpartyId);
    sql += ` AND counterparty_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }
  if (filters.invoiceType) {
    params.push(filters.invoiceType);
    sql += ` AND invoice_type = $${params.length}`;
  }

  sql += ` ORDER BY invoice_date DESC, created_at DESC`;
  return queryAll<Invoice>(sql, params);
}

export async function updateInvoice(
  id: string,
  userId: string,
  changes: UpdateInvoiceParams
): Promise<Invoice> {
  const before = await queryOne<Invoice>(`SELECT * FROM stl_invoices WHERE id = $1`, [id]);
  if (!before) throw new Error("Invoice not found");
  if (before.status !== "draft") throw new Error("Only draft invoices can be edited");

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];

  if (changes.counterpartyId !== undefined) { params.push(changes.counterpartyId); sets.push(`counterparty_id = $${params.length}`); }
  if (changes.counterpartyName !== undefined) { params.push(changes.counterpartyName); sets.push(`counterparty_name = $${params.length}`); }
  if (changes.invoiceNumber !== undefined) { params.push(changes.invoiceNumber); sets.push(`invoice_number = $${params.length}`); }
  if (changes.invoiceDate !== undefined) { params.push(changes.invoiceDate); sets.push(`invoice_date = $${params.length}`); }
  if (changes.dueDate !== undefined) { params.push(changes.dueDate); sets.push(`due_date = $${params.length}`); }
  if (changes.subtotal !== undefined) { params.push(changes.subtotal); sets.push(`subtotal = $${params.length}`); }
  if (changes.tax !== undefined) { params.push(changes.tax); sets.push(`tax = $${params.length}`); }
  if (changes.freight !== undefined) { params.push(changes.freight); sets.push(`freight = $${params.length}`); }
  if (changes.adjustments !== undefined) { params.push(changes.adjustments); sets.push(`adjustments = $${params.length}`); }
  if (changes.total !== undefined) { params.push(changes.total); sets.push(`total = $${params.length}`); }
  if (changes.lineItems !== undefined) { params.push(JSON.stringify(changes.lineItems)); sets.push(`line_items = $${params.length}`); }
  if (changes.notes !== undefined) { params.push(changes.notes); sets.push(`notes = $${params.length}`); }

  params.push(id);
  const updated = await queryOne<Invoice>(
    `UPDATE stl_invoices SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "settlement",
    entityType: "invoice",
    entityId: id,
    action: "update",
    before: before as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
  });

  return updated!;
}

export async function issueInvoice(id: string, userId: string): Promise<Invoice> {
  await requirePermission(userId, "settlement.issue_invoice");

  const before = await queryOne<Invoice>(`SELECT * FROM stl_invoices WHERE id = $1`, [id]);
  if (!before) throw new Error("Invoice not found");
  if (before.status !== "draft") throw new Error("Only draft invoices can be issued");

  const updated = await queryOne<Invoice>(
    `UPDATE stl_invoices SET status = 'issued', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "settlement",
    entityType: "invoice",
    entityId: id,
    action: "issue",
    before: { status: before.status },
    after: { status: "issued" },
  });

  return updated!;
}

export async function recordPayment(
  id: string,
  userId: string,
  paymentDate: string,
  paymentRef?: string
): Promise<Invoice> {
  await requirePermission(userId, "settlement.record_payment");

  const before = await queryOne<Invoice>(`SELECT * FROM stl_invoices WHERE id = $1`, [id]);
  if (!before) throw new Error("Invoice not found");
  if (before.status !== "issued") throw new Error("Only issued invoices can be paid");

  const updated = await queryOne<Invoice>(
    `UPDATE stl_invoices
     SET status = 'paid', payment_date = $2, payment_ref = $3, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, paymentDate, paymentRef ?? null]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "settlement",
    entityType: "invoice",
    entityId: id,
    action: "payment",
    before: { status: before.status },
    after: { status: "paid", payment_date: paymentDate, payment_ref: paymentRef },
  });

  await emit({
    type: EventTypes.INVOICE_PAID,
    source: "settlement",
    entityType: "invoice",
    entityId: id,
    payload: {
      invoiceId: id,
      invoiceType: before.invoice_type,
      total: Number(before.total),
      paymentDate,
      paymentRef: paymentRef ?? null,
      counterpartyId: before.counterparty_id,
    },
    orgId: before.org_id,
    userId,
  });

  return updated!;
}

export async function cancelInvoice(id: string, userId: string): Promise<Invoice> {
  const before = await queryOne<Invoice>(`SELECT * FROM stl_invoices WHERE id = $1`, [id]);
  if (!before) throw new Error("Invoice not found");
  if (before.status === "paid") throw new Error("Paid invoices cannot be cancelled");
  if (before.status === "cancelled") throw new Error("Invoice already cancelled");

  const updated = await queryOne<Invoice>(
    `UPDATE stl_invoices SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );

  await auditLog({
    orgId: before.org_id,
    userId,
    module: "settlement",
    entityType: "invoice",
    entityId: id,
    action: "cancel",
    before: { status: before.status },
    after: { status: "cancelled" },
  });

  return updated!;
}

// ─── Generate Invoices from Deliveries ───────────────────────────────────────

export async function generateFromDeliveries(
  orgId: string,
  userId: string,
  deliveryIds: string[],
  invoiceType: "purchase" | "sale",
  counterpartyId?: string,
  counterpartyName?: string
): Promise<Invoice> {
  await requirePermission(userId, "settlement.create_invoice");

  // Fetch deliveries
  const deliveries = await queryAll<{
    id: string;
    volume: number;
    unit: string;
    commodity_id: string;
    freight_cost: number | null;
    commodity_name?: string;
  }>(
    `SELECT d.id, d.volume, d.unit, d.commodity_id, d.freight_cost,
            c.name as commodity_name
     FROM lg_deliveries d
     LEFT JOIN commodities c ON c.id = d.commodity_id
     WHERE d.id = ANY($1) AND d.org_id = $2`,
    [deliveryIds, orgId]
  );

  if (deliveries.length === 0) throw new Error("No deliveries found");

  const lineItems = deliveries.map((d) => ({
    description: `Delivery ${d.id.slice(0, 8)} — ${d.commodity_name ?? d.commodity_id}`,
    quantity: Number(d.volume),
    unit_price: 0,
    amount: 0,
    delivery_id: d.id,
  }));

  const totalFreight = deliveries.reduce((sum, d) => sum + (Number(d.freight_cost) || 0), 0);

  return createInvoice({
    orgId,
    userId,
    counterpartyId,
    counterpartyName,
    invoiceType,
    subtotal: 0,
    freight: totalFreight,
    total: totalFreight,
    lineItems,
    notes: `Generated from ${deliveries.length} delivery(ies)`,
  });
}
