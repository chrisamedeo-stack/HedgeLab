import { NextResponse } from "next/server";
import { getHedgeBook } from "@/lib/positionService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const commodityId = searchParams.get("commodityId");
    const regionGroupId = searchParams.get("regionGroupId");
    const orgUnitId = searchParams.get("orgUnitId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    await requirePlugin(orgId, "position_manager");

    const entries = await getHedgeBook(
      orgId,
      commodityId ?? undefined,
      regionGroupId ?? undefined,
      orgUnitId ?? undefined
    );

    // Group by contract month for display
    const byMonth: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const month = entry.contract_month ?? "unassigned";
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(entry);
    }

    // Compute KPIs
    const openEntries = entries.filter((e) => e.status === "open");
    const lockedEntries = entries.filter((e) => e.status === "efp_closed");

    const kpis = {
      totalAllocations: entries.length,
      openVolume: openEntries.reduce((s, e) => s + Number(e.allocated_volume), 0),
      lockedVolume: lockedEntries.reduce((s, e) => s + Number(e.allocated_volume), 0),
      offsetVolume: entries
        .filter((e) => e.status === "offset")
        .reduce((s, e) => s + Number(e.allocated_volume), 0),
    };

    return NextResponse.json({ entries, byMonth, kpis });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[hedge-book] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
