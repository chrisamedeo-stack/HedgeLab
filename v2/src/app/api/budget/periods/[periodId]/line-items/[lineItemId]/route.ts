import { NextResponse } from "next/server";
import { deleteLineItem } from "@/lib/budgetService";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ periodId: string; lineItemId: string }> }
) {
  try {
    const { lineItemId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? undefined;

    await deleteLineItem(lineItemId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[budget/line-items/[id]] DELETE error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("locked") ? 409 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
