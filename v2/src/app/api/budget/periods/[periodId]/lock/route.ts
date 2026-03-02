import { NextResponse } from "next/server";
import { lockBudget } from "@/lib/budgetService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const period = await lockBudget(periodId, userId);
    return NextResponse.json(period);
  } catch (err) {
    console.error("[budget/lock] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("approved") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
