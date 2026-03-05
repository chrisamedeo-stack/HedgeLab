import { NextResponse } from "next/server";
import { getDashboards, createDashboard } from "@/lib/dashboardService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const orgId = searchParams.get("orgId");

    if (!userId || !orgId) {
      return NextResponse.json({ error: "userId and orgId required" }, { status: 400 });
    }

    const dashboards = await getDashboards(userId, orgId);
    return NextResponse.json(dashboards);
  } catch (err) {
    console.error("[dashboard] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, orgId, name, layout } = body;

    if (!userId || !orgId) {
      return NextResponse.json({ error: "userId and orgId required" }, { status: 400 });
    }

    const dashboard = await createDashboard(userId, orgId, name, layout);
    return NextResponse.json(dashboard, { status: 201 });
  } catch (err) {
    console.error("[dashboard] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
