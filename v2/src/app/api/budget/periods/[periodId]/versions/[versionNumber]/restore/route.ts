import { NextResponse } from "next/server";
import { restoreVersion } from "@/lib/budgetService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string; versionNumber: string }> }
) {
  try {
    const { periodId, versionNumber } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const lineItems = await restoreVersion(periodId, Number(versionNumber), userId);
    return NextResponse.json(lineItems);
  } catch (err) {
    console.error("[budget/versions/restore] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("locked") ? 409 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
