import { NextResponse } from "next/server";
import { getInventory, recordInventorySnapshot } from "@/lib/logisticsService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (orgId) await requirePlugin(orgId, "logistics");

    const siteId = searchParams.get("siteId") ?? undefined;
    const commodityId = searchParams.get("commodityId") ?? undefined;
    const asOfDate = searchParams.get("asOfDate") ?? undefined;

    const inventory = await getInventory(siteId, commodityId, asOfDate);
    return NextResponse.json(inventory);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[inventory] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, siteId, commodityId, asOfDate, onHandVolume, unit } = body;

    if (!userId || !siteId || !commodityId || !asOfDate || onHandVolume == null || !unit) {
      return NextResponse.json(
        { error: "Missing required fields: userId, siteId, commodityId, asOfDate, onHandVolume, unit" },
        { status: 400 }
      );
    }

    if (orgId) await requirePlugin(orgId, "logistics");

    const snapshot = await recordInventorySnapshot({
      userId,
      siteId,
      commodityId,
      asOfDate,
      onHandVolume: Number(onHandVolume),
      committedOut: body.committedOut != null ? Number(body.committedOut) : undefined,
      unit,
      avgCost: body.avgCost != null ? Number(body.avgCost) : undefined,
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[inventory] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
