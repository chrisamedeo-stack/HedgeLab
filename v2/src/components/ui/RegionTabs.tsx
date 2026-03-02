"use client";

interface RegionTab {
  id: string;
  name: string;
  siteCount?: number;
}

interface RegionTabsProps {
  regions: RegionTab[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}

export function RegionTabs({
  regions,
  selected,
  onSelect,
  allLabel = "All Regions",
}: RegionTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-input-bg p-1">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          selected === null
            ? "bg-action-10 text-secondary"
            : "text-muted hover:text-secondary"
        }`}
      >
        {allLabel}
      </button>
      {regions.map((r) => (
        <button
          key={r.id}
          onClick={() => onSelect(r.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            selected === r.id
              ? "bg-action-10 text-secondary"
              : "text-muted hover:text-secondary"
          }`}
        >
          {r.name}
          {r.siteCount !== undefined && (
            <span className="ml-1.5 text-xs text-faint">({r.siteCount})</span>
          )}
        </button>
      ))}
    </div>
  );
}
