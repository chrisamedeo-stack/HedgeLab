"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, ArrowLeft, Trash2, Pencil, Check, X } from "lucide-react";
import { apiFetch, btnPrimary, inputCls, selectCls, cn } from "./shared";
import { TableSkeleton } from "./SharedUI";

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ALL_FUTURES: { code: string; name: string }[] = [
  { code: "F", name: "January" }, { code: "G", name: "February" },
  { code: "H", name: "March" }, { code: "J", name: "April" },
  { code: "K", name: "May" }, { code: "M", name: "June" },
  { code: "N", name: "July" }, { code: "Q", name: "August" },
  { code: "U", name: "September" }, { code: "V", name: "October" },
  { code: "X", name: "November" }, { code: "Z", name: "December" },
];

const CATEGORIES = [
  { value: "ag", label: "Grains" },
  { value: "oilseeds", label: "Oilseeds" },
  { value: "energy", label: "Energy" },
  { value: "metals", label: "Metals" },
  { value: "softs", label: "Softs" },
  { value: "livestock", label: "Livestock" },
];

const EXCHANGES = ["CBOT", "CME", "NYMEX", "ICE US", "ICE EU", "LME"];
const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "BRL"];
const DECIMALS_OPTIONS = [2, 3, 4, 6];

const UOM_OPTIONS = [
  { value: "Bushels", abbr: "bu" },
  { value: "Barrels", abbr: "bbl" },
  { value: "MMBtu", abbr: "MMBtu" },
  { value: "Troy ounces", abbr: "troy oz" },
  { value: "Pounds", abbr: "lb" },
  { value: "Short tons", abbr: "st" },
  { value: "Metric tons", abbr: "MT" },
  { value: "Gallons", abbr: "gal" },
  { value: "MWh", abbr: "MWh" },
  { value: "Contracts", abbr: "lot" },
];

const PRICE_UNITS_BY_UOM: Record<string, string[]> = {
  Bushels: ["$/bu", "cents/bu", "$/MT"],
  Barrels: ["$/bbl", "$/MT"],
  MMBtu: ["$/MMBtu", "$/therm"],
  "Troy ounces": ["$/troy oz", "$/MT"],
  Pounds: ["cents/lb", "$/lb", "$/MT"],
  "Short tons": ["$/short ton", "$/MT"],
  "Metric tons": ["$/MT"],
  Gallons: ["$/gal", "$/bbl"],
  MWh: ["$/MWh"],
  Contracts: ["$/contract"],
};

const BASIS_UNITS = ["cents/bu", "$/bbl", "$/MT", "$/MMBtu", "cents/lb", "$/short ton", "percentage"];
const SIGN_CONVENTIONS = [
  { value: "positive_above", label: "Positive = above reference" },
  { value: "negative_below", label: "Negative = below reference" },
];

const GRAIN_PRESET: Record<string, number[]> = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
const ALL12_PRESET: Record<string, number[]> = { F: [1], G: [2], H: [3], J: [4], K: [5], M: [6], N: [7], Q: [8], U: [9], V: [10], X: [11], Z: [12] };

type MonthMappings = Record<string, number[]>;
type DetailTab = "setup" | "units";

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
  display_name: string | null;
  commodity_class: string | null;
  ticker_root: string | null;
  trade_price_unit: string | null;
  trade_volume_unit: string | null;
  price_decimal_places: number | null;
  point_value: number | null;
  volume_entry_mode: string | null;
  basis_unit: string | null;
  basis_reference: string | null;
  basis_sign_convention: string | null;
  futures_budget_mapping: Record<string, number[]> | null;
  units: CommodityUnit[];
}

// ─── Styling constants ──────────────────────────────────────────────────────

const sectionCard = "bg-[#111D32] border border-[#1E3A5F] rounded-lg p-5 space-y-4";
const sectionLabel = "text-[11px] font-semibold text-[#556170] uppercase tracking-[0.06em]";
const fieldLabel = "block text-[10px] font-medium text-[#8B95A5] mb-1";
const fieldInput = "w-full bg-[#1A2740] border border-[#1E3A5F] rounded-md px-2.5 py-[7px] text-xs text-[#E8ECF1] focus:border-[#378ADD] focus:outline-none focus:ring-0";
const fieldSelect = fieldInput + " appearance-none";
const readOnlyInput = fieldInput + " text-[#556170] cursor-default";
const presetActive = "text-[10px] px-2.5 py-1 rounded-sm bg-[#378ADD] text-white";
const presetInactive = "text-[10px] px-2.5 py-1 rounded-sm bg-[#1A2740] text-[#8B95A5] border border-[#1E3A5F]";

// ─── Main Component ─────────────────────────────────────────────────────────

