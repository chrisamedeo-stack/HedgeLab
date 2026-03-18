"use client";

import { useRef, useCallback } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabGroupProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
}

export function TabGroup({ tabs, active, onChange, size = "md" }: TabGroupProps) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let next = -1;
      if (e.key === "ArrowRight") {
        next = (index + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        next = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        next = 0;
      } else if (e.key === "End") {
        next = tabs.length - 1;
      }
      if (next >= 0) {
        e.preventDefault();
        onChange(tabs[next].key);
        tabRefs.current[next]?.focus();
      }
    },
    [tabs, onChange]
  );

  return (
    <div role="tablist" className="inline-flex gap-1 rounded-lg bg-input-bg p-1">
      {tabs.map((tab, i) => {
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`rounded-md ${pad} font-medium transition-colors ${
              selected
                ? "bg-surface text-secondary shadow-sm"
                : "text-muted hover:text-secondary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
