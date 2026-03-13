import { NextResponse } from "next/server";
import { getCoverageSummary } from "@/lib/budgetService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    await requirePlugin(orgId, "budget");

    const summary = await getCoverageSummary(
      orgId,
      searchParams.get("commodityId") ?? undefined,
      searchParams.get("siteId") ?? undefined,
      searchParams.get("orgUnitId") ?? undefined,
    );

    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[budget/coverage] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
