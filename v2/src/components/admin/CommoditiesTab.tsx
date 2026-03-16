"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ChevronRight, X } from "lucide-react";
import { apiFetch, btnPrimary, btnCancel, inputCls, selectCls, cn } from "./shared";
import { TableSkeleton, EmptyState } from "./SharedUI";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const FUTURES_LETTER_NAMES: Record<string, string> = {
  F: "January", G: "February", H: "March", J: "April", K: "May", M: "June",
  N: "July", Q: "August", U: "September", V: "October", X: "November", Z: "December",
};

const CATEGORIES = ["ag", "energy", "metals", "softs"];

interface Commodity {
  id: string;
  name: string;
  category: string;
  unit: string;
  currency: string;
  exchange: string | null;
  contract_size: number | null;
  tick_size: number | null;
  tick_value: number | null;
  contract_months: string | null;
  decimal_places: number;
  price_unit: string | null;
  volume_unit: string | null;
  is_active: boolean;
  config: Record<string, unknown> | null;
}

type MonthMappings = Record<string, number[]>;

const EMPTY_FORM: Omit<Commodity, "is_active"> & { is_active: boolean } = {
  id: "", name: "", category: "ag", unit: "MT", currency: "USD",
  exchange: "", contract_size: null, tick_size: null, tick_value: null,
  contract_months: "", decimal_places: 2, price_unit: "", volume_unit: "",
  is_active: true, config: null,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CommoditiesTab() {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/kernel/commodities");
      setCommodities(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleRowClick(id: string) {
    if (adding) return;
    setExpandedId(expandedId === id ? null : id);
  }

  function handleAddClick() {
    setExpandedId(null);
    setAdding(true);
  }

  function handleClose() {
    setExpandedId(null);
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
        {!adding && (
          <button onClick={handleAddClick} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add Commodity
          </button>
        )}
      </div>

      {loading ? <TableSkeleton /> : commodities.length === 0 && !adding ? (
        <EmptyState title="No commodities" desc="No commodities configured." onAction={handleAddClick} actionLabel="Add Commodity" />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["","Code","Name","Exchange","Contract Months","Price Unit","Volume Unit","Active"].map(h =>
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((c) => (
                <React.Fragment key={c.id}>
                  <tr
                    onClick={() => handleRowClick(c.id)}
                    className={cn(
                      "hover:bg-row-hover transition-colors cursor-pointer",
                      expandedId === c.id && "bg-row-hover"
                    )}
                  >
                    <td className="px-3 py-3 w-6">
                      {expandedId === c.id
                        ? <ChevronDown className="h-3.5 w-3.5 text-faint" />
                        : <ChevronRight className="h-3.5 w-3.5 text-faint" />}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-action">{c.id}</td>
                    <td className="px-3 py-3 text-secondary">{c.name}</td>
                    <td className="px-3 py-3 text-muted">{c.exchange ?? "\u2014"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted">{c.contract_months ?? "\u2014"}</td>
                    <td className="px-3 py-3 text-muted">{c.price_unit ?? "\u2014"}</td>
                    <td className="px-3 py-3 text-muted">{c.volume_unit ?? "\u2014"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        c.is_active ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <EditPanel
                          commodity={c}
                          onSave={() => { handleClose(); load(); }}
                          onCancel={handleClose}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {adding && (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EditPanel
                      commodity={null}
                      onSave={() => { handleClose(); load(); }}
                      onCancel={handleClose}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Edit / Add Panel ───────────────────────────────────────────────────────

function EditPanel({
  commodity,
  onSave,
  onCancel,
}: {
  commodity: Commodity | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isNew = commodity === null;
  const initial = commodity ?? EMPTY_FORM;

  const [form, setForm] = useState({
    id: initial.id,
    name: initial.name,
    category: initial.category,
    unit: initial.unit,
    currency: initial.currency,
    exchange: initial.exchange ?? "",
    contract_size: initial.contract_size ?? "",
    tick_size: initial.tick_size ?? "",
    tick_value: initial.tick_value ?? "",
    contract_months: initial.contract_months ?? "",
    decimal_places: initial.decimal_places,
    price_unit: initial.price_unit ?? "",
    volume_unit: initial.volume_unit ?? "",
    is_active: initial.is_active,
  });

  const [mappings, setMappings] = useState<MonthMappings>(() => {
    const existing = (initial.config as Record<string, unknown>)?.month_mappings;
    if (existing && typeof existing === "object") return existing as MonthMappings;
    return {};
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive contract letters from contract_months field
  const letters = (form.contract_months ?? "").split("").filter((ch) => /[A-Z]/.test(ch));

  function setField(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMonth(letter: string, monthNum: number) {
    setMappings((prev) => {
      const next = { ...prev };
      const arr = [...(next[letter] ?? [])];
      const idx = arr.indexOf(monthNum);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(monthNum);
      arr.sort((a, b) => a - b);
      next[letter] = arr;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Clean mappings to only include letters that are in contract_months
    const cleanedMappings: MonthMappings = {};
    for (const l of letters) {
      if (mappings[l] && mappings[l].length > 0) {
        cleanedMappings[l] = mappings[l];
      }
    }

    const payload = {
      ...(isNew ? { id: form.id.toUpperCase() } : {}),
      name: form.name,
      category: form.category,
      unit: form.unit,
      currency: form.currency,
      exchange: form.exchange || null,
      contract_size: form.contract_size ? Number(form.contract_size) : null,
      tick_size: form.tick_size ? Number(form.tick_size) : null,
      tick_value: form.tick_value ? Number(form.tick_value) : null,
      contract_months: form.contract_months || null,
      decimal_places: Number(form.decimal_places),
      price_unit: form.price_unit || null,
      volume_unit: form.volume_unit || null,
      is_active: form.is_active,
      config: { month_mappings: cleanedMappings },
    };

    try {
      if (isNew) {
        await apiFetch("/api/kernel/commodities", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/api/kernel/commodities/${commodity!.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-b-default bg-input-bg/30 p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
          {isNew ? "New Commodity" : `Edit ${commodity!.name}`}
        </h3>
        <button type="button" onClick={onCancel} className="text-faint hover:text-secondary transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}

      {/* Basic fields — 2-col grid */}
      <div className="grid grid-cols-2 gap-3">
        {isNew && (
          <Field label="Code (ID)" required>
            <input value={form.id} onChange={(e) => setField("id", e.target.value.toUpperCase())}
              className={inputCls} placeholder="e.g. WHEAT" required />
          </Field>
        )}
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => setField("name", e.target.value)}
            className={inputCls} placeholder="e.g. Wheat" required />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(e) => setField("category", e.target.value)} className={selectCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Exchange">
          <input value={form.exchange} onChange={(e) => setField("exchange", e.target.value)}
            className={inputCls} placeholder="e.g. CBOT" />
        </Field>
        <Field label="Currency">
          <input value={form.currency} onChange={(e) => setField("currency", e.target.value)}
            className={inputCls} placeholder="USD" />
        </Field>
        <Field label="Contract Size">
          <input type="number" step="any" value={form.contract_size} onChange={(e) => setField("contract_size", e.target.value)}
            className={inputCls} placeholder="5000" />
        </Field>
        <Field label="Tick Size">
          <input type="number" step="any" value={form.tick_size} onChange={(e) => setField("tick_size", e.target.value)}
            className={inputCls} placeholder="0.0025" />
        </Field>
        <Field label="Tick Value">
          <input type="number" step="any" value={form.tick_value} onChange={(e) => setField("tick_value", e.target.value)}
            className={inputCls} placeholder="12.50" />
        </Field>
        <Field label="Decimal Places">
          <input type="number" value={form.decimal_places} onChange={(e) => setField("decimal_places", e.target.value)}
            className={inputCls} />
        </Field>
        <Field label="Price Unit">
          <input value={form.price_unit} onChange={(e) => setField("price_unit", e.target.value)}
            className={inputCls} placeholder="cents/bu" />
        </Field>
        <Field label="Volume Unit">
          <input value={form.volume_unit} onChange={(e) => setField("volume_unit", e.target.value)}
            className={inputCls} placeholder="MT" />
        </Field>
        <Field label="Unit">
          <input value={form.unit} onChange={(e) => setField("unit", e.target.value)}
            className={inputCls} placeholder="MT" />
        </Field>
        <Field label="Contract Months">
          <input value={form.contract_months} onChange={(e) => setField("contract_months", e.target.value.toUpperCase())}
            className={inputCls} placeholder="e.g. HKNUZ" />
          <p className="text-xs text-faint mt-0.5">
            Futures letter codes this commodity trades (e.g. H=Mar, K=May, N=Jul, U=Sep, Z=Dec)
          </p>
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setField("is_active", e.target.checked)}
              className="rounded border-b-input bg-input-bg text-action focus:ring-action" />
            <span className="text-sm text-secondary">{form.is_active ? "Active" : "Inactive"}</span>
          </label>
        </Field>
      </div>

      {/* Month Mapping Grid */}
      {letters.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Budget-to-Futures Month Mapping
          </h4>
          <p className="text-xs text-faint">
            For each contract month, toggle which budget months (1-12) it covers.
          </p>
          <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-input-bg/50 border-b border-b-default">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider w-10">Letter</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted uppercase tracking-wider w-24">Contract</th>
                  {MONTH_ABBR.map((m) => (
                    <th key={m} className="px-1 py-2 text-center text-xs font-medium text-muted uppercase tracking-wider w-10">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-b-default">
                {letters.map((letter) => (
                  <tr key={letter} className="hover:bg-row-hover transition-colors">
                    <td className="px-3 py-2 font-mono text-sm font-bold text-action">{letter}</td>
                    <td className="px-3 py-2 text-xs text-muted">{FUTURES_LETTER_NAMES[letter] ?? letter}</td>
                    {MONTH_ABBR.map((_, i) => {
                      const monthNum = i + 1;
                      const isSelected = (mappings[letter] ?? []).includes(monthNum);
                      return (
                        <td key={i} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleMonth(letter, monthNum)}
                            className={cn(
                              "h-6 w-6 rounded text-xs font-medium transition-colors",
                              isSelected
                                ? "bg-action text-white"
                                : "bg-input-bg text-ph hover:bg-hover hover:text-muted"
                            )}
                          >
                            {MONTH_ABBR[i]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {letters.length > 0 && (
            <div className="space-y-0.5">
              {letters.map((letter) => (
                <p key={letter} className="text-xs text-faint">
                  <span className="font-mono text-muted">{letter}</span> = {FUTURES_LETTER_NAMES[letter] ?? letter} &rarr;{" "}
                  {(mappings[letter] ?? []).map((m) => MONTH_ABBR[m - 1]).join(", ") || "none"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-b-default">
        <button type="button" onClick={onCancel} className={btnCancel}>Cancel</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Commodity" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Field helper ───────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted">
        {label}{required && <span className="text-loss ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
