"use client";

import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { CornBudgetLineResponse } from "@/hooks/useCorn";
import { BUSHELS_PER_MT } from "@/lib/corn-utils";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtVol, fmtPrice, fmtDollars, lineNotional } from "./shared";
import { BudgetRow } from "./budget-row";
import { BudgetLineForm } from "./budget-line-form";
import { FiscalYearGrid } from "./fiscal-year-grid";

type FormMode = "none" | "single" | "fiscal-year";

export function BudgetTab({
  lines,
  isLoading,
  formMode,
  editing,
  filterSite,
  fyStartMonth,
  onEdit,
  onSaved,
  onCloseForm,
  onOpenFiscalYear,
  mutate,
}: {
  lines: CornBudgetLineResponse[];
  isLoading: boolean;
  formMode: FormMode;
  editing: CornBudgetLineResponse | undefined;
  filterSite: string;
  fyStartMonth: number;
  onEdit: (l: CornBudgetLineResponse) => void;
  onSaved: () => void;
  onCloseForm: () => void;
  onOpenFiscalYear: () => void;
  mutate: () => void;
}) {
  const bySite = lines.reduce<Record<string, CornBudgetLineResponse[]>>((acc, line) => {
    (acc[line.siteCode] ??= []).push(line);
    return acc;
  }, {});

  const totalBu = lines.reduce((s, l) => s + (l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT), 0);

  const wtdAvg = useMemo(() => {
    let sumPriceVol = 0, sumVol = 0;
    for (const l of lines) {
      if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
        sumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
        sumVol += l.budgetVolumeMt;
      }
    }
    if (sumVol === 0) return null;
    return sumPriceVol / sumVol;
  }, [lines]);

  const totalNotional = useMemo(() => {
    return lines.reduce((s, l) => s + (lineNotional(l) ?? 0), 0);
  }, [lines]);

  return (
    <>
      {/* Forms */}
      {formMode === "single" && (
        <BudgetLineForm siteCode={filterSite || undefined} editing={editing} onSaved={onSaved} onCancel={onCloseForm} fyStartMonth={fyStartMonth} />
      )}
      {formMode === "fiscal-year" && (
        <FiscalYearGrid onSaved={onSaved} onCancel={onCloseForm} fyStartMonth={fyStartMonth} />
      )}

      {/* KPIs */}
      {lines.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Budget Lines</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{lines.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Volume</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {totalBu > 0 ? `${(totalBu / 1_000_000).toFixed(2)}M bu` : "\u2014"}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Wtd Avg Price</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {wtdAvg != null ? `$${(wtdAvg / BUSHELS_PER_MT).toFixed(4)}/bu` : "\u2014"}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Notional</p>
            <p className="text-2xl font-bold tabular-nums text-slate-100">
              {totalNotional > 0 ? fmtDollars(totalNotional) : "\u2014"}
            </p>
          </div>
        </div>
      )}

      {/* Table grouped by site */}
      {isLoading ? (
        <SkeletonTable rows={6} cols={9} />
      ) : lines.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No budget lines"
          description='Use "Full Year" to enter an entire fiscal year at once, or "Add Month" for a single month.'
          action={{ label: "Full Year Entry", onClick: onOpenFiscalYear }}
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(bySite).map(([siteCode, siteLines]) => {
            const siteName = siteLines[0]?.siteName ?? siteCode;
            const siteBu   = siteLines.reduce((s, l) => s + (l.budgetVolumeBu ?? l.budgetVolumeMt * BUSHELS_PER_MT), 0);
            let siteSumPriceVol = 0, siteSumVol = 0;
            for (const l of siteLines) {
              if (l.targetAllInPerMt != null && l.budgetVolumeMt > 0) {
                siteSumPriceVol += l.targetAllInPerMt * l.budgetVolumeMt;
                siteSumVol += l.budgetVolumeMt;
              }
            }
            const siteWtdAvg = siteSumVol > 0 ? siteSumPriceVol / siteSumVol : null;
            const siteNotional = siteLines.reduce((s, l) => s + (lineNotional(l) ?? 0), 0);

            return (
              <div key={siteCode} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-200">{siteName}</span>
                    <span className="ml-2 text-xs text-slate-500">{siteCode}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{fmtVol(siteBu)} bu</span>
                    <span className="text-slate-600">&middot;</span>
                    <span>{siteLines.length} line{siteLines.length !== 1 ? "s" : ""}</span>
                    {siteWtdAvg != null && (
                      <>
                        <span className="text-slate-600">&middot;</span>
                        <span className="text-blue-400">${(siteWtdAvg / BUSHELS_PER_MT).toFixed(4)}/bu</span>
                      </>
                    )}
                    {siteNotional > 0 && (
                      <>
                        <span className="text-slate-600">&middot;</span>
                        <span className="text-emerald-400">{fmtDollars(siteNotional)} notional</span>
                      </>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/20 border-b border-slate-800">
                      <th className="w-8" />
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Month</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Futures Ref</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Bushels</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">All-in $/bu</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Notional $</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {siteLines.map((line) => (
                      <BudgetRow key={line.id} line={line} onEdit={onEdit} onDeleted={mutate} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-800/30">
                      <td colSpan={3} className="px-4 py-2 text-xs text-slate-500 text-right font-medium">Subtotal</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-300 text-xs">{fmtVol(siteBu)} bu</td>
                      <td />
                      <td className="px-4 py-2 text-right tabular-nums text-emerald-400 text-xs font-medium">{siteNotional > 0 ? fmtDollars(siteNotional) : ""}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
