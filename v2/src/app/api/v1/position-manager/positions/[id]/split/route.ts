import { NextResponse } from "next/server";
import { splitPosition } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, splits } = body;

    if (!userId || !splits?.length) {
      return NextResponse.json({ error: "Missing userId or splits" }, { status: 400 });
    }

    const result = await splitPosition({ tradeId: id, userId, splits });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/split] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