export function CommoditiesTab() {
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ id: "", name: "", category: "ag", unit: "Bushels", currency: "USD" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/api/kernel/commodities");
      setCommodities(data);
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = commodities.find((c) => c.id === selectedId) ?? null;

  // Detail View
  if (selectedId && selected) {
    return (
      <CommodityDetail
        commodity={selected}
        onBack={() => { setSelectedId(null); load(); }}
        onSaved={() => { load(); }}
      />
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = {
        id: addForm.id.toUpperCase().trim(),
        name: addForm.name.trim(),
        category: addForm.category,
        unit: UOM_OPTIONS.find((u) => u.value === addForm.unit)?.abbr ?? addForm.unit,
        trade_volume_unit: UOM_OPTIONS.find((u) => u.value === addForm.unit)?.abbr ?? addForm.unit,
        trade_price_unit: (PRICE_UNITS_BY_UOM[addForm.unit] ?? ["$/unit"])[0],
        currency: addForm.currency,
        display_name: addForm.name.trim(),
        commodity_class: addForm.category,
      };
      await apiFetch("/api/kernel/commodities", { method: "POST", body: JSON.stringify(payload) });
      setAdding(false);
      setAddForm({ id: "", name: "", category: "ag", unit: "Bushels", currency: "USD" });
      await load();
      // Navigate to the new commodity
      setSelectedId(payload.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  // List View
  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{commodities.length} commodities</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add Commodity
          </button>
        )}
      </div>

      {loading ? <TableSkeleton /> : (
        <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-input-bg/50 border-b border-b-default">
              {["Code","Name","Category","UOM","Currency","Exchange","Contract Size","Status"].map(h =>
                <th key={h} className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-b-default">
              {/* Inline add row */}
              {adding && (
                <tr className="bg-action/5">
                  <td className="px-3 py-2">
                    <input value={addForm.id} onChange={(e) => setAddForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))}
                      className={cn(inputCls, "text-xs py-1.5 font-mono w-20")} placeholder="WHEAT" required autoFocus />
                  </td>
                  <td className="px-3 py-2">
                    <input value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                      className={cn(inputCls, "text-xs py-1.5 w-32")} placeholder="Wheat" required />
                  </td>
                  <td className="px-3 py-2">
                    <select value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                      className={cn(selectCls, "text-xs py-1.5 w-24")}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={addForm.unit} onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
                      className={cn(selectCls, "text-xs py-1.5 w-28")}>
                      {UOM_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.value}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={addForm.currency} onChange={(e) => setAddForm((f) => ({ ...f, currency: e.target.value }))}
                      className={cn(selectCls, "text-xs py-1.5 w-16")}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2" colSpan={2}>
                    <div className="flex items-center gap-2">
                      <button onClick={handleCreate} disabled={creating || !addForm.id || !addForm.name}
                        className="px-3 py-1.5 text-xs font-medium bg-[#378ADD] text-white rounded-md hover:bg-[#378ADD]/90 disabled:opacity-50 transition-colors">
                        {creating ? "Creating..." : "Create"}
                      </button>
                      <button onClick={() => { setAdding(false); setAddForm({ id: "", name: "", category: "ag", unit: "Bushels", currency: "USD" }); }}
                        className="text-xs text-faint hover:text-secondary">Cancel</button>
                    </div>
                  </td>
                  <td />
                </tr>
              )}
              {commodities.length === 0 && !adding ? (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-sm text-faint">No commodities configured</td></tr>
              ) : (
                commodities.map((c) => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)}
                    className="hover:bg-row-hover transition-colors cursor-pointer">
                    <td className="px-3 py-3 font-mono text-xs text-action">{c.id}</td>
                    <td className="px-3 py-3 text-secondary">{c.display_name ?? c.name}</td>
                    <td className="px-3 py-3 text-muted capitalize">{CATEGORIES.find((cat) => cat.value === c.category)?.label ?? c.category}</td>
                    <td className="px-3 py-3 text-muted">{c.trade_volume_unit ?? c.unit}</td>
                    <td className="px-3 py-3 text-muted">{c.currency}</td>
                    <td className="px-3 py-3 text-muted">{c.exchange ?? "—"}</td>
                    <td className="px-3 py-3 text-muted font-mono text-xs">{c.contract_size ? c.contract_size.toLocaleString() : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                        c.is_active ? "text-profit bg-profit-10 ring-1 ring-profit-20" : "text-muted bg-hover/50")}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function CommodityDetail({ commodity, onBack, onSaved }: {
  commodity: Commodity;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("setup");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState(() => initForm(commodity));
  const [units, setUnits] = useState<CommodityUnit[]>(commodity.units ?? []);
  const [dirty, setDirty] = useState(false);

  function set(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function setMapping(m: MonthMappings) {
    setForm((prev) => ({ ...prev, futures_budget_mapping: m }));
    setDirty(true);
  }

  // Active futures letters
  const activeLetters = (form.contract_months ?? "").split("").filter((ch: string) => /[A-Z]/.test(ch));

  // Price unit options based on UOM
  const uomLabel = UOM_OPTIONS.find((u) => u.abbr === form.trade_volume_unit || u.value === form.trade_volume_unit)?.value ?? form.trade_volume_unit;
  const priceUnitOptions = PRICE_UNITS_BY_UOM[uomLabel ?? ""] ?? [form.trade_price_unit || "$/unit"];

  // UOM abbreviation for suffix
  const uomAbbr = UOM_OPTIONS.find((u) => u.abbr === form.trade_volume_unit || u.value === form.trade_volume_unit)?.abbr ?? form.trade_volume_unit;

  // Price preview
  const samplePrice = form.trade_price_unit?.startsWith("cents") ? 52.30 : 4.8725;
  const pricePreview = formatPreview(samplePrice, form.trade_price_unit ?? "$/bu", Number(form.price_decimal_places) || 4);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        display_name: form.display_name || form.name,
        category: form.category,
        commodity_class: form.commodity_class,
        unit: form.trade_volume_unit || form.unit,
        currency: form.currency,
        exchange: form.exchange || null,
        ticker_root: form.ticker_root || null,
        contract_size: form.contract_size ? Number(form.contract_size) : null,
        tick_size: form.tick_size ? Number(form.tick_size) : null,
        tick_value: form.tick_value ? Number(form.tick_value) : null,
        point_value: form.point_value ? Number(form.point_value) : null,
        contract_months: form.contract_months || null,
        trade_price_unit: form.trade_price_unit || null,
        trade_volume_unit: form.trade_volume_unit || null,
        price_decimal_places: Number(form.price_decimal_places) || 4,
        volume_entry_mode: form.volume_entry_mode || "units",
        basis_unit: form.basis_unit || null,
        basis_reference: form.basis_reference || null,
        basis_sign_convention: form.basis_sign_convention || "positive_above",
        futures_budget_mapping: form.futures_budget_mapping,
        is_active: form.is_active,
        units: units.map((u, i) => ({ ...u, sort_order: i })),
      };
      await apiFetch(`/api/kernel/commodities/${commodity.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setDirty(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-[#378ADD] hover:text-[#378ADD]/80 transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Commodities
          </button>
        </div>
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-[#378ADD] text-white rounded-md hover:bg-[#378ADD]/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save changes"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[#E8ECF1]">{form.display_name || form.name || commodity.id}</h2>
        <span className="px-2 py-0.5 text-xs font-mono bg-[#378ADD]/10 text-[#378ADD] rounded">{commodity.id}</span>
        <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full",
          form.is_active ? "bg-[#1D9E75]/10 text-[#1D9E75]" : "bg-[#556170]/20 text-[#556170]")}>
          {form.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}

      {/* Tabs */}
      <div className="border-b border-[#1E3A5F]">
        <div className="flex gap-0">
          {[
            { key: "setup" as DetailTab, label: "Setup" },
            { key: "units" as DetailTab, label: "Reporting Units" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === t.key ? "border-[#378ADD] text-[#E8ECF1]" : "border-transparent text-[#556170] hover:text-[#8B95A5]"
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "setup" && (
        <SetupTab
          form={form}
          set={set}
          activeLetters={activeLetters}
          priceUnitOptions={priceUnitOptions}
          uomAbbr={uomAbbr ?? ""}
          pricePreview={pricePreview}
          setMapping={setMapping}
        />
      )}
      {tab === "units" && (
        <ReportingUnitsTab
          units={units}
          setUnits={(fn) => { setUnits(fn); setDirty(true); }}
          tradeUnit={form.trade_volume_unit ?? form.unit ?? "bu"}
          contractSize={Number(form.contract_size) || 5000}
          samplePrice={samplePrice}
          priceUnit={form.trade_price_unit ?? "$/bu"}
          priceDecimals={Number(form.price_decimal_places) || 4}
        />
      )}
    </div>
  );
}

// ─── Setup Tab ──────────────────────────────────────────────────────────────

function SetupTab({ form, set, activeLetters, priceUnitOptions, uomAbbr, pricePreview, setMapping }: {
  form: ReturnType<typeof initForm>;
  set: (key: string, value: unknown) => void;
  activeLetters: string[];
  priceUnitOptions: string[];
  uomAbbr: string;
  pricePreview: string;
  setMapping: (m: MonthMappings) => void;
}) {
  const mapping = form.futures_budget_mapping as MonthMappings;

  // Detect preset
  const isGrainPreset = form.contract_months === "HKNUZ" && JSON.stringify(mapping) === JSON.stringify(GRAIN_PRESET);
  const isAll12Preset = form.contract_months === "FGHJKMNQUVXZ" && JSON.stringify(mapping) === JSON.stringify(ALL12_PRESET);
  const presetMode = isGrainPreset ? "grain" : isAll12Preset ? "all12" : "custom";

  function applyPreset(preset: "grain" | "all12") {
    if (preset === "grain") {
      set("contract_months", "HKNUZ");
      setMapping({ ...GRAIN_PRESET });
    } else {
      set("contract_months", "FGHJKMNQUVXZ");
      setMapping({ ...ALL12_PRESET });
    }
  }

  function toggleFuturesMonth(code: string) {
    const current = form.contract_months ?? "";
    let letters = current.split("").filter((ch: string) => /[A-Z]/.test(ch));
    if (letters.includes(code)) {
      letters = letters.filter((l: string) => l !== code);
      // Remove from mapping
      const newMap = { ...mapping };
      delete newMap[code];
      setMapping(newMap);
    } else {
      letters.push(code);
      letters.sort((a: string, b: string) => ALL_FUTURES.findIndex((f) => f.code === a) - ALL_FUTURES.findIndex((f) => f.code === b));
    }
    set("contract_months", letters.join(""));
  }

  function toggleBudgetCell(futuresCode: string, monthNum: number) {
    const newMap = { ...mapping };
    const arr = [...(newMap[futuresCode] ?? [])];
    const idx = arr.indexOf(monthNum);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(monthNum);
    arr.sort((a, b) => a - b);
    newMap[futuresCode] = arr;
    setMapping(newMap);
  }

  // Validation: check coverage
  const allCovered = new Map<number, string[]>();
  for (let m = 1; m <= 12; m++) allCovered.set(m, []);
  for (const [code, months] of Object.entries(mapping)) {
    if (!activeLetters.includes(code)) continue;
    for (const m of months) {
      allCovered.get(m)?.push(code);
    }
  }

  // UOM change: auto-update price unit
  function handleUomChange(uomValue: string) {
    const abbr = UOM_OPTIONS.find((u) => u.value === uomValue)?.abbr ?? uomValue;
    set("trade_volume_unit", abbr);
    const newPriceUnits = PRICE_UNITS_BY_UOM[uomValue] ?? [];
    if (newPriceUnits.length > 0 && !newPriceUnits.includes(form.trade_price_unit ?? "")) {
      set("trade_price_unit", newPriceUnits[0]);
    }
  }

  // Summary line for budget mapping
  const summaryParts = activeLetters.map((code) => {
    const months = (mapping[code] ?? []).map((m) => MONTH_ABBR[m - 1]);
    return `${code} covers ${months.join(", ") || "none"}`;
  });

  return (
    <div className="space-y-4">
      {/* SECTION 1: Identity */}
      <div className={sectionCard}>
        <p className={sectionLabel}>Identity</p>
        <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-3">
          <div>
            <label className={fieldLabel}>Code</label>
            <input value={form.id} readOnly className={readOnlyInput + " font-mono"} />
          </div>
          <div>
            <label className={fieldLabel}>Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldInput} />
          </div>
          <div>
            <label className={fieldLabel}>Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className={fieldSelect}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Active</label>
            <ToggleSwitch checked={form.is_active} onChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-3">
          <div>
            <label className={fieldLabel}>Ticker root</label>
            <input value={form.ticker_root} onChange={(e) => set("ticker_root", e.target.value)} className={fieldInput + " font-mono"} placeholder="ZC" />
          </div>
          <div>
            <label className={fieldLabel}>Exchange</label>
            <select value={form.exchange} onChange={(e) => set("exchange", e.target.value)} className={fieldSelect}>
              <option value="">—</option>
              {EXCHANGES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Currency</label>
            <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={fieldSelect}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div />
        </div>
      </div>

      {/* SECTION 2: Contract & Pricing */}
      <div className={sectionCard}>
        <p className={sectionLabel}>Contract & Pricing</p>
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className={fieldLabel}>Contract size</label>
            <div className="flex">
              <input type="number" step="any" value={form.contract_size}
                onChange={(e) => set("contract_size", e.target.value)}
                className={fieldInput + " rounded-r-none border-r-0"} placeholder="5000" />
              <span className="bg-[#1A2740] border border-[#1E3A5F] border-l-0 rounded-r-md px-2 py-[7px] text-[10px] text-[#556170] flex items-center">
                {uomAbbr}
              </span>
            </div>
          </div>
          <div>
            <label className={fieldLabel}>Tick size</label>
            <input type="number" step="any" value={form.tick_size} onChange={(e) => set("tick_size", e.target.value)}
              className={fieldInput} placeholder="0.0025" />
          </div>
          <div>
            <label className={fieldLabel}>Tick value ($)</label>
            <input type="number" step="any" value={form.tick_value} onChange={(e) => set("tick_value", e.target.value)}
              className={fieldInput} placeholder="12.50" />
          </div>
          <div>
            <label className={fieldLabel}>UOM (trade)</label>
            <select value={UOM_OPTIONS.find((u) => u.abbr === form.trade_volume_unit)?.value ?? form.trade_volume_unit}
              onChange={(e) => handleUomChange(e.target.value)} className={fieldSelect}>
              {UOM_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.value}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Price unit</label>
            <select value={form.trade_price_unit} onChange={(e) => set("trade_price_unit", e.target.value)} className={fieldSelect}>
              {priceUnitOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className={fieldLabel}>Decimals</label>
            <select value={form.price_decimal_places} onChange={(e) => set("price_decimal_places", e.target.value)} className={fieldSelect}>
              {DECIMALS_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Volume entry</label>
            <select value={form.volume_entry_mode} onChange={(e) => set("volume_entry_mode", e.target.value)} className={fieldSelect}>
              {UOM_OPTIONS.map((u) => <option key={u.value} value={u.abbr}>{u.value}</option>)}
              <option value="contracts">Contracts</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={fieldLabel}>Price preview</label>
            <div className="bg-[#0B1426] border border-[#1E3A5F] rounded-md px-3 py-[7px] text-sm font-mono text-[#1D9E75]">
              {pricePreview}
            </div>
          </div>
          <div />
        </div>
      </div>

      {/* SECTION 3: Futures Months & Budget Mapping */}
      <div className={sectionCard}>
        {/* PART A: Active Futures Months */}
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Futures Months</p>
          <div className="flex items-center gap-2">
            <button onClick={() => applyPreset("grain")} className={presetMode === "grain" ? presetActive : presetInactive}>
              Grain (HKNUZ)
            </button>
            <button onClick={() => applyPreset("all12")} className={presetMode === "all12" ? presetActive : presetInactive}>
              All 12 — 1:1
            </button>
            <span className={presetMode === "custom" ? presetActive : presetInactive}>Custom</span>
          </div>
        </div>

        {/* 12-column month grid */}
        <div className="grid grid-cols-12 gap-1.5">
          {ALL_FUTURES.map((f) => {
            const isActive = activeLetters.includes(f.code);
            return (
              <button key={f.code} onClick={() => toggleFuturesMonth(f.code)}
                className={cn(
                  "text-center py-2 rounded-md transition-colors",
                  isActive ? "bg-[#378ADD] text-white" : "bg-[#1A2740] text-[#556170]"
                )}>
                <span className="block text-sm font-semibold font-mono">{f.code}</span>
                <span className="block text-[9px]">{f.name.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-[#556170]">
          Active: {activeLetters.join(" ") || "none"} · Click to toggle
        </p>

        {/* PART B: Budget Month Mapping */}
        {activeLetters.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className={sectionLabel}>Budget Month Mapping</p>
                <p className="text-[10px] text-[#556170]">Which budget/delivery months does each futures contract cover?</p>
              </div>
              <button onClick={() => {
                // Reset to default based on current active months
                if (activeLetters.join("") === "HKNUZ") setMapping({ ...GRAIN_PRESET });
                else if (activeLetters.length === 12) setMapping({ ...ALL12_PRESET });
              }} className={presetInactive}>Reset to default</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1.5 text-[10px] font-medium text-[#556170] uppercase w-20">Futures</th>
                    {MONTH_ABBR.map((m, idx) => {
                      const monthNum = idx + 1;
                      const covers = allCovered.get(monthNum) ?? [];
                      const uncovered = covers.length === 0;
                      const doubleCovered = covers.length > 1;
                      return (
                        <th key={m} className={cn(
                          "px-0.5 py-1.5 text-center text-[10px] font-medium uppercase w-8",
                          uncovered ? "text-[#E24B4A]" : doubleCovered ? "text-[#EF9F27]" : "text-[#556170]"
                        )}>{m}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {activeLetters.map((code) => {
                    const fm = ALL_FUTURES.find((f) => f.code === code);
                    return (
                      <tr key={code}>
                        <td className="px-2 py-1.5">
                          <span className="text-sm font-mono font-semibold text-[#378ADD]">{code}</span>
                          <span className="text-[10px] text-[#8B95A5] ml-1.5">{fm?.name ?? ""}</span>
                        </td>
                        {MONTH_ABBR.map((m, idx) => {
                          const monthNum = idx + 1;
                          const isSelected = (mapping[code] ?? []).includes(monthNum);
                          return (
                            <td key={idx} className="px-0.5 py-1.5 text-center">
                              <button onClick={() => toggleBudgetCell(code, monthNum)}
                                className={cn(
                                  "inline-flex items-center justify-center h-7 w-7 rounded-md text-[10px] font-medium transition-colors",
                                  isSelected ? "bg-[#378ADD] text-white" : "bg-[#1A2740] text-[#556170]"
                                )}>
                                {m}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Validation warnings */}
            {Array.from(allCovered.entries()).some(([, codes]) => codes.length === 0) && (
              <p className="text-[10px] text-[#E24B4A]">
                Warning: {Array.from(allCovered.entries()).filter(([, codes]) => codes.length === 0).map(([m]) => MONTH_ABBR[m - 1]).join(", ")} not covered by any futures month.
              </p>
            )}
            {Array.from(allCovered.entries()).some(([, codes]) => codes.length > 1) && (
              <p className="text-[10px] text-[#EF9F27]">
                Warning: {Array.from(allCovered.entries()).filter(([, codes]) => codes.length > 1).map(([m]) => MONTH_ABBR[m - 1]).join(", ")} covered by multiple futures months.
              </p>
            )}

            {/* Summary */}
            <p className="text-[10px] text-[#556170]">{summaryParts.join(" · ")}</p>
            <p className="text-[10px] text-[#556170]">Every calendar month must be covered by exactly one futures month.</p>
          </>
        )}
      </div>

      {/* SECTION 4: Basis Configuration */}
      <div className={sectionCard}>
        <p className={sectionLabel}>Basis Configuration</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={fieldLabel}>Basis unit</label>
            <select value={form.basis_unit} onChange={(e) => set("basis_unit", e.target.value)} className={fieldSelect}>
              <option value="">—</option>
              {BASIS_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Basis reference</label>
            <input value={form.basis_reference} onChange={(e) => set("basis_reference", e.target.value)}
              className={fieldInput} placeholder="CBOT settlement" />
          </div>
          <div>
            <label className={fieldLabel}>Sign convention</label>
            <select value={form.basis_sign_convention} onChange={(e) => set("basis_sign_convention", e.target.value)} className={fieldSelect}>
              {SIGN_CONVENTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reporting Units Tab ────────────────────────────────────────────────────

function ReportingUnitsTab({ units, setUnits, tradeUnit, contractSize, samplePrice, priceUnit, priceDecimals }: {
  units: CommodityUnit[];
  setUnits: (fn: (prev: CommodityUnit[]) => CommodityUnit[]) => void;
  tradeUnit: string;
  contractSize: number;
  samplePrice: number;
  priceUnit: string;
  priceDecimals: number;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newUnit, setNewUnit] = useState<CommodityUnit>({ unit_name: "", abbreviation: "", to_trade_unit: 1, from_trade_unit: 1, is_default_report: false, sort_order: 0 });

  // Determine the trade-unit row (always first)
  const tradeAbbr = tradeUnit;
  const tradeUnitObj: CommodityUnit = { unit_name: UOM_OPTIONS.find((u) => u.abbr === tradeAbbr)?.value ?? tradeAbbr, abbreviation: tradeAbbr, to_trade_unit: 1, from_trade_unit: 1, is_default_report: !units.some((u) => u.is_default_report), sort_order: -1 };

  function updateUnit(index: number, key: keyof CommodityUnit, value: unknown) {
    setUnits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      // Auto-calculate reciprocal
      if (key === "to_trade_unit" && typeof value === "number" && value > 0) {
        next[index].from_trade_unit = Number((1 / value).toFixed(4));
      }
      if (key === "from_trade_unit" && typeof value === "number" && value > 0) {
        next[index].to_trade_unit = Number((1 / value).toFixed(4));
      }
      // Only one default
      if (key === "is_default_report" && value === true) {
        next.forEach((u, i) => { if (i !== index) u.is_default_report = false; });
      }
      return next;
    });
  }

  function handleAddSave() {
    if (!newUnit.unit_name || !newUnit.abbreviation) return;
    setUnits((prev) => [...prev, { ...newUnit, sort_order: prev.length, is_default_report: prev.length === 0 && !newUnit.is_default_report ? true : newUnit.is_default_report }]);
    setAddingNew(false);
    setNewUnit({ unit_name: "", abbreviation: "", to_trade_unit: 1, from_trade_unit: 1, is_default_report: false, sort_order: 0 });
  }

  function removeUnit(index: number) {
    setUnits((prev) => prev.filter((_, i) => i !== index));
  }

  function setDefaultReport(index: number | "trade") {
    if (index === "trade") {
      // Unset all units' default
      setUnits((prev) => prev.map((u) => ({ ...u, is_default_report: false })));
    } else {
      setUnits((prev) => prev.map((u, i) => ({ ...u, is_default_report: i === index })));
    }
  }

  const isTradeDefault = !units.some((u) => u.is_default_report);

  return (
    <div className="space-y-4">
      {/* SECTION 1: Unit Conversions */}
      <div className={sectionCard}>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Unit Conversions</p>
          <button onClick={() => setAddingNew(true)} className={cn(btnPrimary, "text-xs")}>
            <Plus className="h-3.5 w-3.5" /> Add unit
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1E3A5F]">
                {["Unit Name","Abbreviation","1 Trade Unit =","1 Report Unit =","Default Report","",""].map((h) => (
                  <th key={h} className="text-left px-2 py-2 text-[10px] font-medium text-[#556170] uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Trade unit row (read-only) */}
              <tr className={cn("border-b border-[#1E3A5F]/50", isTradeDefault && "bg-[#378ADD]/[0.04]")}>
                <td className="px-2 py-2.5 text-[13px] text-[#E8ECF1]">
                  {tradeUnitObj.unit_name}
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-[#378ADD]/10 text-[#378ADD] rounded">trade unit</span>
                </td>
                <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">{tradeAbbr}</td>
                <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">1.0000</td>
                <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">1.0000</td>
                <td className="px-2 py-2.5">
                  <RadioDot selected={isTradeDefault} onClick={() => setDefaultReport("trade")} />
                </td>
                <td />
                <td />
              </tr>
              {/* Additional units */}
              {units.map((u, i) => (
                <tr key={i} className={cn("border-b border-[#1E3A5F]/50 hover:bg-[#1A2740]",
                  u.is_default_report && "bg-[#378ADD]/[0.04]")}>
                  {editingIdx === i ? (
                    <>
                      <td className="px-2 py-2"><input value={u.unit_name} onChange={(e) => updateUnit(i, "unit_name", e.target.value)} className={fieldInput + " text-xs"} /></td>
                      <td className="px-2 py-2"><input value={u.abbreviation} onChange={(e) => updateUnit(i, "abbreviation", e.target.value)} className={fieldInput + " font-mono text-xs"} /></td>
                      <td className="px-2 py-2"><input type="number" step="any" value={u.to_trade_unit} onChange={(e) => updateUnit(i, "to_trade_unit", Number(e.target.value))} className={fieldInput + " font-mono text-xs"} /></td>
                      <td className="px-2 py-2"><input type="number" step="any" value={u.from_trade_unit} onChange={(e) => updateUnit(i, "from_trade_unit", Number(e.target.value))} className={fieldInput + " font-mono text-xs"} /></td>
                      <td className="px-2 py-2"><RadioDot selected={u.is_default_report} onClick={() => setDefaultReport(i)} /></td>
                      <td className="px-2 py-2"><button onClick={() => setEditingIdx(null)} className="text-[#1D9E75] hover:text-[#1D9E75]/80"><Check className="h-3.5 w-3.5" /></button></td>
                      <td />
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2.5 text-[13px] text-[#E8ECF1]">{u.unit_name}</td>
                      <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">{u.abbreviation}</td>
                      <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">{Number(u.to_trade_unit).toFixed(4)}</td>
                      <td className="px-2 py-2.5 font-mono text-[#E8ECF1]">{Number(u.from_trade_unit).toFixed(4)}</td>
                      <td className="px-2 py-2.5"><RadioDot selected={u.is_default_report} onClick={() => setDefaultReport(i)} /></td>
                      <td className="px-2 py-2.5"><button onClick={() => setEditingIdx(i)} className="text-[#556170] hover:text-[#8B95A5]"><Pencil className="h-3.5 w-3.5" /></button></td>
                      <td className="px-2 py-2.5"><button onClick={() => removeUnit(i)} className="text-[#556170] hover:text-[#E24B4A]"><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </>
                  )}
                </tr>
              ))}
              {/* Add new row */}
              {addingNew && (
                <tr className="border-b border-[#1E3A5F]/50 bg-action/5">
                  <td className="px-2 py-2"><input value={newUnit.unit_name} onChange={(e) => setNewUnit((n) => ({ ...n, unit_name: e.target.value }))} className={fieldInput + " text-xs"} placeholder="Metric tons" autoFocus /></td>
                  <td className="px-2 py-2"><input value={newUnit.abbreviation} onChange={(e) => setNewUnit((n) => ({ ...n, abbreviation: e.target.value }))} className={fieldInput + " font-mono text-xs"} placeholder="MT" /></td>
                  <td className="px-2 py-2">
                    <input type="number" step="any" value={newUnit.to_trade_unit}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setNewUnit((n) => ({ ...n, to_trade_unit: v, from_trade_unit: v > 0 ? Number((1 / v).toFixed(4)) : 0 }));
                      }} className={fieldInput + " font-mono text-xs"} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="any" value={newUnit.from_trade_unit}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setNewUnit((n) => ({ ...n, from_trade_unit: v, to_trade_unit: v > 0 ? Number((1 / v).toFixed(4)) : 0 }));
                      }} className={fieldInput + " font-mono text-xs"} />
                  </td>
                  <td className="px-2 py-2"><RadioDot selected={false} onClick={() => setNewUnit((n) => ({ ...n, is_default_report: true }))} /></td>
                  <td className="px-2 py-2">
                    <button onClick={handleAddSave} className="text-[#1D9E75] hover:text-[#1D9E75]/80"><Check className="h-3.5 w-3.5" /></button>
                  </td>
                  <td className="px-2 py-2">
                    <button onClick={() => setAddingNew(false)} className="text-[#556170] hover:text-[#8B95A5]"><X className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Live Preview */}
      <div className={sectionCard}>
        <p className={sectionLabel}>Live Preview</p>
        <p className="text-[11px] text-[#556170]">
          How a position of {contractSize.toLocaleString()} {tradeUnit} at {formatPreview(samplePrice, priceUnit, priceDecimals)} displays in each unit:
        </p>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {/* Trade unit card */}
          <PreviewCard
            label={tradeUnitObj.unit_name}
            isDefault={isTradeDefault}
            volume={contractSize}
            volumeAbbr={tradeAbbr}
            price={samplePrice}
            priceUnit={priceUnit}
            totalValue={contractSize * samplePrice}
            priceDecimals={priceDecimals}
          />
          {/* Report unit cards */}
          {units.map((u, i) => {
            const vol = contractSize * u.from_trade_unit;
            const convertedPrice = u.to_trade_unit > 0 ? samplePrice / u.from_trade_unit : samplePrice;
            return (
              <PreviewCard
                key={i}
                label={u.unit_name}
                isDefault={u.is_default_report}
                volume={vol}
                volumeAbbr={u.abbreviation}
                price={convertedPrice}
                priceUnit={`$/${u.abbreviation}`}
                totalValue={contractSize * samplePrice}
                priceDecimals={priceDecimals}
              />
            );
          })}
        </div>

        <p className="text-[10px] text-[#556170]">
          Total value is always the same — only the unit expression changes.
          The default reporting unit is used on dashboards, reports, and exports.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors mt-0.5",
        checked ? "bg-[#1D9E75]" : "bg-[#1A2740]"
      )}>
      <span className={cn(
        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
        checked ? "translate-x-4" : "translate-x-0.5"
      )} />
    </button>
  );
}

function RadioDot({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
        selected ? "border-[#378ADD] bg-[#378ADD]" : "border-[#556170]"
      )}>
      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </button>
  );
}

function PreviewCard({ label, isDefault, volume, volumeAbbr, price, priceUnit, totalValue, priceDecimals }: {
  label: string;
  isDefault: boolean;
  volume: number;
  volumeAbbr: string;
  price: number;
  priceUnit: string;
  totalValue: number;
  priceDecimals: number;
}) {
  return (
    <div className={cn(
      "bg-[#1A2740] rounded-md p-3",
      isDefault && "border border-[#378ADD]/30"
    )}>
      <p className={cn("text-[10px] uppercase mb-1", isDefault ? "text-[#378ADD]" : "text-[#556170]")}>
        {label} {isDefault && "(default)"}
      </p>
      <p className="text-base font-semibold font-mono text-[#E8ECF1]">
        {volume.toLocaleString("en-US", { maximumFractionDigits: 2 })} {volumeAbbr}
      </p>
      <p className="text-xs font-mono text-[#8B95A5]">
        {formatPreview(price, priceUnit, priceDecimals)}
      </p>
      <p className="text-xs font-mono text-[#1D9E75]">
        ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function initForm(commodity: Commodity) {
  const c = commodity;
  return {
    id: c.id,
    name: c.name ?? "",
    display_name: c.display_name ?? c.name ?? "",
    category: c.category ?? "ag",
    commodity_class: c.commodity_class ?? c.category ?? "grains",
    unit: c.unit ?? "MT",
    currency: c.currency ?? "USD",
    exchange: c.exchange ?? "",
    ticker_root: c.ticker_root ?? "",
    contract_size: c.contract_size != null ? String(c.contract_size) : "",
    tick_size: c.tick_size != null ? String(c.tick_size) : "",
    tick_value: c.tick_value != null ? String(c.tick_value) : "",
    point_value: c.point_value != null ? String(c.point_value) : "",
    contract_months: c.contract_months ?? "",
    trade_price_unit: c.trade_price_unit ?? "",
    trade_volume_unit: c.trade_volume_unit ?? c.unit ?? "",
    price_decimal_places: c.price_decimal_places ?? 4,
    volume_entry_mode: c.volume_entry_mode ?? "units",
    basis_unit: c.basis_unit ?? "",
    basis_reference: c.basis_reference ?? "",
    basis_sign_convention: c.basis_sign_convention ?? "positive_above",
    futures_budget_mapping: c.futures_budget_mapping ?? (c.config as Record<string, unknown>)?.month_mappings as MonthMappings ?? {},
    is_active: c.is_active ?? true,
  };
}

function formatPreview(value: number, unit: string, decimals: number): string {
  if (unit.startsWith("cents")) return `${value.toFixed(decimals)} ${unit}`;
  if (unit.startsWith("$")) return `$${value.toFixed(decimals)}${unit.replace("$", "").replace("/", "/") ? "/" + unit.split("/")[1] : ""}`;
  return `${value.toFixed(decimals)} ${unit}`;
}
