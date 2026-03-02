"use client";

import { useEffect } from "react";
import { useImportStore, type ImportTarget } from "@/store/importStore";

const MODULE_ICONS: Record<string, string> = {
  trades: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  positions: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  budget: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  market: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  contracts: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  logistics: "M8 7h12l-2 5H8m0 0l-2 5h12M8 7L6 2H3m5 5a1 1 0 100 2 1 1 0 000-2zm8 10a1 1 0 100 2 1 1 0 000-2z",
};

const TABLE_LABELS: Record<string, string> = {
  tc_financial_trades: "Futures Trades",
  pm_allocations: "Position Allocations",
  pm_physical_positions: "Physical Positions",
  bgt_line_items: "Budget Line Items",
  md_prices: "Market Prices",
  ct_physical_contracts: "Physical Contracts",
  lg_deliveries: "Deliveries",
};

function TargetCard({ target, onSelect }: { target: ImportTarget; onSelect: () => void }) {
  const icon = MODULE_ICONS[target.module] ?? MODULE_ICONS.trades;
  const label = TABLE_LABELS[target.table] ?? target.table;

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col rounded-lg border border-b-default bg-input-bg p-4 text-left transition-all hover:border-action-30 hover:bg-hover"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-action-10 p-2 text-action group-hover:bg-action-20">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium text-secondary">{label}</div>
          <div className="text-xs text-faint">{target.module}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-3 text-xs text-faint">
        <span>{target.requiredFields.length} required</span>
        <span>{target.optionalFields.length} optional</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {target.requiredFields.slice(0, 4).map((f) => (
          <span key={f} className="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted">
            {f}
          </span>
        ))}
        {target.requiredFields.length > 4 && (
          <span className="rounded bg-hover px-1.5 py-0.5 text-[10px] text-muted">
            +{target.requiredFields.length - 4} more
          </span>
        )}
      </div>
    </button>
  );
}

export function TargetPicker() {
  const { targets, fetchTargets, setTarget, loading } = useImportStore();

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  if (loading && targets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-faint">
        Loading import targets...
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-secondary">Select Import Target</h3>
      <p className="mb-6 text-sm text-faint">Choose which table you want to import data into.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {targets.map((target) => (
          <TargetCard
            key={target.table}
            target={target}
            onSelect={() => setTarget(target.table, target.module)}
          />
        ))}
      </div>
    </div>
  );
}
