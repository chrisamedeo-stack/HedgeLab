"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeft, X, Trash2 } from "lucide-react";
import { apiFetch, btnPrimary, btnCancel, btnDanger, inputCls, selectCls, cn } from "./shared";
import { TableSkeleton, EmptyState } from "./SharedUI";
import { MarketDataTab } from "./MarketDataTab";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const FUTURES_LETTER_NAMES: Record<string, string> = {
  F: "January", G: "February", H: "March", J: "April", K: "May", M: "June",
  N: "July", Q: "August", U: "September", V: "October", X: "November", Z: "December",
};

const CATEGORIES = ["ag", "energy", "metals", "softs"];
const COMMODITY_CLASSES = ["grains", "oilseeds", "softs", "energy", "metals"];

type MonthMappings = Record<string, number[]>;
type DetailTab = "general" | "trade" | "units" | "futures" | "basis" | "market-data";

interface CommodityUnit {
  id?: string;
  unit_name: string;
  abbreviation: string;
  to_trade_unit: number;
  from_trade_unit: number;
  is_default_report: boolean;
  sort_order: number;
}

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
  // New config columns
  display_name: string | null;
  commodity_class: string | null;
  ticker_root: string | null;
  trade_price_unit: string | null;
  trade_volume_unit: string | null;
  price_decimal_places: number | null;
  point_value: number | null;
  basis_unit: string | null;
  basis_reference: string | null;
  units: CommodityUnit[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function CommoditiesTab() {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/kernel/commodities");
      setCommodities(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = commodities.find((c) => c.id === selectedId) ?? null;

  // ─── Detail View ───────────────────────────────────────────────────────
  if (selectedId && selected) {
    return (
      <CommodityDetail
        commodity={selected}
        onBack={() => setSelectedId(null)}
        onSaved={() => { load(); }}
      />
    );
  }

  // ─── Add View ──────────────────────────────────────────────────────────
  if (adding) {
    return (
      <CommodityDetail
        commodity={null}
        onBack={() => setAdding(false)}
        onSaved={() => { setAdding(false); load(); }}
      />
    );
  }

  // ─── List View ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
        <button onClick={() => setAdding(true)} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Add Commodity
        </button>
      </div>

      {loading ? <TableSkeleton /> : commodities.length === 0 ? (
        <EmptyState title="No commodities" desc="No commodities configured." onAction={() => setAdding(true)} actionLabel="Add Commodity" />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Code","Name","Class","Exchange","Ticker","Trade Unit","Active"].map(h =>
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {commodities.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="hover:bg-row-hover transition-colors cursor-pointer"
                >
                  <td className="px-3 py-3 font-mono text-xs text-action">{c.id}</td>
                  <td className="px-3 py-3 text-secondary">{c.display_name ?? c.name}</td>
                  <td className="px-3 py-3 text-muted capitalize">{c.commodity_class ?? c.category}</td>
                  <td className="px-3 py-3 text-muted">{c.exchange ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{c.ticker_root ?? "—"}</td>
                  <td className="px-3 py-3 text-muted">{c.trade_price_unit ?? c.price_unit ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                      c.is_active ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function CommodityDetail({
  commodity,
  onBack,
  onSaved,
}: {
  commodity: Commodity | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const isNew = commodity === null;
  const [tab, setTab] = useState<DetailTab>("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for all fields
  const [form, setForm] = useState(() => initForm(commodity));
  const [mappings, setMappings] = useState<MonthMappings>(() => {
    const existing = (commodity?.config as Record<string, unknown>)?.month_mappings;
    if (existing && typeof existing === "object") return existing as MonthMappings;
    return {};
  });
  const [units, setUnits] = useState<CommodityUnit[]>(commodity?.units ?? []);

  function set(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const letters = (form.contract_months ?? "").split("").filter((ch) => /[A-Z]/.test(ch));

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

  async function handleSave() {
    setSaving(true);
    setError(null);

    const cleanedMappings: MonthMappings = {};
    for (const l of letters) {
      if (mappings[l] && mappings[l].length > 0) cleanedMappings[l] = mappings[l];
    }

    const payload = {
      ...(isNew ? { id: form.id.toUpperCase() } : {}),
      name: form.name,
      display_name: form.display_name || form.name,
      category: form.category,
      commodity_class: form.commodity_class,
      unit: form.unit,
      currency: form.currency,
      exchange: form.exchange || null,
      ticker_root: form.ticker_root || null,
      contract_size: form.contract_size ? Number(form.contract_size) : null,
      tick_size: form.tick_size ? Number(form.tick_size) : null,
      tick_value: form.tick_value ? Number(form.tick_value) : null,
      contract_months: form.contract_months || null,
      decimal_places: Number(form.decimal_places),
      price_unit: form.price_unit || null,
      volume_unit: form.volume_unit || null,
      trade_price_unit: form.trade_price_unit || null,
      trade_volume_unit: form.trade_volume_unit || null,
      price_decimal_places: form.price_decimal_places ? Number(form.price_decimal_places) : null,
      point_value: form.point_value ? Number(form.point_value) : null,
      basis_unit: form.basis_unit || null,
      basis_reference: form.basis_reference || null,
      is_active: form.is_active,
      config: { month_mappings: cleanedMappings },
      units: units.map((u, i) => ({ ...u, sort_order: i })),
    };

    try {
      if (isNew) {
        await apiFetch("/api/kernel/commodities", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await apiFetch(`/api/kernel/commodities/${commodity!.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      onSaved();
      if (!isNew) onBack();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const DETAIL_TABS: { key: DetailTab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "trade", label: "Trade Setup" },
    { key: "units", label: "Reporting Units" },
    { key: "futures", label: "Futures Months" },
    { key: "basis", label: "Basis Config" },
    ...(!isNew ? [{ key: "market-data" as DetailTab, label: "Market Data" }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Back button + title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-muted hover:text-secondary transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-sm font-semibold text-secondary">
              {isNew ? "New Commodity" : (commodity!.display_name ?? commodity!.name)}
            </h3>
            {!isNew && (
              <p className="text-xs text-faint font-mono">{commodity!.id}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className={btnCancel}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className={btnPrimary}>
            {saving ? "Saving..." : isNew ? "Create" : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}

      {/* Sub-tabs */}
      <div className="border-b border-b-default">
        <div className="flex gap-0">
          {DETAIL_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
                tab === t.key
                  ? "border-action text-secondary"
                  : "border-transparent text-muted hover:text-secondary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "market-data" && !isNew && commodity ? (
        <MarketDataTab
          commodityId={commodity.id}
          commodityName={commodity.display_name ?? commodity.name}
          tickerRoot={commodity.ticker_root ?? ""}
          tradePriceUnit={commodity.trade_price_unit ?? commodity.price_unit ?? "$/bu"}
          priceDecimalPlaces={commodity.price_decimal_places ?? commodity.decimal_places ?? 4}
          config={commodity.config}
        />
      ) : (
        <div className="bg-surface border border-b-default rounded-lg p-5">
          {tab === "general" && (
            <GeneralTab form={form} set={set} isNew={isNew} />
          )}
          {tab === "trade" && (
            <TradeSetupTab form={form} set={set} />
          )}
          {tab === "units" && (
            <ReportingUnitsTab units={units} setUnits={setUnits} />
          )}
          {tab === "futures" && (
            <FuturesMonthsTab
              form={form}
              set={set}
              letters={letters}
              mappings={mappings}
              toggleMonth={toggleMonth}
            />
          )}
          {tab === "basis" && (
            <BasisConfigTab form={form} set={set} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── General Tab ────────────────────────────────────────────────────────────

function GeneralTab({
  form,
  set,
  isNew,
}: {
  form: ReturnType<typeof initForm>;
  set: (key: string, value: unknown) => void;
  isNew: boolean;
}) {
  return (
    <div className="space-y-5">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Identity</h4>
      <div className="grid grid-cols-2 gap-4">
        {isNew && (
          <Field label="Code (ID)" required>
            <input value={form.id} onChange={(e) => set("id", e.target.value.toUpperCase())}
              className={inputCls} placeholder="e.g. WHEAT" required />
          </Field>
        )}
        <Field label="Name" required>
          <input value={form.name} onChange={(e) => set("name", e.target.value)}
            className={inputCls} placeholder="e.g. Wheat" required />
        </Field>
        <Field label="Display Name">
          <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)}
            className={inputCls} placeholder="e.g. Wheat (SRW)" />
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className={selectCls}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Commodity Class">
          <select value={form.commodity_class} onChange={(e) => set("commodity_class", e.target.value)} className={selectCls}>
            {COMMODITY_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Exchange">
          <input value={form.exchange} onChange={(e) => set("exchange", e.target.value)}
            className={inputCls} placeholder="e.g. CBOT" />
        </Field>
        <Field label="Ticker Root">
          <input value={form.ticker_root} onChange={(e) => set("ticker_root", e.target.value)}
            className={inputCls} placeholder="e.g. ZC" />
        </Field>
        <Field label="Currency">
          <input value={form.currency} onChange={(e) => set("currency", e.target.value)}
            className={inputCls} placeholder="USD" />
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)}
              className="rounded border-b-input bg-input-bg text-action focus:ring-action" />
            <span className="text-sm text-secondary">{form.is_active ? "Active" : "Inactive"}</span>
          </label>
        </Field>
      </div>
    </div>
  );
}

// ─── Trade Setup Tab ────────────────────────────────────────────────────────

function TradeSetupTab({
  form,
  set,
}: {
  form: ReturnType<typeof initForm>;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Trade Entry</h4>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Trade Price Unit">
          <input value={form.trade_price_unit} onChange={(e) => set("trade_price_unit", e.target.value)}
            className={inputCls} placeholder="e.g. $/bu, cents/lb" />
          <p className="text-xs text-faint mt-0.5">Unit shown in trade entry price column</p>
        </Field>
        <Field label="Trade Volume Unit">
          <input value={form.trade_volume_unit} onChange={(e) => set("trade_volume_unit", e.target.value)}
            className={inputCls} placeholder="e.g. bu, lb, MT" />
        </Field>
        <Field label="Price Decimal Places">
          <input type="number" min={0} max={8} value={form.price_decimal_places}
            onChange={(e) => set("price_decimal_places", e.target.value)}
            className={inputCls} />
        </Field>
        <Field label="Legacy Decimal Places">
          <input type="number" min={0} max={8} value={form.decimal_places}
            onChange={(e) => set("decimal_places", e.target.value)}
            className={inputCls} />
        </Field>
      </div>

      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider pt-4">Contract Spec</h4>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Contract Size">
          <input type="number" step="any" value={form.contract_size}
            onChange={(e) => set("contract_size", e.target.value)}
            className={inputCls} placeholder="5000" />
        </Field>
        <Field label="Point Value">
          <input type="number" step="any" value={form.point_value}
            onChange={(e) => set("point_value", e.target.value)}
            className={inputCls} placeholder="50" />
          <p className="text-xs text-faint mt-0.5">Dollar value of a 1-point move per contract</p>
        </Field>
        <Field label="Tick Size">
          <input type="number" step="any" value={form.tick_size}
            onChange={(e) => set("tick_size", e.target.value)}
            className={inputCls} placeholder="0.0025" />
        </Field>
        <Field label="Tick Value">
          <input type="number" step="any" value={form.tick_value}
            onChange={(e) => set("tick_value", e.target.value)}
            className={inputCls} placeholder="12.50" />
        </Field>
        <Field label="Price Unit (legacy)">
          <input value={form.price_unit} onChange={(e) => set("price_unit", e.target.value)}
            className={inputCls} placeholder="cents/bu" />
        </Field>
        <Field label="Volume Unit (legacy)">
          <input value={form.volume_unit} onChange={(e) => set("volume_unit", e.target.value)}
            className={inputCls} placeholder="MT" />
        </Field>
        <Field label="Base Unit">
          <input value={form.unit} onChange={(e) => set("unit", e.target.value)}
            className={inputCls} placeholder="MT" />
        </Field>
      </div>
    </div>
  );
}

// ─── Reporting Units Tab ────────────────────────────────────────────────────

function ReportingUnitsTab({
  units,
  setUnits,
}: {
  units: CommodityUnit[];
  setUnits: React.Dispatch<React.SetStateAction<CommodityUnit[]>>;
}) {
  function addUnit() {
    setUnits((prev) => [
      ...prev,
      {
        unit_name: "",
        abbreviation: "",
        to_trade_unit: 1,
        from_trade_unit: 1,
        is_default_report: prev.length === 0,
        sort_order: prev.length,
      },
    ]);
  }

  function removeUnit(index: number) {
    setUnits((prev) => prev.filter((_, i) => i !== index));
  }

  function updateUnit(index: number, key: keyof CommodityUnit, value: unknown) {
    setUnits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      // If setting default, unset others
      if (key === "is_default_report" && value === true) {
        next.forEach((u, i) => { if (i !== index) u.is_default_report = false; });
      }
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Reporting Units</h4>
          <p className="text-xs text-faint mt-0.5">Define units for volume conversion and reporting</p>
        </div>
        <button type="button" onClick={addUnit} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Add Unit
        </button>
      </div>

      {units.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-b-default rounded-lg">
          <p className="text-sm text-faint">No reporting units configured</p>
          <button type="button" onClick={addUnit} className="mt-2 text-sm text-action hover:text-action-hover transition-colors">
            Add your first unit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {units.map((u, i) => (
            <div key={i} className="bg-input-bg/30 border border-b-default rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-faint">#{i + 1}</span>
                  {u.is_default_report && (
                    <span className="text-xs bg-action/10 text-action px-2 py-0.5 rounded">Default</span>
                  )}
                </div>
                <button type="button" onClick={() => removeUnit(i)}
                  className="text-faint hover:text-loss transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Unit Name">
                  <input value={u.unit_name} onChange={(e) => updateUnit(i, "unit_name", e.target.value)}
                    className={inputCls} placeholder="e.g. Metric tons" />
                </Field>
                <Field label="Abbreviation">
                  <input value={u.abbreviation} onChange={(e) => updateUnit(i, "abbreviation", e.target.value)}
                    className={inputCls} placeholder="e.g. MT" />
                </Field>
                <Field label="To Trade Unit">
                  <input type="number" step="any" value={u.to_trade_unit}
                    onChange={(e) => updateUnit(i, "to_trade_unit", Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-faint mt-0.5">1 of this = X trade units</p>
                </Field>
                <Field label="From Trade Unit">
                  <input type="number" step="any" value={u.from_trade_unit}
                    onChange={(e) => updateUnit(i, "from_trade_unit", Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-faint mt-0.5">1 trade unit = X of this</p>
                </Field>
                <Field label="Default Report">
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input type="checkbox" checked={u.is_default_report}
                      onChange={(e) => updateUnit(i, "is_default_report", e.target.checked)}
                      className="rounded border-b-input bg-input-bg text-action focus:ring-action" />
                    <span className="text-sm text-secondary">{u.is_default_report ? "Yes" : "No"}</span>
                  </label>
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Futures Months Tab ─────────────────────────────────────────────────────

function FuturesMonthsTab({
  form,
  set,
  letters,
  mappings,
  toggleMonth,
}: {
  form: ReturnType<typeof initForm>;
  set: (key: string, value: unknown) => void;
  letters: string[];
  mappings: MonthMappings;
  toggleMonth: (letter: string, monthNum: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Contract Months">
          <input value={form.contract_months}
            onChange={(e) => set("contract_months", e.target.value.toUpperCase())}
            className={inputCls} placeholder="e.g. HKNUZ" />
          <p className="text-xs text-faint mt-0.5">
            Futures letter codes (F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec)
          </p>
        </Field>
      </div>

      {letters.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
            Budget-to-Futures Month Mapping
          </h4>
          <p className="text-xs text-faint">
            For each contract month, toggle which budget months (1-12) it covers.
          </p>
          <div className="bg-input-bg/30 border border-b-default rounded-lg overflow-hidden">
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
                    {MONTH_ABBR.map((_, idx) => {
                      const monthNum = idx + 1;
                      const isSelected = (mappings[letter] ?? []).includes(monthNum);
                      return (
                        <td key={idx} className="px-1 py-2 text-center">
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
                            {MONTH_ABBR[idx]}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-0.5">
            {letters.map((letter) => (
              <p key={letter} className="text-xs text-faint">
                <span className="font-mono text-muted">{letter}</span> = {FUTURES_LETTER_NAMES[letter] ?? letter} &rarr;{" "}
                {(mappings[letter] ?? []).map((m) => MONTH_ABBR[m - 1]).join(", ") || "none"}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Basis Config Tab ───────────────────────────────────────────────────────

function BasisConfigTab({
  form,
  set,
}: {
  form: ReturnType<typeof initForm>;
  set: (key: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Basis Configuration</h4>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Basis Unit">
          <input value={form.basis_unit} onChange={(e) => set("basis_unit", e.target.value)}
            className={inputCls} placeholder="e.g. cents/bu" />
          <p className="text-xs text-faint mt-0.5">Unit for basis values (e.g. cents/bu, $/MT)</p>
        </Field>
        <Field label="Basis Reference">
          <input value={form.basis_reference} onChange={(e) => set("basis_reference", e.target.value)}
            className={inputCls} placeholder="e.g. CBOT settlement" />
          <p className="text-xs text-faint mt-0.5">Reference point for basis quotes</p>
        </Field>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function initForm(commodity: Commodity | null) {
  const c = commodity;
  return {
    id: c?.id ?? "",
    name: c?.name ?? "",
    display_name: c?.display_name ?? c?.name ?? "",
    category: c?.category ?? "ag",
    commodity_class: c?.commodity_class ?? "grains",
    unit: c?.unit ?? "MT",
    currency: c?.currency ?? "USD",
    exchange: c?.exchange ?? "",
    ticker_root: c?.ticker_root ?? "",
    contract_size: c?.contract_size != null ? String(c.contract_size) : "",
    tick_size: c?.tick_size != null ? String(c.tick_size) : "",
    tick_value: c?.tick_value != null ? String(c.tick_value) : "",
    contract_months: c?.contract_months ?? "",
    decimal_places: c?.decimal_places ?? 2,
    price_unit: c?.price_unit ?? "",
    volume_unit: c?.volume_unit ?? "",
    trade_price_unit: c?.trade_price_unit ?? "",
    trade_volume_unit: c?.trade_volume_unit ?? "",
    price_decimal_places: c?.price_decimal_places ?? 4,
    point_value: c?.point_value != null ? String(c.point_value) : "",
    basis_unit: c?.basis_unit ?? "",
    basis_reference: c?.basis_reference ?? "",
    is_active: c?.is_active ?? true,
  };
}

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
