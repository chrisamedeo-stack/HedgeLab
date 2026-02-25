import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeKey: string;
  activeDir: "asc" | "desc";
  onToggle: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  activeKey,
  activeDir,
  onToggle,
  className,
}: SortableHeaderProps) {
  const isActive = activeKey === sortKey;

  return (
    <th
      className={cn(
        "text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-slate-200 transition-colors",
        className
      )}
      onClick={() => onToggle(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={cn("text-[10px] leading-none", isActive ? "text-blue-400" : "text-slate-600")}>
          {isActive ? (activeDir === "asc" ? "\u25B2" : "\u25BC") : "\u25B4\u25BE"}
        </span>
      </span>
    </th>
  );
}
