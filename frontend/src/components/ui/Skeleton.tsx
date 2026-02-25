import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-gradient-to-r from-input-bg via-hover to-input-bg bg-[length:200%_100%] animate-shimmer rounded", className)} />
  );
}

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 6 }: SkeletonTableProps) {
  return (
    <div className="bg-surface border border-b-default rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-input-bg/50">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-b-default">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-4 py-3">
                  <Skeleton className={cn("h-4", colIdx === 0 ? "w-32" : "w-24")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
