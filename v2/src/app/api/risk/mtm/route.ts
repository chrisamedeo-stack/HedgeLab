import { NextResponse } from "next/server";
import { getMtmSnapshots, runMtm } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "risk");

    const snapshots = await getMtmSnapshots({
      orgId,
      commodityId: searchParams.get("commodityId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });

    return NextResponse.json(snapshots);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/mtm] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId || !body.userId) {
      return NextResponse.json({ error: "Missing required fields: orgId, userId" }, { status: 400 });
    }

    await requirePlugin(body.orgId, "risk");

    const snapshots = await runMtm(body.orgId, body.userId);
    return NextResponse.json(snapshots, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/mtm] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
