"use client";

import { useState, useMemo } from "react";
import {
  Plus, CalendarDays, RefreshCw,
} from "lucide-react";
import { ExportButton } from "@/components/ui/ExportButton";
import { toCsv, downloadCsv } from "@/lib/csv-export";
import {
  useBudget, useSites, useCoverage,
  CornBudgetLineResponse,
} from "@/hooks/useCorn";
import { useAdminSites, useAppSettings } from "@/hooks/useSettings";
import {
  availableFiscalYears,
  currentFiscalYear,
} from "@/lib/corn-utils";
import { cn } from "@/lib/utils";
import { btnPrimary } from "@/lib/corn-format";
import { BudgetTab } from "./_components/budget-tab";
import { ForecastTab } from "./_components/forecast-tab";
import { BudgetVsCommittedChart } from "./_components/budget-vs-committed-chart";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveTab = "budget" | "forecast";
type FormMode = "none" | "single" | "fiscal-year" | "forecast-grid";
type Book = "CANADA" | "US";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { coverage } = useCoverage();
  const { sites: adminSites } = useAdminSites();
  const { settings } = useAppSettings();
  const fyStartMonth = parseInt(settings.find((s) => s.settingKey === "FISCAL_YEAR_START_MONTH")?.value ?? "7") || 7;

  // Shared state
  const [activeTab, setActiveTab] = useState<ActiveTab>("budget");
  const [book, setBook] = useState<Book>("CANADA");
  const [filterSite, setFilterSite] = useState("");
  const [filterFY, setFilterFY]     = useState(() => currentFiscalYear(fyStartMonth));
  const [formMode, setFormMode]     = useState<FormMode>("none");
  const [editing, setEditing]       = useState<CornBudgetLineResponse | undefined>();

  const { budget, isLoading, mutate } = useBudget(filterSite || undefined, filterFY || undefined);

  // Map book to country for filtering
  const bookCountry = book === "CANADA" ? "Canada" : "US";
  const countrySites = useMemo(() => adminSites.filter((s) => s.country === bookCountry), [adminSites, bookCountry]);
  const countrySiteCodes = useMemo(() => new Set(countrySites.map((s) => s.code)), [countrySites]);

  // Filter budget lines by country
  const filteredBudget = useMemo(() => budget.filter((l) => countrySiteCodes.has(l.siteCode)), [budget, countrySiteCodes]);

  function openEdit(line: CornBudgetLineResponse) { setEditing(line); setFormMode("single"); }
  function closeForm() { setFormMode("none"); setEditing(undefined); }
  function onSaved() { closeForm(); mutate(); }
  function switchTab(tab: ActiveTab) { setActiveTab(tab); setFormMode("none"); setEditing(undefined); }

  return (
    <div className="space-y-5">
      {/* Header + Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-muted uppercase tracking-wider">Budgets &amp; Forecasts</h1>
          <p className="text-sm text-muted mt-0.5">Fiscal year starting {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][fyStartMonth - 1]} &middot; volume targets by site and month</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onClick={() => {
              const headers = ["Month", "Futures Month", "Volume (bu)", "Target $/bu", "Notional", "Notes"];
              const rows = filteredBudget.map((l) => [
                l.budgetMonth, l.futuresMonth ?? "",
                l.budgetVolumeBu ?? "", l.targetAllInPerMt ?? "",
                l.totalNotionalSpend ?? "", l.notes ?? "",
              ]);
              downloadCsv("budget.csv", toCsv(headers, rows));
            }}
            disabled={filteredBudget.length === 0}
          />
          {activeTab === "budget" ? (
            <>
              <button onClick={() => { setFormMode("fiscal-year"); setEditing(undefined); }}
                className="flex items-center gap-2 px-4 py-2 bg-input-bg hover:bg-hover border border-b-input text-secondary text-sm font-medium rounded-lg transition-colors">
                <CalendarDays className="h-4 w-4" /> Full Year
              </button>
              <button onClick={() => { setFormMode("single"); setEditing(undefined); }}
                className={btnPrimary}>
                <Plus className="h-4 w-4" /> Add Month
              </button>
            </>
          ) : (
            <button onClick={() => { setFormMode("forecast-grid"); setEditing(undefined); }}
              className="flex items-center gap-2 px-4 py-2 bg-input-bg hover:bg-hover border border-b-input text-secondary text-sm font-medium rounded-lg transition-colors">
              <RefreshCw className="h-4 w-4" /> Update Forecasts
            </button>
          )}
        </div>
      </div>

      {/* Book Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg w-fit">
          {(["CANADA", "US"] as Book[]).map((b) => (
            <button
              key={b}
              onClick={() => { setBook(b); setFilterSite(""); }}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                book === b
                  ? "bg-[#00509e] text-white shadow"
                  : "text-muted hover:text-secondary"
              )}
            >
              {b === "CANADA" ? "\ud83c\udde8\ud83c\udde6 Canada" : "\ud83c\uddfa\ud83c\uddf8 United States"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 p-1 bg-surface border border-b-default rounded-lg w-fit">
        {([["budget", "Budgets"], ["forecast", "Forecasts"]] as [ActiveTab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[#00509e] text-white shadow"
                : "text-muted hover:text-secondary"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}
          className="bg-surface border border-b-default text-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
          <option value="">All</option>
          {countrySites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <select value={filterFY} onChange={(e) => setFilterFY(e.target.value)}
          className="bg-surface border border-b-default text-secondary rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-focus">
          <option value="">All Fiscal Years</option>
          {availableFiscalYears(fyStartMonth).map((fy) => <option key={fy}>{fy}</option>)}
        </select>
      </div>

      {/* Budget vs Committed chart */}
      {activeTab === "budget" && (
        <BudgetVsCommittedChart lines={filteredBudget} coverage={coverage} />
      )}

      {/* Active Tab Content */}
      {activeTab === "budget" ? (
        <BudgetTab
          lines={filteredBudget}
          isLoading={isLoading}
          formMode={formMode === "single" || formMode === "fiscal-year" ? formMode : "none"}
          editing={editing}
          filterSite={filterSite}
          fyStartMonth={fyStartMonth}
          onEdit={openEdit}
          onSaved={onSaved}
          onCloseForm={closeForm}
          onOpenFiscalYear={() => setFormMode("fiscal-year")}
          mutate={mutate}
        />
      ) : (
        <ForecastTab
          lines={filteredBudget}
          isLoading={isLoading}
          showGrid={formMode === "forecast-grid"}
          filterSite={filterSite}
          onSaved={onSaved}
          onCloseForm={closeForm}
          mutate={mutate}
        />
      )}
    </div>
  );
}
