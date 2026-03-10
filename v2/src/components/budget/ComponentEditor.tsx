"use client";

import type { BudgetComponent } from "@/types/budget";
import type { Commodity } from "@/hooks/usePositions";
import { getPriceUnits, getDefaultPriceUnit, toPerPriceUnit } from "@/lib/commodity-units";

interface ComponentEditorProps {
  components: BudgetComponent[];
  onChange: (components: BudgetComponent[]) => void;
  commodity?: Commodity | null;
  /** @deprecated Use commodity prop instead */
  bushelsPerMt?: number;
}

const PRESETS = [
  "Board Price",
  "Basis",
  "Freight",
  "Elevation",
  "Insurance",
  "FX Premium",
  "Quality Premium",
];

export function ComponentEditor({ components, onChange, commodity, bushelsPerMt }: ComponentEditorProps) {
  // Derive units from commodity; fall back to legacy behavior
  const UNITS = commodity ? getPriceUnits(commodity) : ["$/bu", "$/MT", "%"];
  const defaultUnit = commodity ? getDefaultPriceUnit(commodity) : "$/bu";
  const nativeUnit = commodity?.price_unit || "$/bu";

  // Build a compat commodity object if only bushelsPerMt was passed (legacy callers)
  const effectiveCommodity: Commodity | null = commodity ?? (bushelsPerMt
    ? { id: "", name: "", category: "", unit: "", currency: "", exchange: "", config: { units_per_mt: bushelsPerMt } }
    : null);

  const usedNames = new Set(components.map((c) => c.component_name));

  const addPreset = (name: string) => {
    onChange([
      ...components,
      { component_name: name, unit: defaultUnit, target_value: 0, display_order: components.length },
    ]);
  };

  const addCustom = () => {
    onChange([
      ...components,
      { component_name: "", unit: defaultUnit, target_value: 0, display_order: components.length },
    ]);
  };

  const updateComponent = (idx: number, field: keyof BudgetComponent, value: string | number) => {
    const next = [...components];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const removeComponent = (idx: number) => {
    onChange(components.filter((_, i) => i !== idx));
  };

  // Compute all-in total in native price unit
  let baseTotal = 0;
  let pctMultiplier = 1;
  for (const c of components) {
    if (c.unit === "%") {
      pctMultiplier *= 1 + Number(c.target_value || 0) / 100;
    } else {
      baseTotal += toPerPriceUnit(Number(c.target_value), c.unit, effectiveCommodity);
    }
  }
  const allInTotal = baseTotal * pctMultiplier;

  const inputCls =
    "border border-b-input bg-input-bg rounded px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus";

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.filter((p) => !usedNames.has(p)).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addPreset(preset)}
            className="px-2 py-0.5 text-xs text-muted border border-b-input rounded hover:bg-hover hover:text-secondary transition-colors"
          >
            + {preset}
          </button>
        ))}
      </div>

      {/* Component table */}
      {components.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="text-left py-1 font-medium">Name</th>
              <th className="text-left py-1 font-medium w-20">Unit</th>
              <th className="text-right py-1 font-medium w-24">Value</th>
              <th className="text-right py-1 font-medium w-20">&asymp; {nativeUnit}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {components.map((c, i) => {
              const perNative = toPerPriceUnit(Number(c.target_value), c.unit, effectiveCommodity);
              return (
                <tr key={i} className="border-t border-tbl-border">
                  <td className="py-1 pr-2">
                    <input
                      type="text"
                      value={c.component_name}
                      onChange={(e) => updateComponent(i, "component_name", e.target.value)}
                      className={`${inputCls} w-full`}
                      placeholder="Component name"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <select
                      value={c.unit}
                      onChange={(e) => updateComponent(i, "unit", e.target.value)}
                      className={`${inputCls} w-full`}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      type="number"
                      step="0.0001"
                      value={c.target_value || ""}
                      onChange={(e) => updateComponent(i, "target_value", Number(e.target.value))}
                      className={`${inputCls} w-full text-right`}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1 text-right tabular-nums text-faint">
                    {c.unit === "%" ? `${Number(c.target_value).toFixed(1)}%` : perNative.toFixed(4)}
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeComponent(i)}
                      className="text-muted hover:text-loss transition-colors text-xs"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-b-default">
              <td colSpan={3} className="py-1.5 text-xs font-medium text-muted">
                All-in Total
              </td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-profit">
                {allInTotal.toFixed(4)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}

      {/* Add custom */}
      <button
        type="button"
        onClick={addCustom}
        className="text-xs text-muted hover:text-secondary transition-colors"
      >
        + Add Custom Component
      </button>
    </div>
  );
}
