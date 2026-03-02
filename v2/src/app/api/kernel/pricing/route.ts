import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { loadFormula, evaluateFormula, savePricingResult } from "@/lib/pricingEngine";
import { auditLog } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const commodityId = searchParams.get("commodityId");

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId parameter" },
        { status: 400 }
      );
    }

    let sql = `
      SELECT id, org_id, name, description, commodity_id, formula_type,
             components, output_unit, rounding, is_active, is_system,
             created_at, updated_at
      FROM pricing_formulas
      WHERE org_id = $1 AND is_active = true
    `;
    const params: unknown[] = [orgId];

    if (commodityId) {
      params.push(commodityId);
      sql += ` AND (commodity_id = $${params.length} OR commodity_id IS NULL)`;
    }

    sql += ` ORDER BY is_system DESC, name`;

    const formulas = await queryAll(sql, params);
    return NextResponse.json(formulas);
  } catch (err) {
    console.error("[pricing] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "evaluate") {
      // Evaluate a formula: { action: "evaluate", formulaId, inputs, marketPrices?, fxRates? }
      const formula = await loadFormula(body.formulaId);
      if (!formula) {
        return NextResponse.json(
          { error: "Formula not found" },
          { status: 404 }
        );
      }

      const result = evaluateFormula(formula, {
        inputs: body.inputs ?? {},
        marketPrices: body.marketPrices,
        fxRates: body.fxRates,
        rateTables: body.rateTables,
      });

      // Optionally save the result
      if (body.entityType && body.entityId) {
        await savePricingResult({
          formulaId: body.formulaId,
          entityType: body.entityType,
          entityId: body.entityId,
          componentValues: result.componentValues,
          totalPrice: result.totalPrice,
          currency: result.currency,
          appliedBy: body.userId,
          notes: body.notes,
        });
      }

      return NextResponse.json(result);
    }

    // Default: create a new formula
    const {
      orgId, name, description, commodityId, formulaType,
      components, outputUnit, rounding = 4, isSystem = false,
      createdBy,
    } = body;

    if (!orgId || !name || !formulaType || !components) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, name, formulaType, components" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO pricing_formulas
         (org_id, name, description, commodity_id, formula_type, components,
          output_unit, rounding, is_system, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [orgId, name, description ?? null, commodityId ?? null, formulaType,
       JSON.stringify(components), outputUnit ?? null, rounding, isSystem, createdBy ?? null]
    );

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "pricing_formula",
      entityId: result.rows[0].id,
      action: "create",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[pricing] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
