import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { createPhysicalPosition, createMultiMonthPhysicals } from "@/lib/positionService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const siteId = searchParams.get("siteId");
    const commodityId = searchParams.get("commodityId");
    const status = searchParams.get("status");

    let sql = `
      SELECT p.*,
             s.name as site_name, s.code as site_code,
             c.name as commodity_name,
             cp.name as supplier_name
      FROM pm_physical_positions p
      LEFT JOIN sites s ON s.id = p.site_id
      LEFT JOIN commodities c ON c.id = p.commodity_id
      LEFT JOIN ct_counterparties cp ON cp.id = p.supplier_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (orgId) {
      params.push(orgId);
      sql += ` AND p.org_id = $${params.length}`;
    }
    if (siteId) {
      params.push(siteId);
      sql += ` AND p.site_id = $${params.length}`;
    }
    if (commodityId) {
      params.push(commodityId);
      sql += ` AND p.commodity_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND p.status = $${params.length}`;
    }

    sql += ` ORDER BY p.delivery_month, p.created_at DESC`;

    const physicals = await queryAll(sql, params);
    return NextResponse.json(physicals);
  } catch (err) {
    console.error("[physicals] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, siteId, commodityId, direction,
            price, pricingType, basisPrice, basisMonth,
            counterparty, supplierId, contractRef, currency,
            months } = body;

    if (!orgId || !userId || !siteId || !commodityId || !direction) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, siteId, commodityId, direction" },
        { status: 400 }
      );
    }

    // Multi-month entry
    if (months && Array.isArray(months) && months.length > 0) {
      const baseParams = {
        orgId, userId, siteId, commodityId, direction,
        price: price ? Number(price) : undefined,
        pricingType, basisPrice: basisPrice ? Number(basisPrice) : undefined,
        basisMonth, counterparty,
        supplierId: supplierId || undefined,
        contractRef: contractRef || undefined,
        currency,
      };
      const physicals = await createMultiMonthPhysicals(
        baseParams,
        months.map((m: { month: string; volume: number }) => ({
          month: m.month,
          volume: Number(m.volume),
        }))
      );
      return NextResponse.json(physicals, { status: 201 });
    }

    // Single-month entry
    const { volume, deliveryMonth } = body;
    if (!volume) {
      return NextResponse.json(
        { error: "Missing required field: volume (or months array)" },
        { status: 400 }
      );
    }

    const physical = await createPhysicalPosition({
      orgId, userId, siteId, commodityId, direction,
      volume: Number(volume),
      price: price ? Number(price) : undefined,
      pricingType, basisPrice: basisPrice ? Number(basisPrice) : undefined,
      basisMonth, deliveryMonth, counterparty,
      supplierId: supplierId || undefined,
      contractRef: contractRef || undefined,
      currency,
    });

    return NextResponse.json(physical, { status: 201 });
  } catch (err) {
    console.error("[physicals] POST error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
