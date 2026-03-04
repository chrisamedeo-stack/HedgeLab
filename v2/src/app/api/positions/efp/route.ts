import { NextResponse } from "next/server";
import { executeEFP, getAllocation } from "@/lib/positionService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, allocationId, lockPrice, basisPrice, deliveryMonth } = body;

    if (!userId || !allocationId || lockPrice === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: userId, allocationId, lockPrice" },
        { status: 400 }
      );
    }

    // Gate by plugin — look up org from allocation
    const alloc = await getAllocation(allocationId);
    if (alloc?.org_id) await requirePlugin(alloc.org_id, "position_manager");

    const locked = await executeEFP({
      userId,
      allocationId,
      lockPrice: Number(lockPrice),
      basisPrice: basisPrice ? Number(basisPrice) : undefined,
      deliveryMonth,
    });

    return NextResponse.json(locked, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[efp] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
