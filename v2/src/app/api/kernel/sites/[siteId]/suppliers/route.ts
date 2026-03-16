import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;

    // Join with ct_counterparties for name/code — falls back if table doesn't exist
    let rows: { id: string; counterparty_id: string; counterparty_name: string; counterparty_code: string | null }[] = [];
    try {
      const result = await query<{
        id: string;
        counterparty_id: string;
        counterparty_name: string;
        counterparty_code: string | null;
      }>(
        `SELECT ss.id, ss.counterparty_id,
                COALESCE(cp.name, 'Unknown') AS counterparty_name,
                cp.short_name AS counterparty_code
         FROM site_suppliers ss
         LEFT JOIN ct_counterparties cp ON cp.id = ss.counterparty_id
         WHERE ss.site_id = $1
         ORDER BY cp.name`,
        [siteId]
      );
      rows = result.rows;
    } catch {
      // ct_counterparties table may not exist — return raw IDs
      const result = await query<{ id: string; counterparty_id: string }>(
        `SELECT id, counterparty_id FROM site_suppliers WHERE site_id = $1`,
        [siteId]
      );
      rows = result.rows.map((r) => ({
        ...r,
        counterparty_name: "Unknown",
        counterparty_code: null,
      }));
    }

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[site-suppliers] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const { counterpartyId, userId } = await request.json();

    if (!counterpartyId) {
      return NextResponse.json({ error: "counterpartyId required" }, { status: 400 });
    }

    const site = await queryOne<{ org_id: string }>(`SELECT org_id FROM sites WHERE id = $1`, [siteId]);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const result = await queryOne<{ id: string; counterparty_id: string }>(
      `INSERT INTO site_suppliers (site_id, counterparty_id)
       VALUES ($1, $2)
       ON CONFLICT (site_id, counterparty_id) DO NOTHING
       RETURNING id, counterparty_id`,
      [siteId, counterpartyId]
    );

    await auditLog({
      orgId: site.org_id,
      userId,
      module: "kernel",
      entityType: "site_supplier",
      entityId: siteId,
      action: "link",
      after: { siteId, counterpartyId },
    });

    return NextResponse.json(result ?? { id: null, counterpartyId }, { status: 201 });
  } catch (err) {
    console.error("[site-suppliers] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
