"use client";

import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { FormulaComponent, ComponentType } from "@/lib/pricingEngine";
import type { RateTable } from "@/types/pricing";

const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: "input", label: "Input" },
  { value: "fixed", label: "Fixed Value" },
  { value: "market_ref", label: "Market Reference" },
  { value: "calculated", label: "Calculated" },
  { value: "percentage", label: "Percentage" },
  { value: "lookup", label: "Lookup" },
  { value: "fx", label: "FX Conversion" },
];

const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
const selectCls = inputCls;

interface Props {
  component: FormulaComponent;
  index: number;
  total: number;
  allComponents: FormulaComponent[];
  rateTables: RateTable[];
  commodities: { id: string; name: string }[];
  onChange: (updated: FormulaComponent) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function ComponentRow({
  component, index, total, allComponents, rateTables, commodities,
  onChange, onMoveUp, onMoveDown, onDelete,
}: Props) {
  function field<K extends keyof FormulaComponent>(key: K, value: FormulaComponent[K]) {
    onChange({ ...component, [key]: value });
  }

  return (
    <div className="bg-input-bg/30 border border-b-input rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-faint font-mono w-5 text-center">{index + 1}</span>

        <input
          type="text"
          placeholder="Component ID"
          className={`${inputCls} max-w-[140px] font-mono text-xs`}
          value={component.id}
          onChange={(e) => field("id", e.target.value.replace(/\s/g, "_"))}
        />

        <input
          type="text"
          placeholder="Label"
          className={`${inputCls} max-w-[160px]`}
          value={component.label}
          onChange={(e) => field("label", e.target.value)}
        />

        <select
          className={`${selectCls} max-w-[150px]`}
          value={component.type}
          onChange={(e) => field("type", e.target.value as ComponentType)}
        >
          {COMPONENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Unit"
          className={`${inputCls} max-w-[100px]`}
          value={component.unit ?? ""}
          onChange={(e) => field("unit", e.target.value || undefined)}
        />

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="p-1 text-ph hover:text-action disabled:opacity-30 transition-colors">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1}
            className="p-1 text-ph hover:text-action disabled:opacity-30 transition-colors">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete}
            className="p-1 text-ph hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Type-specific fields */}
      {component.type === "fixed" && (
        <div className="flex gap-3 pl-7">
          <div className="space-y-1">
            <label className="text-xs text-muted">Fixed Value</label>
            <input type="number" step="any" className={`${inputCls} max-w-[120px]`}
              value={component.fixedValue ?? ""}
              onChange={(e) => field("fixedValue", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>
      )}

      {component.type === "market_ref" && (
        <div className="flex gap-3 pl-7">
          <div className="space-y-1">
            <label className="text-xs text-muted">Commodity</label>
            <select className={`${selectCls} max-w-[160px]`}
              value={component.marketRef?.commodityId ?? ""}
              onChange={(e) => field("marketRef", { commodityId: e.target.value, priceField: component.marketRef?.priceField ?? "settle" })}>
              <option value="">Select...</option>
              {commodities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Price Field</label>
            <select className={`${selectCls} max-w-[140px]`}
              value={component.marketRef?.priceField ?? "settle"}
              onChange={(e) => field("marketRef", { commodityId: component.marketRef?.commodityId ?? "", priceField: e.target.value })}>
              <option value="settle">Settle</option>
              <option value="open">Open</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="close">Close</option>
            </select>
          </div>
        </div>
      )}

      {component.type === "calculated" && (
        <div className="pl-7 space-y-1">
          <label className="text-xs text-muted">Expression</label>
          <input type="text" className={inputCls}
            placeholder="e.g. futures + basis + freight"
            value={component.expression ?? ""}
            onChange={(e) => field("expression", e.target.value)} />
          <p className="text-xs text-faint">
            Available: {allComponents.filter((c) => c.id !== component.id).map((c) => c.id).join(", ") || "none"}
          </p>
        </div>
      )}

      {component.type === "percentage" && (
        <div className="flex gap-3 pl-7">
          <div className="space-y-1">
            <label className="text-xs text-muted">Of Component</label>
            <select className={`${selectCls} max-w-[160px]`}
              value={component.percentOf?.componentId ?? ""}
              onChange={(e) => field("percentOf", { componentId: e.target.value, percent: component.percentOf?.percent ?? 0 })}>
              <option value="">Select...</option>
              {allComponents.filter((c) => c.id !== component.id).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Percent</label>
            <input type="number" step="any" className={`${inputCls} max-w-[100px]`}
              value={component.percentOf?.percent ?? ""}
              onChange={(e) => field("percentOf", { componentId: component.percentOf?.componentId ?? "", percent: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {component.type === "lookup" && (
        <div className="flex gap-3 pl-7">
          <div className="space-y-1">
            <label className="text-xs text-muted">Rate Table</label>
            <select className={`${selectCls} max-w-[200px]`}
              value={component.lookupRef?.rateTableId ?? ""}
              onChange={(e) => field("lookupRef", { rateTableId: e.target.value, key: component.lookupRef?.key ?? "" })}>
              <option value="">Select...</option>
              {rateTables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Lookup Key</label>
            <input type="text" className={`${inputCls} max-w-[140px]`}
              placeholder="e.g. zone_a"
              value={component.lookupRef?.key ?? ""}
              onChange={(e) => field("lookupRef", { rateTableId: component.lookupRef?.rateTableId ?? "", key: e.target.value })} />
          </div>
        </div>
      )}

      {component.type === "fx" && (
        <div className="flex gap-3 pl-7">
          <div className="space-y-1">
            <label className="text-xs text-muted">From Currency</label>
            <input type="text" maxLength={3} className={`${inputCls} max-w-[80px] uppercase`}
              value={component.fxRef?.fromCurrency ?? ""}
              onChange={(e) => field("fxRef", { fromCurrency: e.target.value.toUpperCase(), toCurrency: component.fxRef?.toCurrency ?? "USD" })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">To Currency</label>
            <input type="text" maxLength={3} className={`${inputCls} max-w-[80px] uppercase`}
              value={component.fxRef?.toCurrency ?? ""}
              onChange={(e) => field("fxRef", { fromCurrency: component.fxRef?.fromCurrency ?? "CAD", toCurrency: e.target.value.toUpperCase() })} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pl-7">
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input type="checkbox" checked={component.isOutput ?? false}
            onChange={(e) => field("isOutput", e.target.checked || undefined)}
            className="rounded border-b-input bg-input-bg text-action focus:ring-focus" />
          Output (total) component
        </label>
      </div>
    </div>
  );
}
