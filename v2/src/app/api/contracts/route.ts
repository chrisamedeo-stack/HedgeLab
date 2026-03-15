import { NextResponse } from "next/server";
import { createContract, createBulkContracts, listContracts } from "@/lib/contractService";
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

function parseContractBody(body: Record<string, unknown>) {
  return {
    orgId: body.orgId as string,
    userId: body.userId as string,
    counterpartyId: body.counterpartyId as string | undefined,
    commodityId: body.commodityId as string | undefined,
    siteId: body.siteId as string | undefined,
    contractRef: body.contractRef as string | undefined,
    contractType: body.contractType as string,
    pricingType: body.pricingType as string | undefined,
    direction: body.direction as string,
    totalVolume: Number(body.totalVolume),
    price: body.price ? Number(body.price) : undefined,
    basisPrice: body.basisPrice ? Number(body.basisPrice) : undefined,
    basisMonth: body.basisMonth as string | undefined,
    formulaId: body.formulaId as string | undefined,
    currency: body.currency as string | undefined,
    deliveryStart: body.deliveryStart as string | undefined,
    deliveryEnd: body.deliveryEnd as string | undefined,
    deliveryLocation: body.deliveryLocation as string | undefined,
    paymentTermsDays: body.paymentTermsDays ? Number(body.paymentTermsDays) : undefined,
    incoterms: body.incoterms as string | undefined,
    qualitySpecs: body.qualitySpecs as Record<string, unknown> | undefined,
    notes: body.notes as string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Bulk create: array of contracts
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return NextResponse.json({ error: "Empty array" }, { status: 400 });
      }
      const first = body[0];
      if (!first.orgId || !first.userId) {
        return NextResponse.json({ error: "Each item needs orgId, userId, contractType, direction, totalVolume" }, { status: 400 });
      }
      await requirePlugin(first.orgId, "contracts");
      const paramsList = body.map(parseContractBody);
      const contracts = await createBulkContracts(paramsList);
      return NextResponse.json(contracts, { status: 201 });
    }

    // Single create
    if (!body.orgId || !body.userId || !body.contractType || !body.direction || !body.totalVolume) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, contractType, direction, totalVolume" },
        { status: 400 }
      );
    }

    await requirePlugin(body.orgId, "contracts");
    const contract = await createContract(parseContractBody(body));
    return NextResponse.json(contract, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[contracts] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
