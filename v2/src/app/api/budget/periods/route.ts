import { NextResponse } from "next/server";
import { listBudgetPeriods, createBudgetPeriod } from "@/lib/budgetService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    await requirePlugin(orgId, "budget");

    const periods = await listBudgetPeriods(orgId, {
      siteId: searchParams.get("siteId") ?? undefined,
      commodityId: searchParams.get("commodityId") ?? undefined,
      budgetYear: searchParams.get("budgetYear") ? Number(searchParams.get("budgetYear")) : undefined,
      status: searchParams.get("status") ?? undefined,
    });

    return NextResponse.json(periods);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[budget/periods] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, siteId, commodityId, budgetYear, notes, currency } = body;

    await requirePlugin(orgId, "budget");

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
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[budget/periods] POST error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("unique") || msg.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
