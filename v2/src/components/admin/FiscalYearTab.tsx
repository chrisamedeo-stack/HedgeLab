"use client";

import React, { useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { useOrgContext } from "@/contexts/OrgContext";
import { apiFetch, btnPrimary, selectCls } from "./shared";
import { TableSkeleton } from "./SharedUI";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export function FiscalYearTab() {
  const { orgId } = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`)
      .then(data => {
        // Read flat field from org_settings row (not nested config)
        const fy = data?.fiscal_year_start;
        if (fy) setMonth(fy);
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [orgId]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() + 1 >= month ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  const startLabel = MONTH_ABBR[month - 1];
  const endMonthIdx = month === 1 ? 11 : month - 2;
  const endLabel = MONTH_ABBR[endMonthIdx];

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/v2/kernel/org-settings`, {
        method: "PATCH",
        body: JSON.stringify({ orgId, fiscal_year_start: month }),
      });
      setError(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="max-w-lg space-y-6">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="bg-surface border border-b-default rounded-lg p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-secondary">Fiscal Year Start Month</h3>
          <p className="text-xs text-faint mt-1">The month when each fiscal year begins. Budget lines are grouped into fiscal years based on this setting.</p>
        </div>
        <div className="space-y-1"><label className="text-xs text-muted">Start Month</label>
          <select className={selectCls} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
          </select>
        </div>
        <div className="p-4 bg-input-bg/50 rounded-lg">
          <p className="text-xs text-faint mb-1">Preview</p>
          <p className="text-sm font-semibold text-secondary">FY {startYear}/{endYear} = {startLabel} {startYear} &ndash; {endLabel} {endYear}</p>
        </div>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
      </div>
      <div className="flex items-start gap-2 px-4 py-3 bg-warning-10 border border-warning-20 rounded-lg">
        <Calendar className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning">Changing the fiscal year start month affects how new budget lines are grouped. Existing budget lines will not be retroactively updated.</p>
      </div>
    </div>
  );
}
