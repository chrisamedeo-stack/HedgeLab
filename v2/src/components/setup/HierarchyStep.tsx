"use client";

import { useSetupStore } from "@/store/setupStore";
import type { HierarchyTemplateLevel } from "@/types/org";

export function HierarchyStep() {
  const { hierarchyLevels, setHierarchy, setStep, profile } = useSetupStore();

  function updateLabel(index: number, label: string) {
    const updated = hierarchyLevels.map((l, i) => (i === index ? { ...l, label } : l));
    setHierarchy(updated);
  }

  function addLevel() {
    // Insert before the site level (last)
    const siteIdx = hierarchyLevels.findIndex((l) => l.is_site_level);
    const insertAt = siteIdx >= 0 ? siteIdx : hierarchyLevels.length;
    const newLevel: HierarchyTemplateLevel = {
      depth: insertAt,
      label: "New Level",
    };

    const updated = [...hierarchyLevels];
    updated.splice(insertAt, 0, newLevel);
    // Re-index depths
    const reindexed = updated.map((l, i) => ({ ...l, depth: i }));
    setHierarchy(reindexed);
  }

  function removeLevel(index: number) {
    if (hierarchyLevels[index].is_site_level) return; // Can't remove site level
    if (hierarchyLevels.filter((l) => !l.is_site_level).length <= 1) return; // Keep at least 1 non-site level

    const updated = hierarchyLevels.filter((_, i) => i !== index);
    const reindexed = updated.map((l, i) => ({ ...l, depth: i }));
    setHierarchy(reindexed);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary">Organization Structure</h2>
        <p className="mt-1 text-sm text-muted">
          Customize your hierarchy levels. The bottom level is always the site level.
          {profile && (
            <span className="text-faint"> Pre-configured from {profile.display_name} profile.</span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {hierarchyLevels.map((level, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Depth indicator */}
            <div className="flex items-center gap-1 w-8 shrink-0 justify-end">
              {Array.from({ length: i }).map((_, j) => (
                <div key={j} className="w-0.5 h-3 bg-hover rounded" />
              ))}
              <span className="text-xs text-faint">{i}</span>
            </div>

            {/* Label input */}
            <input
              type="text"
              value={level.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              className="flex-1 rounded-lg border border-b-input bg-input-bg px-3 py-2 text-sm text-primary focus:border-action focus:outline-none"
            />

            {/* Site badge or remove button */}
            {level.is_site_level ? (
              <span className="shrink-0 rounded-full bg-action-10 px-2.5 py-1 text-[10px] font-medium text-action uppercase">
                Site Level
              </span>
            ) : (
              <button
                onClick={() => removeLevel(i)}
                disabled={hierarchyLevels.filter((l) => !l.is_site_level).length <= 1}
                className="shrink-0 rounded-lg p-1.5 text-faint hover:text-loss hover:bg-loss/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove level"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={addLevel}
        className="flex items-center gap-1.5 text-sm text-action hover:text-action-hover transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Level
      </button>

      <div className="flex justify-between pt-2">
        <button
          onClick={() => setStep(2)}
          className="rounded-lg border border-b-input px-5 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-secondary"
        >
          Back
        </button>
        <button
          onClick={() => setStep(4)}
          disabled={hierarchyLevels.length === 0}
          className="rounded-lg bg-action px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
