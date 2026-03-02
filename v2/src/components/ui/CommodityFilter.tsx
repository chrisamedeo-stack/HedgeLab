"use client";

interface CommodityOption {
  id: string;
  name: string;
}

interface CommodityFilterProps {
  commodities: CommodityOption[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}

export function CommodityFilter({
  commodities,
  selected,
  onSelect,
  allLabel = "All",
}: CommodityFilterProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-input-bg p-1">
      <button
        onClick={() => onSelect(null)}
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          selected === null
            ? "bg-action-10 text-secondary"
            : "text-muted hover:text-secondary"
        }`}
      >
        {allLabel}
      </button>
      {commodities.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            selected === c.id
              ? "bg-action-10 text-secondary"
              : "text-muted hover:text-secondary"
          }`}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
