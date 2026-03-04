"use client";

import React, { useState, useEffect } from "react";
import { Edit2 } from "lucide-react";
import { useOrgContext } from "@/contexts/OrgContext";
import { apiFetch, btnPrimary, btnCancel, cn } from "./shared";

const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

const CBOT_LETTERS: Record<string, string> = {
  H: "March", K: "May", N: "July", U: "September", Z: "December",
};

type MappingState = Record<string, number[]>;

export function FuturesMonthsTab() {
  const { orgId } = useOrgContext();
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultMappings: MappingState = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
  const [mappings, setMappings] = useState<MappingState>(defaultMappings);
  const [draft, setDraft] = useState<MappingState | null>(null);

  useEffect(() => {
    apiFetch(`/api/v2/kernel/org-settings?orgId=${orgId}`)
      .then(data => {
        // Read flat field from org_settings row (not nested config)
        const fm = data?.futures_month_mappings;
        if (fm && typeof fm === "object" && Object.keys(fm).length > 0) setMappings(fm);
      })
      .catch(() => {});
  }, [orgId]);

  const active = editMode && draft ? draft : mappings;

  function startEdit() { setDraft(JSON.parse(JSON.stringify(mappings))); setEditMode(true); }
  function cancelEdit() { setDraft(null); setEditMode(false); }

  function toggleMonth(letter: string, monthNum: number) {
    if (!draft) return;
    setDraft(prev => {
      const next = { ...prev! };
      const arr = [...(next[letter] ?? [])];
      const idx = arr.indexOf(monthNum);
      if (idx >= 0) arr.splice(idx, 1); else arr.push(monthNum);
      arr.sort((a, b) => a - b);
      next[letter] = arr;
      return next;
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v2/kernel/org-settings`, {
        method: "PATCH",
        body: JSON.stringify({ orgId, futures_month_mappings: draft }),
      });
      setMappings(draft); setEditMode(false); setDraft(null);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  const letters = Object.keys(CBOT_LETTERS);

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-sm text-loss">{error}</div>}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">CBOT contract codes mapped to physical delivery months</p>
        {!editMode ? (
          <button onClick={startEdit} className={btnPrimary}><Edit2 className="h-4 w-4" /> Edit Mappings</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} className={btnCancel}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? "Saving..." : "Save Mappings"}</button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-input-bg/50 border-b border-b-default">
            <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Letter</th>
            <th className="text-left px-3 py-3 text-xs font-medium text-muted uppercase tracking-wider">Contract</th>
            {MONTH_ABBR.map(m => <th key={m} className="px-2 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-12">{m}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-b-default">
            {letters.map(letter => (
              <tr key={letter} className="hover:bg-row-hover transition-colors">
                <td className="px-3 py-3 font-mono text-lg font-bold text-action">{letter}</td>
                <td className="px-3 py-3 text-secondary">{CBOT_LETTERS[letter]}</td>
                {MONTH_ABBR.map((_, i) => {
                  const monthNum = i + 1;
                  const isSelected = (active[letter] ?? []).includes(monthNum);
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      {editMode ? (
                        <button type="button" onClick={() => toggleMonth(letter, monthNum)}
                          className={cn("h-7 w-7 rounded-md text-xs font-medium transition-colors",
                            isSelected ? "bg-action text-white" : "bg-input-bg text-ph hover:bg-hover hover:text-muted")}>
                          {MONTH_ABBR[i]}
                        </button>
                      ) : isSelected ? (
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-action-20 text-action text-xs font-medium">{MONTH_ABBR[i]}</span>
                      ) : <span className="text-ph">-</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        {letters.map(letter => (
          <p key={letter} className="text-xs text-faint">
            <span className="font-mono text-muted">{letter}</span> = {CBOT_LETTERS[letter]} contract &rarr; {(active[letter] ?? []).map(m => MONTH_ABBR[m - 1]).join(", ") || "none"}
          </p>
        ))}
      </div>
    </div>
  );
}
