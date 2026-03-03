"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { FormulaRow } from "@/types/pricing";
import type { EvaluationResult } from "@/lib/pricingEngine";
import { usePricingStore } from "@/store/pricingStore";

const inputCls = "w-full bg-input-bg border border-b-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-ph";
const selectCls = inputCls;
const btnPrimary = "inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-white hover:bg-action-hover transition-colors disabled:opacity-50";

interface Props {
  formulas: FormulaRow[];
}

export function FormulaEvaluator({ formulas }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [fxOverrides, setFxOverrides] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evaluate = usePricingStore((s) => s.evaluateFormula);

  const selected = formulas.find((f) => f.id === selectedId);

  function handleFormulaChange(id: string) {
    setSelectedId(id);
    setInputs({});
    setFxOverrides({});
    setResult(null);
    setError(null);
  }

  async function handleEvaluate() {
    if (!selectedId) return;
    setEvaluating(true);
    setError(null);
    try {
      const numericInputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(inputs)) {
        if (v !== "") numericInputs[k] = Number(v);
      }

      const fxRates: Record<string, number> = {};
      for (const [k, v] of Object.entries(fxOverrides)) {
        if (v !== "") fxRates[k] = Number(v);
      }

      const res = await evaluate(selectedId, {
        inputs: numericInputs,
        fxRates: Object.keys(fxRates).length > 0 ? fxRates : undefined,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEvaluating(false);
    }
  }

  // Components that need user input
  const inputComponents = selected?.components.filter(
    (c) => c.type === "input" || c.type === "market_ref"
  ) ?? [];
  const fxComponents = selected?.components.filter((c) => c.type === "fx") ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs text-muted">Select Formula</label>
        <select className={selectCls} value={selectedId} onChange={(e) => handleFormulaChange(e.target.value)}>
          <option value="">Choose a formula...</option>
          {formulas.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          {inputComponents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted uppercase tracking-wider">Inputs</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {inputComponents.map((comp) => (
                  <div key={comp.id} className="space-y-1">
                    <label className="text-xs text-muted">{comp.label}</label>
                    <input type="number" step="any" className={inputCls}
                      placeholder={comp.unit ?? "0"}
                      value={inputs[comp.id] ?? ""}
                      onChange={(e) => setInputs((p) => ({ ...p, [comp.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {fxComponents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted uppercase tracking-wider">FX Rate Overrides</h4>
              <div className="grid grid-cols-2 gap-3">
                {fxComponents.map((comp) => {
                  const key = `${comp.fxRef?.fromCurrency ?? "?"}:${comp.fxRef?.toCurrency ?? "?"}`;
                  return (
                    <div key={comp.id} className="space-y-1">
                      <label className="text-xs text-muted">{comp.label} ({key})</label>
                      <input type="number" step="any" className={inputCls}
                        placeholder="1.0"
                        value={fxOverrides[key] ?? ""}
                        onChange={(e) => setFxOverrides((p) => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={handleEvaluate} disabled={evaluating} className={btnPrimary}>
            <Play className="h-4 w-4" />
            {evaluating ? "Evaluating..." : "Evaluate"}
          </button>

          {error && (
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>
          )}

          {result && (
            <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-input-bg/50 border-b border-b-default">
                <h4 className="text-xs font-medium text-muted uppercase tracking-wider">Results</h4>
              </div>
              <div className="divide-y divide-b-default">
                {selected.components
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((comp) => {
                    const value = result.componentValues[comp.id];
                    const isOutput = comp.isOutput;
                    const isInput = comp.type === "input" || comp.type === "market_ref";
                    return (
                      <div key={comp.id} className={`flex items-center justify-between px-4 py-2.5 ${isOutput ? "bg-profit-20/30" : ""}`}>
                        <span className={`text-sm ${isOutput ? "font-semibold text-profit" : isInput ? "text-secondary" : "text-action"}`}>
                          {comp.label}
                        </span>
                        <span className={`text-sm font-mono ${isOutput ? "font-semibold text-profit" : "text-primary"}`}>
                          {value !== undefined ? value.toFixed(selected.rounding) : "—"}
                          {comp.unit && <span className="text-faint ml-1">{comp.unit}</span>}
                        </span>
                      </div>
                    );
                  })}
                <div className="flex items-center justify-between px-4 py-3 bg-profit-20/30">
                  <span className="text-sm font-semibold text-profit">Total</span>
                  <span className="text-base font-bold font-mono text-profit">
                    {result.totalPrice.toFixed(selected.rounding)}
                    {selected.output_unit && <span className="text-profit/70 text-xs ml-1">{selected.output_unit}</span>}
                  </span>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="px-4 py-2.5 border-t border-b-default">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-warning">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!selected && (
        <div className="text-center py-8 text-sm text-faint">Select a formula to test</div>
      )}
    </div>
  );
}
