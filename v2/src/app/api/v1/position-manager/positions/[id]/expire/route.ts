import { NextResponse } from "next/server";
import { expireOption } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, expiryDate } = body;

    if (!userId || !expiryDate) {
      return NextResponse.json({ error: "Missing userId or expiryDate" }, { status: 400 });
    }

    const result = await expireOption({ tradeId: id, userId, expiryDate });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/expire] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
