import { NextResponse } from "next/server";
import { listBudgetPeriods, createBudgetPeriod } from "@/lib/budgetService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const periods = await listBudgetPeriods(orgId, {
      siteId: searchParams.get("siteId") ?? undefined,
      commodityId: searchParams.get("commodityId") ?? undefined,
      budgetYear: searchParams.get("budgetYear") ? Number(searchParams.get("budgetYear")) : undefined,
      status: searchParams.get("status") ?? undefined,
    });

    return NextResponse.json(periods);
  } catch (err) {
    console.error("[budget/periods] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, siteId, commodityId, budgetYear, notes, currency } = body;

    if (!orgId || !userId || !siteId || !commodityId || !budgetYear) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, siteId, commodityId, budgetYear" },
        { status: 400 }
      );
    }

    const period = await createBudgetPeriod({
      orgId, userId, siteId, commodityId,
      budgetYear: Number(budgetYear),
      notes, currency,
    });

    return NextResponse.json(period, { status: 201 });
  } catch (err) {
    console.error("[budget/periods] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("unique") || msg.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
