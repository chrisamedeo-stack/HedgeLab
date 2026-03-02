import { NextResponse } from "next/server";
import { getBudgetPeriod } from "@/lib/budgetService";
import { query, queryOne } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const period = await getBudgetPeriod(periodId);
    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    return NextResponse.json(period);
  } catch (err) {
    console.error("[budget/periods/[id]] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const { periodId } = await params;
    const body = await request.json();
    const { notes } = body;

    const updated = await queryOne(
      `UPDATE bgt_periods SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [notes ?? null, periodId]
    );
    if (!updated) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[budget/periods/[id]] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
