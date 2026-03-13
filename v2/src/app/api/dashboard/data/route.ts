import { NextResponse } from "next/server";
import { getCoverageBySite, getPositionsByMonth } from "@/lib/dashboardService";
import { getCoverageSummary, listBudgetPeriods } from "@/lib/budgetService";
import { getHedgeBook, getRolloverCandidates } from "@/lib/positionService";
import { listTrades } from "@/lib/tradeService";
import { isPluginEnabled } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const commodityId = searchParams.get("commodityId") ?? undefined;
    const orgUnitId = searchParams.get("orgUnitId") ?? undefined;
    const full = searchParams.get("full") === "1";

    // Basic dashboard data (always returned)
    const baseQueries = [
      getCoverageBySite(orgId, commodityId, orgUnitId),
      getPositionsByMonth(orgId, commodityId, orgUnitId),
    ] as const;

    if (!full) {
      const [coverageBySite, positionsByMonth] = await Promise.all(baseQueries);
      return NextResponse.json({ coverageBySite, positionsByMonth });
    }

    // Full mode: aggregate everything in a single server round-trip
    const [budgetEnabled, pmEnabled, tradeEnabled] = await Promise.all([
      isPluginEnabled(orgId, "budget"),
      isPluginEnabled(orgId, "position_manager"),
      isPluginEnabled(orgId, "trade_capture"),
    ]);

    const queries: Promise<unknown>[] = [
      ...baseQueries,
      // Budget coverage + periods (only if enabled)
      budgetEnabled ? getCoverageSummary(orgId, commodityId, undefined, orgUnitId) : Promise.resolve(null),
      budgetEnabled ? listBudgetPeriods(orgId) : Promise.resolve([]),
      // Hedge book + roll candidates (only if PM enabled)
      pmEnabled ? getHedgeBook(orgId, commodityId, undefined, orgUnitId) : Promise.resolve([]),
      pmEnabled ? getRolloverCandidates(orgId, commodityId, orgUnitId) : Promise.resolve([]),
      // Recent trades (only if enabled)
      tradeEnabled ? listTrades({ orgId }) : Promise.resolve([]),
    ];

    const [
      coverageBySite,
      positionsByMonth,
      coverage,
      periods,
      hedgeBookEntries,
      rollCandidates,
      trades,
    ] = await Promise.all(queries);

    // Build hedge book KPIs server-side
    const entries = (hedgeBookEntries ?? []) as { status: string; allocated_volume: number }[];
    const openEntries = entries.filter((e) => e.status === "open");
    const efpEntries = entries.filter((e) => e.status === "efp_closed");
    const hedgeBookKpis = {
      totalAllocations: entries.length,
      openVolume: openEntries.reduce((s, e) => s + Number(e.allocated_volume ?? 0), 0),
      lockedVolume: efpEntries.reduce((s, e) => s + Number(e.allocated_volume ?? 0), 0),
      offsetVolume: entries.filter((e) => e.status === "offset").reduce((s, e) => s + Number(e.allocated_volume ?? 0), 0),
      rolledVolume: entries.filter((e) => e.status === "rolled").reduce((s, e) => s + Number(e.allocated_volume ?? 0), 0),
      openCount: openEntries.length,
      efpCount: efpEntries.length,
    };

    // Roll candidate grouping
    const candidates = (rollCandidates ?? []) as { urgency: string }[];
    const rollSummary = {
      total: candidates.length,
      critical: candidates.filter((c) => c.urgency === "CRITICAL").length,
      urgent: candidates.filter((c) => c.urgency === "URGENT").length,
    };

    // Pending approval count
    const allPeriods = (periods ?? []) as { status: string }[];
    const pendingApproval = allPeriods.filter((p) => p.status === "submitted").length;

    return NextResponse.json({
      coverageBySite,
      positionsByMonth,
      coverage,
      hedgeBook: { entries: hedgeBookEntries, kpis: hedgeBookKpis },
      rollCandidates: { candidates: rollCandidates, summary: rollSummary },
      trades: ((trades ?? []) as unknown[]).slice(0, 10),
      pendingApproval,
    });
  } catch (err) {
    console.error("[dashboard/data] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
