import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const commodities = await queryAll(
      `SELECT id, name, category, unit, currency, contract_size, tick_size, tick_value,
              exchange, contract_months, decimal_places, is_active, config,
              price_unit, volume_unit
       FROM commodities WHERE is_active = true ORDER BY name`
    );
    return NextResponse.json(commodities);
  } catch (err) {
    console.error("[commodities] GET Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      category,
      unit,
      currency,
      exchange,
      contract_size,
      tick_size,
      tick_value,
      contract_months,
      decimal_places,
      price_unit,
      volume_unit,
      config,
    } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: "Missing required fields: id, name" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO commodities
         (id, name, category, unit, currency, exchange, contract_size, tick_size,
          tick_value, contract_months, decimal_places, price_unit, volume_unit, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        id,
        name,
        category || "ag",
        unit || "MT",
        currency || "USD",
        exchange || null,
        contract_size || null,
        tick_size || null,
        tick_value || null,
        contract_months || null,
        decimal_places ?? 2,
        price_unit || null,
        volume_unit || null,
        config ? JSON.stringify(config) : null,
      ]
    );

    const commodity = result.rows[0];

    await auditLog({
      module: "kernel",
      entityType: "commodity",
      entityId: commodity.id,
      action: "create",
      after: commodity as Record<string, unknown>,
    });

    return NextResponse.json(commodity, { status: 201 });
  } catch (err) {
    console.error("[commodities] POST Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
