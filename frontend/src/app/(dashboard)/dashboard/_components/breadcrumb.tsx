"use client";

import { ArrowLeft, ChevronRight, Home } from "lucide-react";

export type ViewLevel = "company" | "country" | "site";

interface BreadcrumbProps {
  viewLevel: ViewLevel;
  selectedCountry: string | null;
  selectedSiteName: string | null;
  onNavigate: (level: ViewLevel) => void;
}

export function DashboardBreadcrumb({ viewLevel, selectedCountry, selectedSiteName, onNavigate }: BreadcrumbProps) {
  const backLevel: ViewLevel = viewLevel === "site" ? "country" : "company";
  const backLabel = viewLevel === "site" ? selectedCountry ?? "Country" : "Dashboard";

  return (
    <div className="flex items-center gap-3">
      {/* Back button */}
      <button
        onClick={() => onNavigate(backLevel)}
        className="flex items-center gap-2 px-3 py-1.5 bg-input-bg hover:bg-hover text-secondary hover:text-primary border border-b-input rounded-lg text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      {/* Breadcrumb trail */}
      <nav className="flex items-center gap-1.5 text-sm">
        <button
          onClick={() => onNavigate("company")}
          className="flex items-center gap-1 text-action hover:text-action-hover transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
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
    </div>
  );
}
