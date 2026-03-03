export type {
  ComponentType,
  FormulaComponent,
  PricingFormula,
  EvaluationContext,
  EvaluationResult,
} from "@/lib/pricingEngine";

export interface RateTable {
  id: string;
  org_id: string;
  name: string;
  rate_type: string;
  commodity_id: string | null;
  rates: Record<string, number>;
  effective_date: string | null;
  expiry_date: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FormulaTemplate {
  id: string;
  name: string;
  description: string;
  formulaType: string;
  components: import("@/lib/pricingEngine").FormulaComponent[];
  outputUnit: string;
}

export interface FormulaRow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  commodity_id: string | null;
  formula_type: string;
  components: import("@/lib/pricingEngine").FormulaComponent[];
  output_unit: string | null;
  rounding: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}
