import { NextResponse } from "next/server";
import { upsertLineItem, upsertLineItems, saveLineItemComponents } from "@/lib/budgetService";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const body = await request.json();
    const { userId } = body;

    // Support both single and bulk upsert
    if (Array.isArray(body.items)) {
      const results = await upsertLineItems(periodId, body.items, userId);
      return NextResponse.json(results, { status: 201 });
    }

    // Single item
    const { budgetMonth, budgetedVolume, budgetPrice, committedVolume,
            committedAvgPrice, committedCost, hedgedVolume, hedgedAvgPrice,
            hedgedCost, forecastVolume, forecastPrice, futuresMonth,
            formulaId, formulaInputs, formulaPrice, components, notes } = body;

    if (!budgetMonth) {
      return NextResponse.json({ error: "budgetMonth required" }, { status: 400 });
    }

    const item = await upsertLineItem(periodId, {
      budgetMonth, budgetedVolume, budgetPrice,
      committedVolume, committedAvgPrice, committedCost,
      hedgedVolume, hedgedAvgPrice, hedgedCost,
      forecastVolume, forecastPrice, futuresMonth,
      formulaId, formulaInputs, formulaPrice, components, notes,
    }, userId);

    // Save components if provided
    if (Array.isArray(components) && components.length > 0) {
      await saveLineItemComponents(item.id, components);
    }

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[budget/line-items] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("locked") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
