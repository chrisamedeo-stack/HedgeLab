import { NextResponse } from "next/server";
import { getEffectiveCommodities, assignCommodity, removeCommodity } from "@/lib/commodityAssignments";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json({ error: "Missing entityType or entityId" }, { status: 400 });
    }

    const result = await getEffectiveCommodities(entityType, entityId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[commodity-assignments] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, entityType, entityId, commodityId, userId } = await request.json();

    if (!orgId || !entityType || !entityId || !commodityId) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, entityType, entityId, commodityId" },
        { status: 400 }
      );
    }

    await assignCommodity(orgId, entityType, entityId, commodityId);

    if (userId) {
      await auditLog({
        orgId,
        userId,
        module: "kernel",
        entityType: "commodity_assignment",
        entityId,
        action: "assign",
        after: { entityType, entityId, commodityId },
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[commodity-assignments] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { orgId, entityType, entityId, commodityId, userId } = await request.json();

    if (!orgId || !entityType || !entityId || !commodityId) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, entityType, entityId, commodityId" },
        { status: 400 }
      );
    }

    await removeCommodity(orgId, entityType, entityId, commodityId);

    if (userId) {
      await auditLog({
        orgId,
        userId,
        module: "kernel",
        entityType: "commodity_assignment",
        entityId,
        action: "remove",
        after: { entityType, entityId, commodityId },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[commodity-assignments] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
