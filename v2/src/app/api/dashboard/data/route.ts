import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth";
import { isPluginEnabled } from "@/lib/orgHierarchy";
import {
  getCoverageBySite,
  getPositionsByMonth,
  getDashboardKpis,
  getChildSummaries,
  getDashboardAlerts,
  getSiteOperationalData,
} from "@/lib/dashboardService";
import type { DrillLevel } from "@/types/dashboard";

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    const { searchParams } = new URL(request.url);

    const orgId = user.orgId;
    const level = (searchParams.get("level") ?? "corporate") as DrillLevel;
    const orgUnitId = searchParams.get("orgUnitId") ?? undefined;
    const siteId = searchParams.get("siteId") ?? undefined;
    const commodityId = searchParams.get("commodityId") ?? undefined;

    // Fetch KPIs + alerts in parallel for all levels
    const [kpis, alerts] = await Promise.all([
      getDashboardKpis(orgId, commodityId, orgUnitId, siteId),
      getDashboardAlerts(orgId, commodityId, orgUnitId, siteId),
    ]);

    if (level === "site" && siteId) {
      // Site level: return operational data
      const operational = await getSiteOperationalData(orgId, siteId, commodityId);
      return NextResponse.json({ kpis, alerts, operational });
    }

    // Corporate / unit level: return children + charts
    const [budgetEnabled, pmEnabled] = await Promise.all([
      isPluginEnabled(orgId, "budget"),
      isPluginEnabled(orgId, "position_manager"),
    ]);

    const queries: Promise<unknown>[] = [
      getChildSummaries(orgId, commodityId, orgUnitId),
      budgetEnabled ? getCoverageBySite(orgId, commodityId, orgUnitId) : Promise.resolve([]),
      pmEnabled ? getPositionsByMonth(orgId, commodityId, orgUnitId) : Promise.resolve([]),
    ];

    const [children, coverageBySite, positionsByMonth] = await Promise.all(queries);

    return NextResponse.json({
      kpis,
      alerts,
      children,
      coverageBySite,
      positionsByMonth,
    });
  } catch (err) {
    console.error("[dashboard/data] GET error:", err);
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
