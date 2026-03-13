import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserLayout, saveUserLayout, deleteUserLayout, getOrgDefaultLayout } from "@/lib/dashboardLayoutService";
import { resolveLayout } from "@/lib/widgetRegistry";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") ?? user.orgId;

    // Resolution chain: user saved → org default → system default
    const userLayout = await getUserLayout(user.id, orgId);
    if (userLayout) {
      return NextResponse.json(resolveLayout(userLayout));
    }

    const orgDefault = await getOrgDefaultLayout(orgId);
    return NextResponse.json(resolveLayout(orgDefault));
  } catch (err) {
    console.error("[dashboard/layout] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const orgId = body.orgId ?? user.orgId;
    const layout = body.layout;

    if (!Array.isArray(layout)) {
      return NextResponse.json({ error: "layout must be an array" }, { status: 400 });
    }

    await saveUserLayout(user.id, orgId, layout);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[dashboard/layout] PUT error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") ?? user.orgId;

    await deleteUserLayout(user.id, orgId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[dashboard/layout] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
