import { NextResponse } from "next/server";
import { getOrganizationDetail, updateOrganization, deactivateOrganization } from "@/lib/platformService";

/** GET — Organization detail */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const org = await getOrganizationDetail(orgId);
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    return NextResponse.json(org);
  } catch (err) {
    console.error("[platform/organizations/detail] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** PATCH — Update organization */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const body = await request.json();
    const updated = await updateOrganization(orgId, body);
    if (!updated) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[platform/organizations/detail] PATCH error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE — Deactivate organization (soft delete) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await deactivateOrganization(orgId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[platform/organizations/detail] DELETE error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
