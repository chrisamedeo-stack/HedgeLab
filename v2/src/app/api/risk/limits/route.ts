import { NextResponse } from "next/server";
import { createLimit, listLimits } from "@/lib/riskService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    await requirePlugin(orgId, "risk");

    const activeOnly = searchParams.get("activeOnly") !== "false";
    const limits = await listLimits(orgId, activeOnly);
    return NextResponse.json(limits);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/limits] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.orgId || !body.userId || !body.limitType || !body.limitValue) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, limitType, limitValue" },
        { status: 400 }
      );
    }

    await requirePlugin(body.orgId, "risk");

    const limit = await createLimit({
      orgId: body.orgId,
      userId: body.userId,
      commodityId: body.commodityId,
      limitType: body.limitType,
      limitValue: Number(body.limitValue),
      alertThreshold: body.alertThreshold ? Number(body.alertThreshold) : undefined,
      direction: body.direction,
      notes: body.notes,
    });

    return NextResponse.json(limit, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[risk/limits] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
