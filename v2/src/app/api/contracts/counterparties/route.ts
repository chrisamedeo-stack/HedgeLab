import { NextResponse } from "next/server";
import { createCounterparty, listCounterparties } from "@/lib/contractService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "contracts");

    const isActive = searchParams.get("isActive");
    const counterparties = await listCounterparties({
      orgId,
      isActive: isActive !== null ? isActive === "true" : undefined,
    });

    return NextResponse.json(counterparties);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[counterparties] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId || !body.userId || !body.name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, name" },
        { status: 400 }
      );
    }

    await requirePlugin(body.orgId, "contracts");

    const counterparty = await createCounterparty({
      orgId: body.orgId,
      userId: body.userId,
      name: body.name,
      shortName: body.shortName,
      counterpartyType: body.counterpartyType,
      creditLimit: body.creditLimit ? Number(body.creditLimit) : undefined,
      creditRating: body.creditRating,
      paymentTermsDays: body.paymentTermsDays ? Number(body.paymentTermsDays) : undefined,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      address: body.address,
      notes: body.notes,
    });

    return NextResponse.json(counterparty, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[counterparties] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
