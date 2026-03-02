import { NextResponse } from "next/server";
import { executeEFP } from "@/lib/positionService";

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

    const locked = await executeEFP({
      userId,
      allocationId,
      lockPrice: Number(lockPrice),
      basisPrice: basisPrice ? Number(basisPrice) : undefined,
      deliveryMonth,
    });

    return NextResponse.json(locked, { status: 201 });
  } catch (err) {
    console.error("[efp] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
