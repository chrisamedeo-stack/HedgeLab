import { NextResponse } from "next/server";
import { getMtmSummary } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "risk");

    const summary = await getMtmSummary(orgId);
    return NextResponse.json(summary);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/mtm/summary] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
