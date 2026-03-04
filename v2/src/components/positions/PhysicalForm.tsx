"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { useOrgContext } from "@/contexts/OrgContext";
import { usePositionStore } from "@/store/positionStore";
import { usePricingStore } from "@/store/pricingStore";
import type { PhysicalDirection, PricingType } from "@/types/positions";
import type { FormulaRow } from "@/types/pricing";
import type { FormulaComponent, EvaluationResult } from "@/lib/pricingEngine";

const USER_ID = "00000000-0000-0000-0000-000000000099";
const inputCls = "w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none";

interface PhysicalFormProps {
  orgId: string;
  siteId: string;
  commodities: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PhysicalForm({ orgId, siteId, commodities, onClose, onSuccess }: PhysicalFormProps) {
  const { createPhysical } = usePositionStore();
  const { isPluginEnabled } = useOrgContext();
  const { formulas, fetchFormulas, evaluateFormula } = usePricingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    commodityId: "",
    direction: "buy" as PhysicalDirection,
    volume: "",
    price: "",
    pricingType: "fixed" as PricingType,
    basisPrice: "",
    basisMonth: "",
    deliveryMonth: "",
    counterparty: "",
    formulaId: "",
  });

  const [formulaInputs, setFormulaInputs] = useState<Record<string, string>>({});
  const [formulaResult, setFormulaResult] = useState<EvaluationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const formulaEnabled = isPluginEnabled("formula_pricing");

  // Fetch formulas when commodity changes and formula pricing is enabled
  useEffect(() => {
    if (formulaEnabled && form.commodityId) {
      fetchFormulas(orgId, form.commodityId);
    }
  }, [formulaEnabled, form.commodityId, orgId, fetchFormulas]);

  const selectedFormula = formulas.find((f) => f.id === form.formulaId);

  // Get input and market_ref components from the selected formula
  const editableComponents = selectedFormula?.components
    .filter((c: FormulaComponent) => c.type === "input" || c.type === "market_ref")
    .sort((a: FormulaComponent, b: FormulaComponent) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) ?? [];

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "pricingType" && value !== "formula") {
      setFormulaResult(null);
      setFormulaInputs({});
    }
    if (key === "formulaId") {
      setFormulaResult(null);
      setFormulaInputs({});
    }
  };

  const setInput = (key: string, value: string) => {
    setFormulaInputs((prev) => ({ ...prev, [key]: value }));
    setFormulaResult(null); // Clear result when inputs change
  };

  const handleCalculate = async () => {
    if (!form.formulaId) return;
    setCalculating(true);
    setError(null);
    try {
      const inputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(formulaInputs)) {
        inputs[k] = Number(v) || 0;
      }
      const result = await evaluateFormula(form.formulaId, { inputs });
      setFormulaResult(result);
      // Populate price field with total
      if (result.totalPrice !== undefined) {
        setForm((f) => ({ ...f, price: String(result.totalPrice) }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const numInputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(formulaInputs)) {
        numInputs[k] = Number(v) || 0;
      }

      await createPhysical({
        orgId,
        userId: USER_ID,
        siteId,
        commodityId: form.commodityId,
        direction: form.direction as PhysicalDirection,
        volume: Number(form.volume),
        price: form.price ? Number(form.price) : undefined,
        pricingType: form.pricingType as PricingType,
        basisPrice: form.basisPrice ? Number(form.basisPrice) : undefined,
        basisMonth: form.basisMonth || undefined,
        deliveryMonth: form.deliveryMonth || undefined,
        counterparty: form.counterparty || undefined,
        currency: "USD",
        formulaId: form.pricingType === "formula" && form.formulaId ? form.formulaId : undefined,
        formulaInputs: form.pricingType === "formula" && Object.keys(numInputs).length > 0 ? numInputs : undefined,
        formulaResult: form.pricingType === "formula" && formulaResult ? (formulaResult as unknown as Record<string, unknown>) : undefined,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New Physical Position">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Commodity *</span>
            <select required value={form.commodityId} onChange={(e) => set("commodityId", e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Direction *</span>
            <select value={form.direction} onChange={(e) => set("direction", e.target.value)} className={inputCls}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Volume *</span>
            <input type="number" required step="any" value={form.volume} onChange={(e) => set("volume", e.target.value)} className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Price</span>
            <input
              type="number"
              step="any"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              readOnly={form.pricingType === "formula" && !!formulaResult}
              className={`${inputCls} ${form.pricingType === "formula" && formulaResult ? "bg-surface text-profit font-medium" : ""}`}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Pricing Type</span>
            <select value={form.pricingType} onChange={(e) => set("pricingType", e.target.value)} className={inputCls}>
              <option value="fixed">Fixed</option>
              <option value="basis">Basis</option>
              {formulaEnabled && <option value="formula">Formula</option>}
            </select>
          </label>
        </div>

        {/* Formula selector and inputs */}
        {form.pricingType === "formula" && formulaEnabled && (
          <div className="space-y-3 rounded-lg border border-action-30 bg-action-5 p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-action">Formula</span>
              <select value={form.formulaId} onChange={(e) => set("formulaId", e.target.value)} className={inputCls}>
                <option value="">Select formula...</option>
                {formulas.filter((f) => !form.commodityId || f.commodity_id === form.commodityId || !f.commodity_id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
              </select>
            </label>

            {selectedFormula && editableComponents.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {editableComponents.map((comp: FormulaComponent) => (
                  <label key={comp.id} className="block">
                    <span className="mb-1 block text-xs text-muted">
                      {comp.label} {comp.unit ? `(${comp.unit})` : ""}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={formulaInputs[comp.id] ?? ""}
                      onChange={(e) => setInput(comp.id, e.target.value)}
                      className={inputCls}
                      placeholder={comp.type === "market_ref" ? "Market price" : "Enter value"}
                    />
                  </label>
                ))}
              </div>
            )}

            {selectedFormula && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCalculate}
                  disabled={calculating}
                  className="rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
                >
                  {calculating ? "Calculating..." : "Calculate Price"}
                </button>
                {formulaResult && (
                  <span className="text-sm font-medium text-profit">
                    = {formulaResult.totalPrice?.toFixed(selectedFormula.rounding ?? 4)} {selectedFormula.output_unit ?? ""}
                  </span>
                )}
              </div>
            )}

            {/* Component breakdown */}
            {formulaResult && formulaResult.componentValues && (
              <div className="mt-2 space-y-1 text-xs">
                {Object.entries(formulaResult.componentValues).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-muted">
                    <span>{key}</span>
                    <span className="font-mono text-secondary">{typeof val === "number" ? val.toFixed(4) : String(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Basis fields (shown when pricing type is basis) */}
        {form.pricingType === "basis" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Basis Price</span>
              <input type="number" step="any" value={form.basisPrice} onChange={(e) => set("basisPrice", e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Basis Month</span>
              <input type="month" value={form.basisMonth} onChange={(e) => set("basisMonth", e.target.value)} className={inputCls} />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Delivery Month</span>
            <input type="month" value={form.deliveryMonth} onChange={(e) => set("deliveryMonth", e.target.value)} className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Counterparty</span>
            <input type="text" value={form.counterparty} onChange={(e) => set("counterparty", e.target.value)} className={inputCls} placeholder="Company name" />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Physical"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
