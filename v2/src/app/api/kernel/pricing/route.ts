import { NextResponse } from "next/server";
import { queryAll, queryOne, query } from "@/lib/db";
import { loadFormula, evaluateFormula, savePricingResult } from "@/lib/pricingEngine";
import { auditLog } from "@/lib/audit";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

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

    await requirePlugin(orgId, "formula_pricing");

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
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
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
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[pricing] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, commodityId, formulaType, components, outputUnit, rounding, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing formula id" }, { status: 400 });
    }

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM pricing_formulas WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "Formula not found" }, { status: 404 });
    }

    const result = await query(
      `UPDATE pricing_formulas
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           commodity_id = $4,
           formula_type = COALESCE($5, formula_type),
           components = COALESCE($6, components),
           output_unit = $7,
           rounding = COALESCE($8, rounding),
           is_active = COALESCE($9, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name ?? null,
        description ?? null,
        commodityId !== undefined ? commodityId : before.commodity_id,
        formulaType ?? null,
        components ? JSON.stringify(components) : null,
        outputUnit !== undefined ? outputUnit : before.output_unit,
        rounding ?? null,
        isActive ?? null,
      ]
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "pricing_formula",
      entityId: id,
      action: "update",
      before: before,
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error("[pricing] PUT Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing formula id" }, { status: 400 });
    }

    const before = await queryOne<Record<string, unknown>>(
      `SELECT * FROM pricing_formulas WHERE id = $1`,
      [id]
    );
    if (!before) {
      return NextResponse.json({ error: "Formula not found" }, { status: 404 });
    }

    await query(
      `UPDATE pricing_formulas SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await auditLog({
      orgId: before.org_id as string,
      module: "kernel",
      entityType: "pricing_formula",
      entityId: id,
      action: "deactivate",
      before: before,
      after: { ...before, is_active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[pricing] DELETE Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
