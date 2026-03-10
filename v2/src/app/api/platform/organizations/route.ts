import { NextResponse } from "next/server";
import { listOrganizations, createOrganization } from "@/lib/platformService";
import type { CreateOrganizationRequest } from "@/types/setup";

/** GET — List all organizations */
export async function GET() {
  try {
    const orgs = await listOrganizations();
    return NextResponse.json(orgs);
  } catch (err) {
    console.error("[platform/organizations] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** POST — Create a new organization (no single-org limit) */
export async function POST(request: Request) {
  try {
    const body: CreateOrganizationRequest = await request.json();
    const { orgName, baseCurrency, adminName, adminEmail, adminPassword, profileId } = body;

    if (!orgName || !baseCurrency || !adminName || !adminEmail || !profileId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!adminPassword || adminPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const result = await createOrganization(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[platform/organizations] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
