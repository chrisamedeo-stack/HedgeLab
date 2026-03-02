import { queryOne, queryAll, query } from "./db";
import { auditLog } from "./audit";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComponentType =
  | "market_ref"   // Reference a market price (e.g., futures settle)
  | "input"        // User-entered value (e.g., basis, freight)
  | "calculated"   // Derived from other components via expression
  | "fixed"        // Static number
  | "fx"           // FX conversion component
  | "percentage"   // Percentage of another component
  | "lookup";      // Lookup from a rate table

export interface FormulaComponent {
  id: string;
  label: string;
  type: ComponentType;
  /** For market_ref: commodity_id + contract_month field name */
  marketRef?: { commodityId: string; priceField: string };
  /** For calculated: expression referencing other component IDs, e.g. "futures + basis + freight" */
  expression?: string;
  /** For fixed: the value */
  fixedValue?: number;
  /** For percentage: reference component ID and percentage */
  percentOf?: { componentId: string; percent: number };
  /** For lookup: rate table ID and lookup key */
  lookupRef?: { rateTableId: string; key: string };
  /** For fx: source currency, target currency */
  fxRef?: { fromCurrency: string; toCurrency: string };
  /** Is this the output (total) component? */
  isOutput?: boolean;
  /** Unit label for display */
  unit?: string;
  /** Sort order */
  sortOrder?: number;
}

export interface PricingFormula {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  commodityId?: string;
  formulaType: string;
  components: FormulaComponent[];
  outputUnit?: string;
  rounding: number;
}

export interface EvaluationContext {
  /** Component values provided by caller (keyed by component ID) */
  inputs: Record<string, number>;
  /** Market prices if available (keyed by commodity_id:contract_month) */
  marketPrices?: Record<string, number>;
  /** FX rates if needed */
  fxRates?: Record<string, number>;
  /** Rate table lookups */
  rateTables?: Record<string, Record<string, number>>;
}

