"use client";

import React, { useState } from "react";
import { ChevronRight, Lock, Plus, X } from "lucide-react";
import { apiFetch, inputCls, cn } from "../shared";
import type { HierarchyLevel } from "@/types/org";

interface Props {
  orgId: string;
  levels: HierarchyLevel[];
  userId: string;
  onChanged: () => void;
}

export function LevelEditor({ orgId, levels, userId, onChanged }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [addingLabel, setAddingLabel] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const nonSiteLevels = levels.filter((l) => !l.is_site_level);
  const siteLevel = levels.find((l) => l.is_site_level);

  function startEdit(idx: number) {
    setEditIdx(idx);
    setEditLabel(nonSiteLevels[idx].label);
    setShowAdd(false);
  }

  async function saveEdit() {
    if (!editLabel.trim() || editIdx === null) return;
    setSaving(true);
    const updated = levels.map((l) =>
      l.id === nonSiteLevels[editIdx].id ? { ...l, label: editLabel.trim() } : l
    );
    try {
      await apiFetch("/api/kernel/org-hierarchy/levels", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          userId,
          levels: updated.map((l) => ({
            depth: l.level_depth,
            label: l.label,
            is_site_level: l.is_site_level,
          })),
        }),
      });
      setEditIdx(null);
      onChanged();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!addingLabel.trim()) return;
    setSaving(true);
    // Insert new level just before site level
    const siteLevelDepth = siteLevel ? siteLevel.level_depth : levels.length;
    const newLevels = [
      ...nonSiteLevels.map((l, i) => ({
        depth: i,
        label: l.label,
        is_site_level: false,
      })),
      { depth: nonSiteLevels.length, label: addingLabel.trim(), is_site_level: false },
      ...(siteLevel
        ? [{ depth: nonSiteLevels.length + 1, label: siteLevel.label, is_site_level: true }]
        : []),
    ];

    if (newLevels.length > 6) {
      setSaving(false);
      return;
    }

    try {
      await apiFetch("/api/kernel/org-hierarchy/levels", {
        method: "POST",
        body: JSON.stringify({ orgId, userId, levels: newLevels }),
      });
      setAddingLabel("");
      setShowAdd(false);
      onChanged();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(level: HierarchyLevel) {
    setSaving(true);
    try {
      await apiFetch(
        `/api/kernel/org-hierarchy/levels?orgId=${orgId}&levelId=${level.id}`,
        { method: "DELETE" }
      );
      onChanged();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  const totalLevels = levels.length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {nonSiteLevels.map((level, idx) => (
        <React.Fragment key={level.id}>
          {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0" />}
          <div className="relative group">
            {editIdx === idx ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  className={cn(inputCls, "text-xs py-1 px-2 w-28")}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditIdx(null);
                  }}
                  autoFocus
                  disabled={saving}
                />
              </div>
            ) : (
              <button
                onClick={() => startEdit(idx)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-overlay border border-b-default rounded-lg hover:border-action/50 transition-colors"
              >
                <span className="text-[10px] text-faint font-mono">{idx}</span>
                <span className="text-secondary">{level.label}</span>
              </button>
            )}
            {/* Remove button — only if no units at this depth */}
            {editIdx !== idx && totalLevels > 2 && (
              <button
                onClick={() => handleRemove(level)}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-surface border border-destructive-30 text-loss hover:bg-loss/20 transition-colors"
                title="Remove level"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </React.Fragment>
      ))}

      {/* Arrow before site level */}
      {siteLevel && <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0" />}

      {/* Site level pill */}
      {siteLevel && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-action/10 text-action border border-action/30 rounded-lg">
          <Lock className="h-3 w-3" />
          {siteLevel.label}
        </div>
      )}

      {/* Add button */}
      {!showAdd && totalLevels < 6 && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0" />
          <button
            onClick={() => { setShowAdd(true); setEditIdx(null); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-dashed border-b-default rounded-lg text-faint hover:text-secondary hover:border-action/50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add level
          </button>
        </>
      )}

      {showAdd && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-faint shrink-0" />
          <div className="flex items-center gap-1">
            <input
              type="text"
              className={cn(inputCls, "text-xs py-1 px-2 w-28")}
              placeholder="Level name"
              value={addingLabel}
              onChange={(e) => setAddingLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setShowAdd(false); setAddingLabel(""); }
              }}
              autoFocus
              disabled={saving}
            />
          </div>
        </>
      )}
    </div>
  );
}
