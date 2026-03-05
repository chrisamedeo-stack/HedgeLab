import { NextResponse } from "next/server";
import { createContract, listContracts } from "@/lib/contractService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import type { ContractFilters } from "@/types/contracts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "contracts");

    const filters: ContractFilters = {
      orgId,
      commodityId: searchParams.get("commodityId") ?? undefined,
      counterpartyId: searchParams.get("counterpartyId") ?? undefined,
      status: (searchParams.get("status") as ContractFilters["status"]) ?? undefined,
      contractType: (searchParams.get("contractType") as ContractFilters["contractType"]) ?? undefined,
      direction: (searchParams.get("direction") as ContractFilters["direction"]) ?? undefined,
    };

    const contracts = await listContracts(filters);
    return NextResponse.json(contracts);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[contracts] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId || !body.userId || !body.contractType || !body.direction || !body.totalVolume) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, contractType, direction, totalVolume" },
        { status: 400 }
      );
    }

    await requirePlugin(body.orgId, "contracts");

    const contract = await createContract({
      orgId: body.orgId,
      userId: body.userId,
      counterpartyId: body.counterpartyId,
      commodityId: body.commodityId,
      siteId: body.siteId,
      contractRef: body.contractRef,
      contractType: body.contractType,
      pricingType: body.pricingType,
      direction: body.direction,
      totalVolume: Number(body.totalVolume),
      price: body.price ? Number(body.price) : undefined,
      basisPrice: body.basisPrice ? Number(body.basisPrice) : undefined,
      basisMonth: body.basisMonth,
      formulaId: body.formulaId,
      currency: body.currency,
      deliveryStart: body.deliveryStart,
      deliveryEnd: body.deliveryEnd,
      deliveryLocation: body.deliveryLocation,
      paymentTermsDays: body.paymentTermsDays ? Number(body.paymentTermsDays) : undefined,
      incoterms: body.incoterms,
      qualitySpecs: body.qualitySpecs,
      notes: body.notes,
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[contracts] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
