import { NextResponse } from "next/server";
import { getExposureByTenor } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "risk");

    const commodityId = searchParams.get("commodityId") ?? undefined;
    const exposure = await getExposureByTenor(orgId, commodityId);
    return NextResponse.json(exposure);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/exposure/tenor] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
