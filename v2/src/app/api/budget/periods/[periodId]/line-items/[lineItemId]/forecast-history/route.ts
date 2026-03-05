import { NextResponse } from "next/server";
import { getForecastHistory } from "@/lib/budgetService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ periodId: string; lineItemId: string }> }
) {
  try {
    const { lineItemId } = await params;
    const history = await getForecastHistory(lineItemId);
    return NextResponse.json(history);
  } catch (err) {
    console.error("[budget/forecast-history] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
