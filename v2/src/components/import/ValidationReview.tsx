"use client";

import { useState, useMemo } from "react";
import { useImportStore, type StagedRowRecord } from "@/store/importStore";
import { KPICard } from "@/components/ui/KPICard";
import { StatusBadge } from "@/components/ui/StatusBadge";

type FilterStatus = "all" | "valid" | "warning" | "error";

function CorrectionBadge({ from, to }: { from: unknown; to: unknown }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-action-10 px-1.5 py-0.5 text-[10px]">
      <span className="text-faint line-through">{String(from)}</span>
      <span className="text-action">{String(to)}</span>
    </span>
  );
}

function RowDetail({ row }: { row: StagedRowRecord }) {
  const hasCorrections = row.ai_corrections && Object.keys(row.ai_corrections).length > 0;

  return (
    <div className="border-t border-b-default bg-surface px-4 py-3">
      {/* Errors */}
      {row.errors && row.errors.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-medium uppercase text-loss">Errors</div>
          <ul className="mt-0.5 space-y-0.5">
            {row.errors.map((e, i) => (
              <li key={i} className="text-xs text-loss">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {row.warnings && row.warnings.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-medium uppercase text-warning">Warnings</div>
          <ul className="mt-0.5 space-y-0.5">
            {row.warnings.map((w, i) => (
              <li key={i} className="text-xs text-warning">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Corrections */}
      {hasCorrections && (
        <div className="mb-2">
          <div className="text-[10px] font-medium uppercase text-action">AI Corrections</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {Object.entries(row.ai_corrections!).map(([field, correction]) => {
              const c = correction as { from: unknown; to: unknown };
              return (
                <div key={field} className="text-xs">
                  <span className="text-faint">{field}: </span>
                  <CorrectionBadge from={c.from} to={c.to} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mapped data preview */}
      <div>
        <div className="text-[10px] font-medium uppercase text-faint">Mapped Data</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(row.mapped_data).map(([key, val]) => (
            <div key={key} className="text-xs">
              <span className="text-faint">{key}:</span>{" "}
              <span className="text-secondary">{String(val)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ValidationReviewProps {
  orgId: string;
  userId: string;
}

export function ValidationReview({ orgId, userId }: ValidationReviewProps) {
  const { stagedResult, stagedRows, commitImport, loading } = useImportStore();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (filter === "all") return stagedRows;
    return stagedRows.filter((r) => r.status === filter);
  }, [stagedRows, filter]);

  const canCommit = (stagedResult?.valid ?? 0) + (stagedResult?.warnings ?? 0) > 0;

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-secondary">Review & Commit</h3>
      <p className="mb-6 text-sm text-faint">
        Review validated rows before committing to the database.
      </p>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <KPICard
          label="Valid"
          value={stagedResult?.valid ?? 0}
          trend={stagedResult?.valid ? "up" : "neutral"}
        />
        <KPICard
          label="Warnings"
          value={stagedResult?.warnings ?? 0}
          trend={stagedResult?.warnings ? "neutral" : undefined}
        />
        <KPICard
          label="Errors"
          value={stagedResult?.errors ?? 0}
          trend={stagedResult?.errors ? "down" : undefined}
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1.5">
        {(["all", "valid", "warning", "error"] as FilterStatus[]).map((f) => {
          const count =
            f === "all"
              ? stagedRows.length
              : stagedRows.filter((r) => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-hover text-secondary"
                  : "text-faint hover:bg-hover hover:text-secondary"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Rows table */}
      <div className="overflow-hidden rounded-lg border border-b-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-b-default bg-surface">
              <th className="w-12 px-3 py-2 text-left text-xs font-medium text-muted">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Key Fields</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted">Issues</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted">AI</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-faint">
                  No rows match this filter
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isExpanded = expandedRow === row.id;
                const hasCorrections = row.ai_corrections && Object.keys(row.ai_corrections).length > 0;
                // Show first 3 mapped field values as key fields
                const keyFields = Object.entries(row.mapped_data).slice(0, 3);

                return (
                  <tbody key={row.id}>
                    <tr
                      className="cursor-pointer border-b border-b-default transition-colors hover:bg-row-hover"
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                    >
                      <td className="px-3 py-2 text-xs text-faint">{row.row_number}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {keyFields.map(([k, v]) => (
                            <span key={k} className="text-xs">
                              <span className="text-faint">{k}:</span>{" "}
                              <span className="text-secondary">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(row.errors?.length ?? 0) + (row.warnings?.length ?? 0) > 0 && (
                          <span className="text-xs text-faint">
                            {row.errors?.length ?? 0}E / {row.warnings?.length ?? 0}W
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {hasCorrections && (
                          <span className="rounded bg-action-20 px-1.5 py-0.5 text-[10px] font-medium text-action">
                            {Object.keys(row.ai_corrections!).length} fix
                          </span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <RowDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-faint">
          {canCommit
            ? `${(stagedResult?.valid ?? 0) + (stagedResult?.warnings ?? 0)} rows will be committed (errors skipped)`
            : "No valid rows to commit"}
        </div>
        <button
          onClick={() => commitImport(orgId, userId)}
          disabled={!canCommit || loading}
          className="rounded-md bg-profit px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-profit-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Committing..." : "Commit Import"}
        </button>
      </div>
    </div>
  );
}
