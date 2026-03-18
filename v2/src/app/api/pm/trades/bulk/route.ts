import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";
import { bulkDefineSite, bulkDefineBudgetMonth, bulkAssignPortfolio } from "@/lib/pmTradeService";

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    const body = await request.json();
    const { action, tradeIds, orgId } = body;

    if (!action || !tradeIds?.length || !orgId) {
      return NextResponse.json(
        { error: "Missing required fields: action, tradeIds, orgId" },
        { status: 400 }
      );
    }

    await requirePlugin(orgId, "position_manager");

    let updated = 0;

    switch (action) {
      case "define-site":
        if (!body.siteId) {
          return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
        }
        updated = await bulkDefineSite(tradeIds, body.siteId, orgId, user.id);
        break;

      case "define-budget-month":
        if (!body.budgetMonth) {
          return NextResponse.json({ error: "Missing budgetMonth" }, { status: 400 });
        }
        updated = await bulkDefineBudgetMonth(tradeIds, body.budgetMonth, orgId, user.id);
        break;

      case "assign-portfolio":
        if (!body.portfolioId) {
          return NextResponse.json({ error: "Missing portfolioId" }, { status: 400 });
        }
        updated = await bulkAssignPortfolio(tradeIds, body.portfolioId, orgId, user.id);
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pm/trades/bulk] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
