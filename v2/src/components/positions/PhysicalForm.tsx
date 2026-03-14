"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Zap, CalendarRange } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useOrgContext } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePositionStore } from "@/store/positionStore";
import { usePricingStore } from "@/store/pricingStore";
import { API_BASE } from "@/lib/api";
import type { PhysicalDirection, PricingType } from "@/types/positions";
import type { Counterparty } from "@/types/contracts";
import type { FormulaComponent, EvaluationResult } from "@/lib/pricingEngine";

const inputCls = "w-full rounded-md border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-focus focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

interface PhysicalFormProps {
  orgId: string;
  siteId: string;
  commodities: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

interface MonthEntry {
  month: string;
  volume: string;
}

function generateMonths(start: string, end: string): MonthEntry[] {
  if (!start || !end) return [];
  const months: MonthEntry[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ month: `${y}-${String(m).padStart(2, "0")}`, volume: "" });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export function PhysicalForm({ orgId, siteId, commodities, onClose, onSuccess }: PhysicalFormProps) {
  const { createPhysical } = usePositionStore();
  const { isPluginEnabled } = useOrgContext();
  const { user } = useAuth();
  const { formulas, fetchFormulas, evaluateFormula } = usePricingStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supplier state
  const [suppliers, setSuppliers] = useState<Counterparty[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: "", counterpartyType: "commercial", creditLimit: "" });
  const [creatingSup, setCreatingSup] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ credit_limit: number | null; credit_used: number; credit_available: number | null; credit_status: string } | null>(null);

  // Multi-month state
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [months, setMonths] = useState<MonthEntry[]>([]);
  const [quickFill, setQuickFill] = useState("");

  const [form, setForm] = useState({
    commodityId: "",
    direction: "buy" as PhysicalDirection,
    price: "",
    pricingType: "fixed" as PricingType,
    basisPrice: "",
    basisMonth: "",
    supplierId: "",
    contractRef: "",
    formulaId: "",
  });

  const [formulaInputs, setFormulaInputs] = useState<Record<string, string>>({});
  const [formulaResult, setFormulaResult] = useState<EvaluationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const formulaEnabled = isPluginEnabled("formula_pricing");

  // Load suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/contracts/counterparties?orgId=${orgId}&entityType=supplier&isActive=true`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch { /* ignore */ }
  }, [orgId]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  // Load credit info when supplier changes
  useEffect(() => {
    if (!form.supplierId) { setCreditInfo(null); return; }
    const sup = suppliers.find(s => s.id === form.supplierId);
    if (sup && sup.credit_limit != null && Number(sup.credit_limit) > 0) {
      setCreditInfo({
        credit_limit: Number(sup.credit_limit),
        credit_used: Number(sup.credit_used),
        credit_available: Number(sup.credit_limit) - Number(sup.credit_used),
        credit_status: sup.credit_status,
      });
    } else {
      setCreditInfo(null);
    }
  }, [form.supplierId, suppliers]);

  // Regenerate months when period changes
  useEffect(() => {
    if (startMonth && endMonth && endMonth >= startMonth) {
      setMonths(generateMonths(startMonth, endMonth));
    }
  }, [startMonth, endMonth]);

  // Fetch formulas when commodity changes
  useEffect(() => {
    if (formulaEnabled && form.commodityId) {
      fetchFormulas(orgId, form.commodityId);
    }
  }, [formulaEnabled, form.commodityId, orgId, fetchFormulas]);

  const selectedFormula = formulas.find((f) => f.id === form.formulaId);
  const editableComponents = selectedFormula?.components
    .filter((c: FormulaComponent) => c.type === "input" || c.type === "market_ref")
    .sort((a: FormulaComponent, b: FormulaComponent) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) ?? [];

  const filteredSuppliers = supplierSearch
    ? suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()))
    : suppliers;

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
    setFormulaResult(null);
  };

  const setMonthVolume = (idx: number, vol: string) => {
    setMonths(prev => prev.map((m, i) => i === idx ? { ...m, volume: vol } : m));
  };

  const removeMonth = (idx: number) => {
    setMonths(prev => prev.filter((_, i) => i !== idx));
  };

  const applyQuickFill = () => {
    if (!quickFill) return;
    setMonths(prev => prev.map(m => ({ ...m, volume: quickFill })));
  };

  const totalVolume = months.reduce((sum, m) => sum + (Number(m.volume) || 0), 0);

  const handleCreateSupplier = async () => {
    if (!newSupplierForm.name) return;
    setCreatingSup(true);
    try {
      const res = await fetch(`${API_BASE}/api/contracts/counterparties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          userId: user!.id,
          name: newSupplierForm.name,
          counterpartyType: newSupplierForm.counterpartyType,
          entityType: "supplier",
          creditLimit: newSupplierForm.creditLimit ? Number(newSupplierForm.creditLimit) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      setSuppliers(prev => [...prev, created]);
      setForm(f => ({ ...f, supplierId: created.id }));
      setShowNewSupplier(false);
      setNewSupplierForm({ name: "", counterpartyType: "commercial", creditLimit: "" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingSup(false);
    }
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
    if (months.length === 0) {
      setError("Add at least one delivery month");
      return;
    }
    const validMonths = months.filter(m => m.month && Number(m.volume) > 0);
    if (validMonths.length === 0) {
      setError("Enter volume for at least one month");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const numInputs: Record<string, number> = {};
      for (const [k, v] of Object.entries(formulaInputs)) {
        numInputs[k] = Number(v) || 0;
      }

      const supplierName = form.supplierId
        ? suppliers.find(s => s.id === form.supplierId)?.name
        : undefined;

      const res = await fetch(`${API_BASE}/api/positions/physicals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          userId: user!.id,
          siteId,
          commodityId: form.commodityId,
          direction: form.direction,
          price: form.price ? Number(form.price) : undefined,
          pricingType: form.pricingType,
          basisPrice: form.basisPrice ? Number(form.basisPrice) : undefined,
          basisMonth: form.basisMonth || undefined,
          counterparty: supplierName || undefined,
          supplierId: form.supplierId || undefined,
          contractRef: form.contractRef || undefined,
          currency: "USD",
          formulaId: form.pricingType === "formula" && form.formulaId ? form.formulaId : undefined,
          formulaInputs: form.pricingType === "formula" && Object.keys(numInputs).length > 0 ? numInputs : undefined,
          formulaResult: form.pricingType === "formula" && formulaResult ? formulaResult : undefined,
          months: validMonths.map(m => ({ month: m.month, volume: Number(m.volume) })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const creditColor = creditInfo?.credit_status === "good" ? "text-profit" :
    creditInfo?.credit_status === "warning" ? "text-warning" : "text-loss";
  const creditBarColor = creditInfo?.credit_status === "good" ? "bg-profit" :
    creditInfo?.credit_status === "warning" ? "bg-warning" : "bg-loss";
  const creditPct = creditInfo?.credit_limit ? Math.min(100, (creditInfo.credit_used / creditInfo.credit_limit) * 100) : 0;

  return (
    <Modal open onClose={onClose} title="New Physical Position">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive-10 border border-destructive-15 px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        {/* Supplier Selection */}
        <div className="space-y-2">
          <label className="block">
            <span className={labelCls}>Supplier</span>
            <div className="relative">
              <input
                type="text"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder="Search suppliers..."
                className={inputCls}
                onFocus={() => setSupplierSearch(supplierSearch)}
              />
            </div>
            <select
              value={form.supplierId}
              onChange={(e) => {
                set("supplierId", e.target.value);
                if (e.target.value) {
                  const sup = suppliers.find(s => s.id === e.target.value);
                  if (sup) setSupplierSearch(sup.name);
                }
              }}
              className={`${inputCls} mt-1`}
            >
              <option value="">Select supplier...</option>
              {filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.short_name ? ` (${s.short_name})` : ""}</option>
              ))}
            </select>
          </label>

          <button type="button" onClick={() => setShowNewSupplier(!showNewSupplier)}
            className="flex items-center gap-1 text-xs text-action hover:text-action-hover transition-colors">
            {showNewSupplier ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {showNewSupplier ? "Cancel" : "New Supplier"}
          </button>

          {showNewSupplier && (
            <div className="rounded-lg border border-action-30 bg-action-5 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Supplier name *" value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                <select value={newSupplierForm.counterpartyType}
                  onChange={(e) => setNewSupplierForm(f => ({ ...f, counterpartyType: e.target.value }))} className={inputCls}>
                  <option value="commercial">Commercial</option>
                  <option value="producer">Producer</option>
                  <option value="broker">Broker</option>
                  <option value="trader">Trader</option>
                </select>
                <input type="number" step="any" placeholder="Credit limit" value={newSupplierForm.creditLimit}
                  onChange={(e) => setNewSupplierForm(f => ({ ...f, creditLimit: e.target.value }))} className={inputCls} />
              </div>
              <button type="button" onClick={handleCreateSupplier} disabled={creatingSup || !newSupplierForm.name}
                className="rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50">
                {creatingSup ? "Creating..." : "Create Supplier"}
              </button>
            </div>
          )}
        </div>

        {/* Credit Summary */}
        {creditInfo && (
          <div className="rounded-lg border border-b-default bg-surface p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted">Credit Usage</span>
              <span className={creditColor}>
                ${creditInfo.credit_used.toLocaleString()} / ${creditInfo.credit_limit!.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-input-bg overflow-hidden">
              <div className={`h-full rounded-full transition-all ${creditBarColor}`} style={{ width: `${creditPct}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-faint">Available: ${creditInfo.credit_available!.toLocaleString()}</span>
              <span className={`font-medium ${creditColor}`}>{creditInfo.credit_status}</span>
            </div>
          </div>
        )}

        {/* Contract Reference */}
        <label className="block">
          <span className={labelCls}>Contract Reference</span>
          <input type="text" value={form.contractRef} onChange={(e) => set("contractRef", e.target.value)}
            className={inputCls} placeholder="e.g. PO-2026-0042" />
        </label>

        {/* Commodity + Direction */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Commodity *</span>
            <select required value={form.commodityId} onChange={(e) => set("commodityId", e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelCls}>Direction *</span>
            <select value={form.direction} onChange={(e) => set("direction", e.target.value)} className={inputCls}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </label>
        </div>

        {/* Price + Pricing Type */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Price</span>
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
            <span className={labelCls}>Pricing Type</span>
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
                <button type="button" onClick={handleCalculate} disabled={calculating}
                  className="rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50">
                  {calculating ? "Calculating..." : "Calculate Price"}
                </button>
                {formulaResult && (
                  <span className="text-sm font-medium text-profit">
                    = {formulaResult.totalPrice?.toFixed(selectedFormula.rounding ?? 4)} {selectedFormula.output_unit ?? ""}
                  </span>
                )}
              </div>
            )}

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

        {/* Basis fields */}
        {form.pricingType === "basis" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Basis Price</span>
              <input type="number" step="any" value={form.basisPrice} onChange={(e) => set("basisPrice", e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Basis Month</span>
              <input type="month" value={form.basisMonth} onChange={(e) => set("basisMonth", e.target.value)} className={inputCls} />
            </label>
          </div>
        )}

        {/* Multi-Month Volume Grid */}
        <div className="space-y-3 rounded-lg border border-b-default bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" /> Delivery Months & Volume
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Start Month *</span>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={inputCls} required />
            </label>
            <label className="block">
              <span className={labelCls}>End Month *</span>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
                className={inputCls} min={startMonth} required />
            </label>
          </div>

          {/* Quick Fill */}
          {months.length > 0 && (
            <div className="flex items-center gap-2">
              <input type="number" step="any" placeholder="Volume" value={quickFill}
                onChange={(e) => setQuickFill(e.target.value)} className={`${inputCls} w-32`} />
              <button type="button" onClick={applyQuickFill}
                className="flex items-center gap-1 rounded-lg bg-action/20 text-action px-3 py-2 text-xs font-medium hover:bg-action/30 transition-colors">
                <Zap className="h-3 w-3" /> Apply to All
              </button>
            </div>
          )}

          {/* Month rows */}
          {months.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {months.map((m, idx) => (
                <div key={m.month} className="flex items-center gap-2">
                  <span className="text-xs text-muted w-24 font-mono">{m.month}</span>
                  <input type="number" step="any" value={m.volume} placeholder="Volume"
                    onChange={(e) => setMonthVolume(idx, e.target.value)}
                    className={`${inputCls} flex-1`} />
                  <button type="button" onClick={() => removeMonth(idx)}
                    className="text-faint hover:text-loss transition-colors p-1">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {months.length > 0 && (
            <div className="flex justify-between text-xs pt-1 border-t border-b-default">
              <span className="text-muted">{months.length} months</span>
              <span className="font-medium text-secondary">Total: {totalVolume.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-b-input px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-50">
            {submitting ? "Creating..." : `Create ${months.length > 1 ? `${months.filter(m => Number(m.volume) > 0).length} Physicals` : "Physical"}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
