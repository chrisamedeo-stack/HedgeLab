"use client";

import { useState, useCallback, useRef } from "react";
import { WIDGET_REGISTRY, WIDGET_MAP } from "@/lib/widgetRegistry";
import type { DrillLevel, WidgetLayoutEntry } from "@/types/dashboard";

interface Props {
  open: boolean;
  onClose: () => void;
  layout: WidgetLayoutEntry[];
  onSave: (layout: WidgetLayoutEntry[]) => void;
  onReset: () => void;
  drillLevel: DrillLevel;
  isPluginEnabled: (pluginId: string) => boolean;
}

export function DashboardCustomizePanel({ open, onClose, layout, onSave, onReset, drillLevel, isPluginEnabled }: Props) {
  const [items, setItems] = useState<WidgetLayoutEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const dragIdx = useRef<number | null>(null);

  // Sync from props when opened
  if (open && !initialized) {
    setItems([...layout]);
    setInitialized(true);
  }
  if (!open && initialized) {
    setInitialized(false);
  }

  // Filter to widgets available for current level + plugins
  const availableItems = items.filter((entry) => {
    const def = WIDGET_MAP.get(entry.widgetId);
    if (!def) return false;
    if (!def.supportedLevels.includes(drillLevel)) return false;
    if (def.pluginGate && !isPluginEnabled(def.pluginGate)) return false;
    return true;
  });

  const toggle = useCallback((widgetId: string) => {
    setItems((prev) =>
      prev.map((e) => (e.widgetId === widgetId ? { ...e, enabled: !e.enabled } : e))
    );
  }, []);

  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;

    setItems((prev) => {
      // Map available indices back to full array indices
      const fullIdxMap = prev
        .map((entry, i) => ({ entry, i }))
        .filter(({ entry }) => {
          const def = WIDGET_MAP.get(entry.widgetId);
          if (!def) return false;
          if (!def.supportedLevels.includes(drillLevel)) return false;
          if (def.pluginGate && !isPluginEnabled(def.pluginGate)) return false;
          return true;
        });

      const fromFull = fullIdxMap[dragIdx.current!]?.i;
      const toFull = fullIdxMap[idx]?.i;
      if (fromFull === undefined || toFull === undefined) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromFull, 1);
      next.splice(toFull, 0, moved);
      // Reassign order
      return next.map((e, i) => ({ ...e, order: i }));
    });
    dragIdx.current = idx;
  };

  const handleSave = () => {
    onSave(items);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-50 w-80 bg-surface border-l border-b-default shadow-xl flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-b-default">
          <h2 className="text-sm font-semibold text-secondary">Customize Dashboard</h2>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto py-2">
          {availableItems.map((entry, idx) => {
            const def = WIDGET_MAP.get(entry.widgetId);
            if (!def) return null;
            return (
              <div
                key={entry.widgetId}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover transition-colors cursor-grab active:cursor-grabbing"
              >
                {/* Drag handle */}
                <svg className="h-4 w-4 text-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>

                {/* Label */}
                <span className="flex-1 text-sm text-secondary">{def.label}</span>

                {/* Toggle */}
                <button
                  onClick={() => toggle(entry.widgetId)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    entry.enabled ? "bg-action" : "bg-input-bg"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                      entry.enabled ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-b-default px-4 py-3 flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs text-faint hover:text-muted transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="rounded-md border border-b-default bg-input-bg px-3 py-1.5 text-xs font-medium text-muted hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-action px-3 py-1.5 text-xs font-medium text-primary hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}
