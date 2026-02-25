"use client";

import { ChevronRight } from "lucide-react";

export type ViewLevel = "company" | "country" | "site";

interface BreadcrumbProps {
  viewLevel: ViewLevel;
  selectedCountry: string | null;
  selectedSiteName: string | null;
  onNavigate: (level: ViewLevel) => void;
}

export function DashboardBreadcrumb({ viewLevel, selectedCountry, selectedSiteName, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <button
        onClick={() => onNavigate("company")}
        className={viewLevel === "company"
          ? "font-semibold text-primary"
          : "text-action hover:text-action-hover transition-colors"}
      >
        Company
      </button>

      {(viewLevel === "country" || viewLevel === "site") && selectedCountry && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-faint" />
          <button
            onClick={() => onNavigate("country")}
            className={viewLevel === "country"
              ? "font-semibold text-primary"
              : "text-action hover:text-action-hover transition-colors"}
          >
            {selectedCountry}
          </button>
        </>
      )}

      {viewLevel === "site" && selectedSiteName && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-faint" />
          <span className="font-semibold text-primary">{selectedSiteName}</span>
        </>
      )}
    </nav>
  );
}
