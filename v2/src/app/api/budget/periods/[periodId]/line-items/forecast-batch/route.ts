import { NextResponse } from "next/server";
import { upsertLineItem, logForecastChange } from "@/lib/budgetService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const body = await request.json();
    const { updates, note, userId } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array required" }, { status: 400 });
    }

    const results = [];
    for (const u of updates) {
      const item = await upsertLineItem(
        periodId,
        {
          budgetMonth: u.budgetMonth,
          forecastVolume: u.forecastVolume,
          forecastPrice: u.forecastPrice,
        },
        userId
      );
      await logForecastChange(
        item.id,
        u.forecastVolume ?? null,
        u.forecastPrice ?? null,
        userId,
        note
      );
      results.push(item);
    }

    return NextResponse.json(results, { status: 200 });
  } catch (err) {
    console.error("[budget/forecast-batch] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("locked") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