export interface EvaluationResult {
  componentValues: Record<string, number>;
  totalPrice: number;
  currency: string;
  errors: string[];
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/** Evaluate a pricing formula with the given context */
export function evaluateFormula(
  formula: PricingFormula,
  context: EvaluationContext
): EvaluationResult {
  const values: Record<string, number> = {};
  const errors: string[] = [];
  const rounding = formula.rounding ?? 4;

  // Sort components by sortOrder so dependencies resolve in order
  const sorted = [...formula.components].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  for (const comp of sorted) {
    try {
      switch (comp.type) {
        case "input": {
          const val = context.inputs[comp.id];
          if (val === undefined) {
            errors.push(`Missing input for ${comp.label} (${comp.id})`);
            values[comp.id] = 0;
          } else {
            values[comp.id] = val;
          }
          break;
        }

        case "fixed": {
          values[comp.id] = comp.fixedValue ?? 0;
          break;
        }

        case "market_ref": {
          if (comp.marketRef && context.marketPrices) {
            const key = `${comp.marketRef.commodityId}:${comp.marketRef.priceField}`;
            const price = context.marketPrices[key];
            if (price !== undefined) {
              values[comp.id] = price;
            } else {
              errors.push(`Market price not found: ${key}`);
              values[comp.id] = 0;
            }
          } else {
            // Fall back to input
            values[comp.id] = context.inputs[comp.id] ?? 0;
          }
          break;
        }

        case "percentage": {
          if (comp.percentOf) {
            const base = values[comp.percentOf.componentId] ?? 0;
            values[comp.id] = base * (comp.percentOf.percent / 100);
          } else {
            values[comp.id] = 0;
          }
          break;
        }

        case "lookup": {
          if (comp.lookupRef && context.rateTables) {
            const table = context.rateTables[comp.lookupRef.rateTableId];
            values[comp.id] = table?.[comp.lookupRef.key] ?? 0;
            if (!table) errors.push(`Rate table not found: ${comp.lookupRef.rateTableId}`);
          } else {
            values[comp.id] = context.inputs[comp.id] ?? 0;
          }
          break;
        }

        case "fx": {
          if (comp.fxRef && context.fxRates) {
            const key = `${comp.fxRef.fromCurrency}:${comp.fxRef.toCurrency}`;
            values[comp.id] = context.fxRates[key] ?? 1;
          } else {
            values[comp.id] = 1;
          }
          break;
        }

        case "calculated": {
          if (comp.expression) {
            values[comp.id] = evaluateExpression(comp.expression, values);
          } else {
            values[comp.id] = 0;
          }
          break;
        }
      }
    } catch (err) {
      errors.push(`Error evaluating ${comp.label}: ${(err as Error).message}`);
      values[comp.id] = 0;
    }
  }

  // Find output component or sum all non-output components
  const outputComp = sorted.find((c) => c.isOutput);
  let totalPrice: number;
  if (outputComp) {
    totalPrice = values[outputComp.id] ?? 0;
  } else {
    // Default: sum all non-fx, non-percentage intermediate values
    totalPrice = Object.values(values).reduce((sum, v) => sum + v, 0);
  }

  totalPrice = round(totalPrice, rounding);

  // Round all component values
  for (const key of Object.keys(values)) {
    values[key] = round(values[key], rounding);
  }

  return {
    componentValues: values,
    totalPrice,
    currency: "USD",
    errors,
  };
}

/** Simple expression evaluator: supports +, -, *, / with component ID references */
function evaluateExpression(
  expr: string,
  values: Record<string, number>
): number {
  // Replace component IDs with their values
  let resolved = expr;
  for (const [id, val] of Object.entries(values)) {
    resolved = resolved.replaceAll(id, val.toString());
  }
  // Sanitize: only allow numbers, operators, parens, spaces, dots
  if (!/^[\d\s+\-*/().]+$/.test(resolved)) {
    throw new Error(`Invalid expression after resolution: ${resolved}`);
  }
  // eslint-disable-next-line no-eval
  return Number(new Function(`return (${resolved})`)());
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Database Operations ─────────────────────────────────────────────────────

/** Load a pricing formula from the database */
export async function loadFormula(formulaId: string): Promise<PricingFormula | null> {
  const row = await queryOne<{
    id: string; org_id: string; name: string; description: string;
    commodity_id: string; formula_type: string; components: FormulaComponent[];
    output_unit: string; rounding: number;
  }>(
    `SELECT * FROM pricing_formulas WHERE id = $1 AND is_active = true`,
    [formulaId]
  );
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    description: row.description,
    commodityId: row.commodity_id,
    formulaType: row.formula_type,
    components: row.components,
    outputUnit: row.output_unit,
    rounding: row.rounding,
  };
}

/** Load rate table rates for evaluation context */
export async function loadRateTable(
  rateTableId: string
): Promise<Record<string, number> | null> {
  const row = await queryOne<{ rates: Record<string, number> }>(
    `SELECT rates FROM pricing_rate_tables
     WHERE id = $1 AND is_active = true
       AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
       AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)`,
    [rateTableId]
  );
  return row?.rates ?? null;
}

/** Save a pricing result to pricing_applied */
export async function savePricingResult(params: {
  formulaId: string;
  entityType: string;
  entityId: string;
  componentValues: Record<string, number>;
  totalPrice: number;
  currency?: string;
  appliedBy?: string;
  notes?: string;
}): Promise<void> {
  const result = await query(
    `INSERT INTO pricing_applied
       (formula_id, entity_type, entity_id, component_values, total_price, currency, applied_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.formulaId,
      params.entityType,
      params.entityId,
      JSON.stringify(params.componentValues),
      params.totalPrice,
      params.currency ?? "USD",
      params.appliedBy ?? null,
      params.notes ?? null,
    ]
  );

  await auditLog({
    module: "kernel",
    entityType: "pricing_applied",
    entityId: result.rows[0].id,
    action: "create",
    after: result.rows[0] as Record<string, unknown>,
  });
}

/** List all formulas for an org, optionally filtered by commodity */
export async function listFormulas(
  orgId: string,
  commodityId?: string
): Promise<PricingFormula[]> {
  let sql = `SELECT * FROM pricing_formulas WHERE org_id = $1 AND is_active = true`;
  const params: unknown[] = [orgId];

  if (commodityId) {
    params.push(commodityId);
    sql += ` AND (commodity_id = $${params.length} OR commodity_id IS NULL)`;
  }

  sql += ` ORDER BY is_system DESC, name`;
  const rows = await queryAll(sql, params);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    orgId: r.org_id as string,
    name: r.name as string,
    description: r.description as string | undefined,
    commodityId: r.commodity_id as string | undefined,
    formulaType: r.formula_type as string,
    components: r.components as FormulaComponent[],
    outputUnit: r.output_unit as string | undefined,
    rounding: r.rounding as number,
  }));
}
