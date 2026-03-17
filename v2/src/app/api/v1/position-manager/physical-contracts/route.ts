import { NextResponse } from "next/server";
import { getPhysicalContracts } from "@/lib/hedgeBookService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const siteId = searchParams.get("siteId") ?? undefined;
    const deliveryMonth = searchParams.get("deliveryMonth") ?? undefined;
    const pricingStatus = searchParams.get("pricingStatus") ?? undefined;

    const contracts = await getPhysicalContracts(orgId, siteId, deliveryMonth, pricingStatus);
    return NextResponse.json(contracts);
  } catch (err) {
    console.error("[physical-contracts] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
