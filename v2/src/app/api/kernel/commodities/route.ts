import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

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
    console.error("[commodities] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
