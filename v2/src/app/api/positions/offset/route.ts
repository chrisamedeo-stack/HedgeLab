import { NextResponse } from "next/server";
import { executeOffset } from "@/lib/positionService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, allocationId, offsetPrice } = body;

    if (!userId || !allocationId || offsetPrice === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: userId, allocationId, offsetPrice" },
        { status: 400 }
      );
    }

    const result = await executeOffset({
      userId,
      allocationId,
      offsetPrice: Number(offsetPrice),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[offset] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
