"use client";

import type { DrillPathEntry } from "@/types/dashboard";

interface Props {
  path: DrillPathEntry[];
  onNavigate: (index: number) => void;
}

export function DashboardBreadcrumb({ path, onNavigate }: Props) {
  if (path.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs animate-fade-in">
      <button
        onClick={() => onNavigate(0)}
        className="text-action hover:underline font-medium"
      >
        Dashboard
      </button>
      {path.map((entry, i) => (
        <span key={`${entry.id}-${i}`} className="flex items-center gap-1.5">
          <svg className="h-3 w-3 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {i < path.length - 1 ? (
            <button
              onClick={() => onNavigate(i + 1)}
              className="text-action hover:underline font-medium"
            >
              {entry.name}
            </button>
          ) : (
            <span className="text-secondary font-medium">{entry.name}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
