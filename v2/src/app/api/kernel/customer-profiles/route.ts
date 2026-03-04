import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { applyCustomerProfile } from "@/lib/orgHierarchy";

export async function GET() {
  try {
    const profiles = await queryAll(
      `SELECT id, display_name, operating_model, default_plugins,
              hierarchy_template, default_site_types, default_settings, description
       FROM customer_profiles
       ORDER BY display_name`
    );
    return NextResponse.json(profiles);
  } catch (err) {
    console.error("[customer-profiles] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, profileId, userId } = body;

    if (!orgId || !profileId || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, profileId, userId" },
        { status: 400 }
      );
    }

    await applyCustomerProfile(orgId, profileId, userId);

    return NextResponse.json({ success: true, profileId });
  } catch (err) {
    console.error("[customer-profiles] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
