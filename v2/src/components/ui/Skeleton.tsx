"use client";

interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
}

export function Skeleton({ className = "", height = "h-4", width = "w-full" }: SkeletonProps) {
  return (
    <div
      className={`${height} ${width} rounded bg-hover animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-hover via-input-bg to-hover ${className}`}
    />
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-b-default bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-b-default bg-tbl-header">
        <Skeleton width="w-20" height="h-3" />
        <Skeleton width="w-32" height="h-3" />
        <Skeleton width="w-24" height="h-3" />
        <Skeleton width="w-16" height="h-3" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-4 border-b border-b-default last:border-0">
          <Skeleton width="w-20" />
          <Skeleton width="w-40" />
          <Skeleton width="w-24" />
          <Skeleton width="w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPIGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-b-default bg-surface p-4 space-y-2">
          <Skeleton width="w-24" height="h-3" />
          <Skeleton width="w-16" height="h-6" />
          <Skeleton width="w-28" height="h-3" />
        </div>
      ))}
    </div>
  );
}
