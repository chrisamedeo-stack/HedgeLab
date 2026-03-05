import { NextResponse } from "next/server";
import { getMtmHistory } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "risk");

    const days = searchParams.get("days") ? Number(searchParams.get("days")) : 30;
    const history = await getMtmHistory(orgId, days);
    return NextResponse.json(history);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/mtm/history] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
