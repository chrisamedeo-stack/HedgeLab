"use client";

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

  return (
    <div className="inline-flex gap-1 rounded-lg bg-input-bg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-md ${pad} font-medium transition-colors ${
            active === tab.key
              ? "bg-surface text-secondary shadow-sm"
              : "text-muted hover:text-secondary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
