"use client";

import React, { useState, useEffect } from "react";
import { useOrgContext } from "@/contexts/OrgContext";
import { apiFetch, btnPrimary, inputCls, selectCls, cn } from "./shared";
import { TableSkeleton } from "./SharedUI";

interface OrgSettings {
  default_currency: string;
  reporting_currency: string;
  timezone: string;
  date_format: string;
  number_format: string;
  default_exchange: string;
  default_broker: string;
  default_account: string;
  commission_default: number;
  budget_lock_after_approval: boolean;
  budget_variance_threshold: number;
  mtm_auto_run: boolean;
  mtm_run_time: string;
  position_limit_hard_block: boolean;
  roll_critical_days: number;
  roll_urgent_days: number;
  roll_upcoming_days: number;
  roll_auto_notify: boolean;
  roll_require_approval_critical: boolean;
  roll_default_target: string;
  roll_budget_month_policy: string;
  roll_cost_allocation: string;
  import_require_approval: boolean;
  import_auto_template: boolean;
  [key: string]: unknown;
}

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "BRL", "MXN", "JPY", "CHF"];
const TIMEZONES = [
  "America/Chicago", "America/New_York", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Winnipeg", "America/Edmonton", "America/Vancouver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney",
  "UTC",
];
const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];
const NUMBER_FORMATS = ["1,000.00", "1.000,00", "1 000,00"];
const EXCHANGES = ["CBOT", "CME", "ICE", "NYMEX", "LME", "EUREX"];
const ROLL_TARGETS = [
  { value: "next_active", label: "Next Active" },
  { value: "next_month", label: "Next Month" },
  { value: "same_crop_year", label: "Same Crop Year" },
];
const BUDGET_MONTH_POLICIES = [
  { value: "keep_original", label: "Keep Original" },
  { value: "move_to_new", label: "Move to New" },
  { value: "split", label: "Split" },
];
const COST_ALLOCATIONS = [
  { value: "site", label: "Site" },
  { value: "trade", label: "Trade" },
  { value: "pro_rata", label: "Pro-rata" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        checked ? "bg-action" : "bg-input-bg border border-b-input")}>
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform",
        checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-b-default rounded-lg p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-secondary">{title}</h3>
        {description && <p className="text-xs text-faint mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function OrgSettingsTab() {
  const { orgId } = useOrgContext();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`)
      .then(data => setSettings(data))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [orgId]);

  function update(field: string, value: unknown) {
    setSettings(prev => prev ? { ...prev, [field]: value } : prev);
    setSuccess(false);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Record<string, unknown> = { orgId };
      const fields = [
        "default_currency", "reporting_currency", "timezone", "date_format", "number_format",
        "default_exchange", "default_broker", "default_account", "commission_default",
        "budget_lock_after_approval", "budget_variance_threshold",
        "mtm_auto_run", "mtm_run_time", "position_limit_hard_block",
        "roll_critical_days", "roll_urgent_days", "roll_upcoming_days",
        "roll_auto_notify", "roll_require_approval_critical",
        "roll_default_target", "roll_budget_month_policy", "roll_cost_allocation",
        "import_require_approval", "import_auto_template",
      ];
      for (const f of fields) {
        payload[f] = settings[f];
      }
      const updated = await apiFetch(`/api/v2/kernel/org-settings`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      setSuccess(true);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <TableSkeleton />;
  if (!settings) return <div className="text-sm text-muted">Failed to load settings.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      {success && <div className="p-3 bg-profit/10 border border-profit/20 rounded-lg text-sm text-profit">Settings saved successfully.</div>}

      {/* General */}
      <SectionCard title="General" description="Currency, timezone, and display formats.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Default Currency</label>
            <select className={selectCls} value={settings.default_currency ?? "USD"} onChange={e => update("default_currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Reporting Currency</label>
            <select className={selectCls} value={settings.reporting_currency ?? "USD"} onChange={e => update("reporting_currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Timezone</label>
            <select className={selectCls} value={settings.timezone ?? "America/Chicago"} onChange={e => update("timezone", e.target.value)}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Date Format</label>
            <select className={selectCls} value={settings.date_format ?? "MM/DD/YYYY"} onChange={e => update("date_format", e.target.value)}>
              {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Number Format</label>
            <select className={selectCls} value={settings.number_format ?? "1,000.00"} onChange={e => update("number_format", e.target.value)}>
              {NUMBER_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Trading Defaults */}
      <SectionCard title="Trading Defaults" description="Default exchange, broker, and commission settings.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Default Exchange</label>
            <select className={selectCls} value={settings.default_exchange ?? "CBOT"} onChange={e => update("default_exchange", e.target.value)}>
              {EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Default Broker</label>
            <input type="text" className={inputCls} value={settings.default_broker ?? ""} onChange={e => update("default_broker", e.target.value)} placeholder="Broker name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Default Account</label>
            <input type="text" className={inputCls} value={settings.default_account ?? ""} onChange={e => update("default_account", e.target.value)} placeholder="Account ID" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Commission Default</label>
            <input type="number" step="0.01" min="0" className={inputCls} value={settings.commission_default ?? 0} onChange={e => update("commission_default", parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </SectionCard>

      {/* Budget */}
      <SectionCard title="Budget" description="Budget approval and variance settings.">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Lock After Approval</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.budget_lock_after_approval ?? false} onChange={v => update("budget_lock_after_approval", v)} />
              <span className="text-sm text-secondary">{settings.budget_lock_after_approval ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Variance Threshold (%)</label>
            <input type="number" step="1" min="0" max="100" className={inputCls} value={settings.budget_variance_threshold ?? 10} onChange={e => update("budget_variance_threshold", parseInt(e.target.value) || 0)} />
          </div>
        </div>
      </SectionCard>

      {/* Risk */}
      <SectionCard title="Risk" description="Mark-to-market and position limit settings.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Auto MTM Run</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.mtm_auto_run ?? true} onChange={v => update("mtm_auto_run", v)} />
              <span className="text-sm text-secondary">{settings.mtm_auto_run ? "Enabled" : "Disabled"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">MTM Run Time</label>
            <input type="time" className={inputCls} value={settings.mtm_run_time ?? "16:30"} onChange={e => update("mtm_run_time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Hard Block on Limit</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.position_limit_hard_block ?? false} onChange={v => update("position_limit_hard_block", v)} />
              <span className="text-sm text-secondary">{settings.position_limit_hard_block ? "Block" : "Warn Only"}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Rollover */}
      <SectionCard title="Rollover" description="Rollover thresholds, notifications, and policies.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Critical Days</label>
            <input type="number" min="1" className={inputCls} value={settings.roll_critical_days ?? 3} onChange={e => update("roll_critical_days", parseInt(e.target.value) || 3)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Urgent Days</label>
            <input type="number" min="1" className={inputCls} value={settings.roll_urgent_days ?? 7} onChange={e => update("roll_urgent_days", parseInt(e.target.value) || 7)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Upcoming Days</label>
            <input type="number" min="1" className={inputCls} value={settings.roll_upcoming_days ?? 21} onChange={e => update("roll_upcoming_days", parseInt(e.target.value) || 21)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Auto Notify</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.roll_auto_notify ?? true} onChange={v => update("roll_auto_notify", v)} />
              <span className="text-sm text-secondary">{settings.roll_auto_notify ? "On" : "Off"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Require Approval (Critical)</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.roll_require_approval_critical ?? true} onChange={v => update("roll_require_approval_critical", v)} />
              <span className="text-sm text-secondary">{settings.roll_require_approval_critical ? "Required" : "Optional"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Default Target</label>
            <select className={selectCls} value={settings.roll_default_target ?? "next_active"} onChange={e => update("roll_default_target", e.target.value)}>
              {ROLL_TARGETS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Budget Month Policy</label>
            <select className={selectCls} value={settings.roll_budget_month_policy ?? "keep_original"} onChange={e => update("roll_budget_month_policy", e.target.value)}>
              {BUDGET_MONTH_POLICIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Cost Allocation</label>
            <select className={selectCls} value={settings.roll_cost_allocation ?? "site"} onChange={e => update("roll_cost_allocation", e.target.value)}>
              {COST_ALLOCATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Import */}
      <SectionCard title="Import" description="AI import engine settings.">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Require Approval</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.import_require_approval ?? true} onChange={v => update("import_require_approval", v)} />
              <span className="text-sm text-secondary">{settings.import_require_approval ? "Required" : "Auto-import"}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Auto Template Detection</label>
            <div className="flex items-center gap-2 h-[38px]">
              <Toggle checked={settings.import_auto_template ?? true} onChange={v => update("import_auto_template", v)} />
              <span className="text-sm text-secondary">{settings.import_auto_template ? "Enabled" : "Manual"}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? "Saving..." : "Save All Settings"}
        </button>
      </div>
    </div>
  );
}
