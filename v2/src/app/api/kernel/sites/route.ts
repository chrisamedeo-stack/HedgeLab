import { NextResponse } from "next/server";
import { queryAll, queryOne, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const region = searchParams.get("region");
    const orgUnitId = searchParams.get("orgUnitId");

    let sql = `
      SELECT s.id, s.org_id, s.site_type_id, s.name, s.code, s.region,
             s.timezone, s.is_active, s.config, s.org_unit_id,
             st.name as site_type_name, st.supported_commodities, st.description as site_type_description
      FROM sites s
      JOIN site_types st ON st.id = s.site_type_id
      WHERE s.is_active = true
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND s.org_id = $${params.length}`;
    }
    if (region) {
      params.push(region);
      sql += ` AND s.region = $${params.length}`;
    }
    if (orgUnitId) {
      params.push(orgUnitId);
      sql += ` AND s.id IN (SELECT site_id FROM get_sites_under_unit($${params.length}))`;
    }

    sql += ` ORDER BY s.region, s.name`;

    const sites = await queryAll(sql, params);
    return NextResponse.json(sites);
  } catch (err) {
    console.error("[sites] GET Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, code, name, region, siteTypeId, orgUnitId, timezone, config } = body;

    if (!orgId || !name) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, name" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO sites (org_id, code, name, region, site_type_id, org_unit_id, timezone, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [orgId, code || null, name, region || null, siteTypeId || null, orgUnitId || null, timezone || null, config ? JSON.stringify(config) : null]
    );

    const site = result.rows[0];

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "site",
      entityId: site.id,
      action: "create",
      after: site as Record<string, unknown>,
    });

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    console.error("[sites] POST Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
