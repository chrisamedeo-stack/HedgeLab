import { NextResponse } from "next/server";
import { checkLimits } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId || !body.userId) {
      return NextResponse.json({ error: "Missing required fields: orgId, userId" }, { status: 400 });
    }

    await requirePlugin(body.orgId, "risk");

    const checks = await checkLimits(body.orgId, body.userId);
    return NextResponse.json(checks);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/limits/check] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
