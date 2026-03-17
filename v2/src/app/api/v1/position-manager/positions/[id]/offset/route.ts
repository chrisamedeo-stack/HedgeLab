import { NextResponse } from "next/server";
import { executeOffset } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, offsetPrice, offsetDate, volume } = body;

    if (!userId || offsetPrice == null || !offsetDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await executeOffset({ tradeId: id, userId, offsetPrice, offsetDate, volume });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/offset] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
