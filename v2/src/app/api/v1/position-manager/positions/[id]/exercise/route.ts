import { NextResponse } from "next/server";
import { exerciseOption } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, exerciseDate } = body;

    if (!userId || !exerciseDate) {
      return NextResponse.json({ error: "Missing userId or exerciseDate" }, { status: 400 });
    }

    const result = await exerciseOption({ tradeId: id, userId, exerciseDate });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/exercise] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
