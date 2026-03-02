import { NextResponse } from "next/server";
import { executeRoll } from "@/lib/positionService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, orgId, sourceAllocationId, closePrice, openPrice,
            openMonth, openVolume, commission, fees,
            autoReallocate, reallocationSiteId, reallocationBudgetMonth,
            notes } = body;

    if (!userId || !orgId || !sourceAllocationId || closePrice === undefined ||
        openPrice === undefined || !openMonth) {
      return NextResponse.json(
        { error: "Missing required fields: userId, orgId, sourceAllocationId, closePrice, openPrice, openMonth" },
        { status: 400 }
      );
    }

    const rollover = await executeRoll({
      userId,
      orgId,
      sourceAllocationId,
      closePrice: Number(closePrice),
      openPrice: Number(openPrice),
      openMonth,
      openVolume: openVolume ? Number(openVolume) : undefined,
      commission: commission ? Number(commission) : undefined,
      fees: fees ? Number(fees) : undefined,
      autoReallocate,
      reallocationSiteId,
      reallocationBudgetMonth,
      notes,
    });

    return NextResponse.json(rollover, { status: 201 });
  } catch (err) {
    console.error("[roll] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
