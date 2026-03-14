import { NextResponse } from "next/server";
import { getInvoice, updateInvoice, issueInvoice, cancelInvoice } from "@/lib/settlementService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    return NextResponse.json(invoice);
  } catch (err) {
    console.error("[invoice] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, action, ...changes } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Status transition actions
    if (action === "issue") {
      const issued = await issueInvoice(id, userId);
      return NextResponse.json(issued);
    }

    // Field updates (draft only)
    const updated = await updateInvoice(id, userId, {
      counterpartyId: changes.counterpartyId,
      counterpartyName: changes.counterpartyName,
      invoiceNumber: changes.invoiceNumber,
      invoiceDate: changes.invoiceDate,
      dueDate: changes.dueDate,
      subtotal: changes.subtotal != null ? Number(changes.subtotal) : undefined,
      tax: changes.tax != null ? Number(changes.tax) : undefined,
      freight: changes.freight != null ? Number(changes.freight) : undefined,
      adjustments: changes.adjustments != null ? Number(changes.adjustments) : undefined,
      total: changes.total != null ? Number(changes.total) : undefined,
      lineItems: changes.lineItems,
      notes: changes.notes,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[invoice] PATCH error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const cancelled = await cancelInvoice(id, userId);
    return NextResponse.json(cancelled);
  } catch (err) {
    console.error("[invoice] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
