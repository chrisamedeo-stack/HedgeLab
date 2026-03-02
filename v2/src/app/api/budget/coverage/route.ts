import { NextResponse } from "next/server";
import { getCoverageSummary } from "@/lib/budgetService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    const summary = await getCoverageSummary(
      orgId,
      searchParams.get("commodityId") ?? undefined,
      searchParams.get("siteId") ?? undefined,
    );

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[budget/coverage] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
