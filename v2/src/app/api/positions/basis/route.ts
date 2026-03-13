import { NextResponse } from "next/server";
import { getBasisSummary } from "@/lib/positionService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    await requirePlugin(orgId, "position_manager");

    const commodityId = searchParams.get("commodityId") ?? undefined;
    const orgUnitId = searchParams.get("orgUnitId") ?? undefined;

    const result = await getBasisSummary(orgId, commodityId, orgUnitId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[positions/basis] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
