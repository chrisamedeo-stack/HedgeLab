import { NextResponse } from "next/server";
import { reassignBook } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, toBookId, reason } = body;

    if (!userId || !toBookId) {
      return NextResponse.json({ error: "Missing userId or toBookId" }, { status: 400 });
    }

    const result = await reassignBook({ tradeId: id, userId, toBookId, reason });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/reassign-book] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
