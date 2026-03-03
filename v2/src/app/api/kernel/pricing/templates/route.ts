import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { FormulaComponent } from "@/lib/pricingEngine";

interface FormulaTemplate {
  id: string;
  name: string;
  description: string;
  formulaType: string;
  components: FormulaComponent[];
  outputUnit: string;
}

const TEMPLATES: FormulaTemplate[] = [
  {
    id: "grain-allin-fob",
    name: "Grain All-In FOB",
    description: "Complete grain pricing: futures + basis + freight + elevation + fees",
    formulaType: "all_in",
    outputUnit: "USD/bu",
    components: [
      { id: "futures", label: "Futures", type: "market_ref", sortOrder: 1, unit: "USD/bu" },
      { id: "basis", label: "Basis", type: "input", sortOrder: 2, unit: "USD/bu" },
      { id: "freight", label: "Freight", type: "input", sortOrder: 3, unit: "USD/bu" },
      { id: "elevation", label: "Elevation", type: "input", sortOrder: 4, unit: "USD/bu" },
      { id: "fees", label: "Fees & Charges", type: "input", sortOrder: 5, unit: "USD/bu" },
      {
        id: "total", label: "Total FOB", type: "calculated",
        expression: "futures + basis + freight + elevation + fees",
        isOutput: true, sortOrder: 6, unit: "USD/bu",
      },
    ],
  },
  {
    id: "grain-delivered",
    name: "Grain Delivered",
    description: "Delivered grain pricing: FOB base + inland freight + insurance",
    formulaType: "delivered",
    outputUnit: "USD/bu",
    components: [
      { id: "futures", label: "Futures", type: "market_ref", sortOrder: 1, unit: "USD/bu" },
      { id: "basis", label: "Basis", type: "input", sortOrder: 2, unit: "USD/bu" },
      { id: "inland_freight", label: "Inland Freight", type: "input", sortOrder: 3, unit: "USD/bu" },
      { id: "insurance", label: "Insurance", type: "input", sortOrder: 4, unit: "USD/bu" },
      { id: "handling", label: "Handling", type: "input", sortOrder: 5, unit: "USD/bu" },
      {
        id: "total", label: "Total Delivered", type: "calculated",
        expression: "futures + basis + inland_freight + insurance + handling",
        isOutput: true, sortOrder: 6, unit: "USD/bu",
      },
    ],
  },
  {
    id: "basis-contract",
    name: "Basis Contract",
    description: "Basis-only pricing: basis level relative to a futures reference",
    formulaType: "basis",
    outputUnit: "USD/bu",
    components: [
      { id: "futures_ref", label: "Futures Reference", type: "market_ref", sortOrder: 1, unit: "USD/bu" },
      { id: "basis_level", label: "Basis Level", type: "input", sortOrder: 2, unit: "USD/bu" },
      {
        id: "flat_price", label: "Flat Price", type: "calculated",
        expression: "futures_ref + basis_level",
        isOutput: true, sortOrder: 3, unit: "USD/bu",
      },
    ],
  },
  {
    id: "energy-fixed",
    name: "Energy Fixed",
    description: "Fixed energy pricing: base price + transport + taxes + carbon",
    formulaType: "fixed",
    outputUnit: "USD/MMBTU",
    components: [
      { id: "base_price", label: "Base Price", type: "fixed", fixedValue: 0, sortOrder: 1, unit: "USD/MMBTU" },
      { id: "transport", label: "Transport", type: "input", sortOrder: 2, unit: "USD/MMBTU" },
      { id: "taxes", label: "Taxes & Levies", type: "input", sortOrder: 3, unit: "USD/MMBTU" },
      { id: "carbon", label: "Carbon Charge", type: "input", sortOrder: 4, unit: "USD/MMBTU" },
      {
        id: "total", label: "Total Fixed Price", type: "calculated",
        expression: "base_price + transport + taxes + carbon",
        isOutput: true, sortOrder: 5, unit: "USD/MMBTU",
      },
    ],
  },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { templateId, orgId, commodityId } = body;

    if (!templateId || !orgId) {
      return NextResponse.json(
        { error: "Missing required fields: templateId, orgId" },
        { status: 400 }
      );
    }

    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const result = await query(
      `INSERT INTO pricing_formulas
         (org_id, name, description, commodity_id, formula_type, components,
          output_unit, rounding, is_system, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, null)
       RETURNING *`,
      [
        orgId,
        template.name,
        template.description,
        commodityId ?? null,
        template.formulaType,
        JSON.stringify(template.components),
        template.outputUnit,
        4,
      ]
    );

    await auditLog({
      orgId,
      module: "kernel",
      entityType: "pricing_formula",
      entityId: result.rows[0].id,
      action: "create_from_template",
      after: result.rows[0] as Record<string, unknown>,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error("[pricing/templates] Error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
