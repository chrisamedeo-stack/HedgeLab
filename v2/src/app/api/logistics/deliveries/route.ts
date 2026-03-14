import { NextResponse } from "next/server";
import { listDeliveries, recordDelivery } from "@/lib/logisticsService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import type { DeliveryFilters } from "@/types/logistics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "logistics");

    const filters: DeliveryFilters = {
      orgId,
      siteId: searchParams.get("siteId") ?? undefined,
      commodityId: searchParams.get("commodityId") ?? undefined,
      contractId: searchParams.get("contractId") ?? undefined,
      status: (searchParams.get("status") as DeliveryFilters["status"]) ?? undefined,
    };

    const deliveries = await listDeliveries(filters);
    return NextResponse.json(deliveries);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[deliveries] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, siteId, commodityId, deliveryDate, volume, unit } = body;

    if (!orgId || !userId || !siteId || !commodityId || !deliveryDate || !volume || !unit) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, siteId, commodityId, deliveryDate, volume, unit" },
        { status: 400 }
      );
    }

    await requirePlugin(orgId, "logistics");

    const delivery = await recordDelivery({
      orgId,
      userId,
      siteId,
      commodityId,
      contractId: body.contractId,
      deliveryDate,
      volume: Number(volume),
      unit,
      status: body.status,
      carrier: body.carrier,
      vehicleId: body.vehicleId,
      origin: body.origin,
      destination: body.destination,
      freightCost: body.freightCost ? Number(body.freightCost) : undefined,
      qualityResults: body.qualityResults,
      weightTicket: body.weightTicket,
      notes: body.notes,
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[deliveries] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
