import { NextResponse } from "next/server";
import { getDashboard, updateDashboard, deleteDashboard } from "@/lib/dashboardService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const { dashboardId } = await params;
    const dashboard = await getDashboard(dashboardId);
    if (!dashboard) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error("[dashboard/:id] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const { dashboardId } = await params;
    const body = await request.json();
    const { userId, name, layout, isDefault } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const dashboard = await updateDashboard(dashboardId, userId, { name, layout, isDefault });
    return NextResponse.json(dashboard);
  } catch (err) {
    console.error("[dashboard/:id] PUT error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ dashboardId: string }> }
) {
  try {
    const { dashboardId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    await deleteDashboard(dashboardId, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[dashboard/:id] DELETE error:", err);
    const msg = (err as Error).message;
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
