import { NextResponse } from "next/server";
import { listInvoices, createInvoice, generateFromDeliveries } from "@/lib/settlementService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import type { InvoiceFilters } from "@/types/settlement";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "settlement");

    const filters: InvoiceFilters = {
      orgId,
      counterpartyId: searchParams.get("counterpartyId") ?? undefined,
      status: (searchParams.get("status") as InvoiceFilters["status"]) ?? undefined,
      invoiceType: (searchParams.get("invoiceType") as InvoiceFilters["invoiceType"]) ?? undefined,
    };

    const invoices = await listInvoices(filters);
    return NextResponse.json(invoices);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[invoices] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId } = body;

    if (!orgId || !userId) {
      return NextResponse.json({ error: "orgId and userId required" }, { status: 400 });
    }

    await requirePlugin(orgId, "settlement");

    // Generate from deliveries mode
    if (body.deliveryIds && Array.isArray(body.deliveryIds)) {
      const invoice = await generateFromDeliveries(
        orgId,
        userId,
        body.deliveryIds,
        body.invoiceType ?? "purchase",
        body.counterpartyId,
        body.counterpartyName
      );
      return NextResponse.json(invoice, { status: 201 });
    }

    // Direct create mode
    if (!body.invoiceType || body.subtotal == null || body.total == null) {
      return NextResponse.json(
        { error: "Missing required fields: invoiceType, subtotal, total" },
        { status: 400 }
      );
    }

    const invoice = await createInvoice({
      orgId,
      userId,
      counterpartyId: body.counterpartyId,
      counterpartyName: body.counterpartyName,
      invoiceType: body.invoiceType,
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      subtotal: Number(body.subtotal),
      tax: body.tax != null ? Number(body.tax) : undefined,
      freight: body.freight != null ? Number(body.freight) : undefined,
      adjustments: body.adjustments != null ? Number(body.adjustments) : undefined,
      total: Number(body.total),
      currency: body.currency,
      lineItems: body.lineItems,
      notes: body.notes,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[invoices] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
