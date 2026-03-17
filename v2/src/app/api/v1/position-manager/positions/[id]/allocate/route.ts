import { NextResponse } from "next/server";
import { allocatePosition } from "@/lib/positionActions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, budgetMonth, siteId, volume } = body;

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (!budgetMonth && !siteId) return NextResponse.json({ error: "Must provide budgetMonth or siteId" }, { status: 400 });

    const result = await allocatePosition({ tradeId: id, userId, budgetMonth, siteId, volume });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[positions/:id/allocate] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
