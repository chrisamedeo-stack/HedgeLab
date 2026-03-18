"use client";

import { useState, useEffect } from "react";
import { Plus, Play } from "lucide-react";
import type { FormulaRow } from "@/types/pricing";
import type { RateTable } from "@/types/pricing";
import type { FormulaComponent, EvaluationResult } from "@/lib/pricingEngine";
import { ComponentRow } from "./ComponentRow";
import { usePricingStore } from "@/store/pricingStore";

import { btnPrimary, btnSecondary } from "@/lib/ui-classes";

const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
const selectCls = inputCls;

interface Props {
  initial?: FormulaRow | null;
  rateTables: RateTable[];
  commodities: { id: string; name: string }[];
  saving: boolean;
  onSave: (data: {
    name: string; description: string; commodityId: string | null;
    formulaType: string; components: FormulaComponent[];
    outputUnit: string | null; rounding: number;
  }) => void;
  onCancel: () => void;
}

export function FormulaBuilder({ initial, rateTables, commodities, saving, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [commodityId, setCommodityId] = useState(initial?.commodity_id ?? "");
  const [formulaType, setFormulaType] = useState(initial?.formula_type ?? "all_in");
  const [outputUnit, setOutputUnit] = useState(initial?.output_unit ?? "");
  const [rounding, setRounding] = useState(initial?.rounding ?? 4);
  const [components, setComponents] = useState<FormulaComponent[]>(
    initial?.components ?? []
  );

  // Live preview
  const [previewInputs, setPreviewInputs] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<EvaluationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const evaluateFormula = usePricingStore((s) => s.evaluateFormula);

  // Reset form when initial changes
  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDescription(initial.description ?? "");
      setCommodityId(initial.commodity_id ?? "");
      setFormulaType(initial.formula_type);
      setOutputUnit(initial.output_unit ?? "");
      setRounding(initial.rounding);
      setComponents(initial.components);
    }
  }, [initial]);

  function addComponent() {
    const idx = components.length + 1;
    setComponents([...components, {
      id: `comp_${idx}`,
      label: `Component ${idx}`,
      type: "input",
      sortOrder: idx,
    }]);
  }

  function updateComponent(idx: number, updated: FormulaComponent) {
    setComponents((c) => c.map((comp, i) => i === idx ? updated : comp));
  }

  function moveComponent(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= components.length) return;
    setComponents((c) => {
      const next = [...c];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((comp, i) => ({ ...comp, sortOrder: i + 1 }));
    });
  }

  function deleteComponent(idx: number) {
    setComponents((c) => c.filter((_, i) => i !== idx).map((comp, i) => ({ ...comp, sortOrder: i + 1 })));
  }

  async function handlePreview() {
    if (!initial?.id) return;
    const numericInputs: Record<string, number> = {};
    for (const [k, v] of Object.entries(previewInputs)) {
      if (v !== "") numericInputs[k] = Number(v);
    }
    try {
      const res = await evaluateFormula(initial.id, { inputs: numericInputs });
      setPreviewResult(res);
    } catch {
      // Ignore preview errors
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      name,
      description,
      commodityId: commodityId || null,
      formulaType,
      components,
      outputUnit: outputUnit || null,
      rounding,
    });
  }

  const inputComps = components.filter((c) => c.type === "input" || c.type === "market_ref");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="text-xs text-muted">Name</label>
          <input type="text" required className={inputCls} placeholder="Formula name"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Formula Type</label>
          <select className={selectCls} value={formulaType} onChange={(e) => setFormulaType(e.target.value)}>
            <option value="all_in">All-In</option>
            <option value="delivered">Delivered</option>
            <option value="basis">Basis</option>
            <option value="fixed">Fixed</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Commodity</label>
          <select className={selectCls} value={commodityId} onChange={(e) => setCommodityId(e.target.value)}>
            <option value="">All commodities</option>
            {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-1 col-span-2 sm:col-span-1">
          <label className="text-xs text-muted">Description</label>
          <input type="text" className={inputCls} placeholder="Optional description"
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Output Unit</label>
          <input type="text" className={inputCls} placeholder="e.g. USD/bu"
            value={outputUnit} onChange={(e) => setOutputUnit(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Rounding (decimals)</label>
          <input type="number" min={0} max={10} className={inputCls}
            value={rounding} onChange={(e) => setRounding(Number(e.target.value))} />
        </div>
      </div>

      {/* Components */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-muted uppercase tracking-wider">
            Components ({components.length})
          </h4>
          <button type="button" onClick={addComponent}
            className="text-xs text-action hover:text-action-hover flex items-center gap-1">
            <Plus className="h-3 w-3" /> Add Component
          </button>
        </div>

        {components.length === 0 && (
          <p className="text-xs text-faint py-4 text-center">
            No components. Click &quot;Add Component&quot; to build your formula.
          </p>
        )}

        <div className="space-y-2">
          {components.map((comp, idx) => (
            <ComponentRow
              key={`${comp.id}-${idx}`}
              component={comp}
              index={idx}
              total={components.length}
              allComponents={components}
              rateTables={rateTables}
              commodities={commodities}
              onChange={(updated) => updateComponent(idx, updated)}
              onMoveUp={() => moveComponent(idx, -1)}
              onMoveDown={() => moveComponent(idx, 1)}
              onDelete={() => deleteComponent(idx)}
            />
          ))}
        </div>
      </div>

      {/* Live preview (only for existing formulas) */}
      {initial?.id && (
        <div className="border border-b-default rounded-lg overflow-hidden">
          <button type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider hover:bg-row-hover transition-colors">
            <span>Live Preview</span>
            <span className="text-faint">{showPreview ? "Hide" : "Show"}</span>
          </button>
          {showPreview && (
            <div className="px-4 py-3 border-t border-b-default space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {inputComps.map((comp) => (
                  <div key={comp.id} className="space-y-1">
                    <label className="text-xs text-faint">{comp.label}</label>
                    <input type="number" step="any" className={`${inputCls} text-xs`}
                      value={previewInputs[comp.id] ?? ""}
                      onChange={(e) => setPreviewInputs((p) => ({ ...p, [comp.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={handlePreview}
                className="text-xs text-action hover:text-action-hover flex items-center gap-1">
                <Play className="h-3 w-3" /> Run Preview
              </button>
              {previewResult && (
                <div className="text-xs font-mono text-profit bg-profit-20/20 rounded px-3 py-2">
                  Total: {previewResult.totalPrice.toFixed(rounding)} {outputUnit}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" disabled={saving || !name || components.length === 0} className={btnPrimary}>
          {saving ? "Saving..." : initial ? "Update Formula" : "Create Formula"}
        </button>
      </div>
    </form>
  );
}
