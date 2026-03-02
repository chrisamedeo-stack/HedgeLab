"use client";

import { useEffect, useMemo } from "react";
import { useImportStore } from "@/store/importStore";

function ConfidenceBadge({ score }: { score: number }) {
  const color =
    score >= 0.8
      ? "bg-profit-15 text-profit border-profit-20"
      : score >= 0.5
        ? "bg-warning-20 text-warning border-warning-20"
        : "bg-destructive-10 text-loss border-destructive-20";

  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      {Math.round(score * 100)}%
    </span>
  );
}

interface ColumnMapperProps {
  orgId: string;
  userId: string;
}

export function ColumnMapper({ orgId, userId }: ColumnMapperProps) {
  const {
    rawHeaders,
    rawRows,
    columnMapping,
    confidence,
    unmappedHeaders,
    targetTable,
    targets,
    requestAIMapping,
    adjustMapping,
    loading,
  } = useImportStore();

  // Get target fields for dropdown
  const target = useMemo(
    () => targets.find((t) => t.table === targetTable),
    [targets, targetTable]
  );

  const allTargetFields = useMemo(
    () => [...(target?.requiredFields ?? []), ...(target?.optionalFields ?? [])],
    [target]
  );

  const requiredSet = useMemo(
    () => new Set(target?.requiredFields ?? []),
    [target]
  );

  // Track which target fields are already mapped
  const usedTargetFields = useMemo(
    () => new Set(Object.values(columnMapping)),
    [columnMapping]
  );

  // Request AI mapping on mount
  useEffect(() => {
    if (rawHeaders.length > 0 && Object.keys(columnMapping).length === 0) {
      requestAIMapping(orgId, userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if all required fields are mapped
  const missingRequired = useMemo(() => {
    return (target?.requiredFields ?? []).filter((f) => !usedTargetFields.has(f));
  }, [target, usedTargetFields]);

  if (loading && Object.keys(columnMapping).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-b-input border-t-action" />
        <div className="text-sm text-muted">AI is analyzing your columns...</div>
        <div className="mt-1 text-xs text-ph">This may take a few seconds</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-secondary">Column Mapping</h3>
          <p className="mt-0.5 text-sm text-faint">
            Review and adjust how CSV columns map to target fields.
          </p>
        </div>
        <button
          onClick={() => requestAIMapping(orgId, userId)}
          disabled={loading}
          className="rounded-md bg-action-20 px-3 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action-30 disabled:opacity-50"
        >
          Re-run AI Mapping
        </button>
      </div>

      {/* Missing required fields warning */}
      {missingRequired.length > 0 && (
        <div className="mb-4 rounded-md border border-warning-20 bg-warning-10 px-4 py-2.5">
          <div className="text-xs font-medium text-warning">Missing required fields:</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {missingRequired.map((f) => (
              <span key={f} className="rounded bg-warning-20 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="overflow-hidden rounded-lg border border-b-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-b-default bg-surface">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">CSV Column</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-muted">Confidence</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Target Field</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted">Sample Data</th>
            </tr>
          </thead>
          <tbody>
            {rawHeaders.map((header) => {
              const mapped = columnMapping[header];
              const conf = confidence[header] ?? 0;
              const isUnmapped = !mapped;
              // Grab up to 3 sample values
              const samples = rawRows.slice(0, 3).map((r) => r[header]).filter(Boolean);

              return (
                <tr
                  key={header}
                  className={`border-b border-b-default transition-colors ${
                    isUnmapped ? "bg-surface" : "hover:bg-row-hover"
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-secondary">{header}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {mapped && <ConfidenceBadge score={conf} />}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={mapped ?? ""}
                      onChange={(e) => adjustMapping(header, e.target.value)}
                      className={`w-full rounded border bg-input-bg px-2 py-1 text-xs ${
                        isUnmapped
                          ? "border-b-input text-faint"
                          : requiredSet.has(mapped)
                            ? "border-action-20 text-secondary"
                            : "border-b-input text-secondary"
                      }`}
                    >
                      <option value="">— Unmapped —</option>
                      {allTargetFields.map((field) => (
                        <option
                          key={field}
                          value={field}
                          disabled={usedTargetFields.has(field) && field !== mapped}
                        >
                          {field}
                          {requiredSet.has(field) ? " *" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {samples.map((s, i) => (
                        <span key={i} className="rounded bg-hover px-1.5 py-0.5 text-[10px] text-faint">
                          {String(s).slice(0, 20)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unmapped headers */}
      {unmappedHeaders.length > 0 && (
        <div className="mt-4 rounded-md border border-b-default bg-surface px-4 py-3">
          <div className="text-xs font-medium text-muted">
            Unmapped headers ({unmappedHeaders.length})
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {unmappedHeaders.map((h) => (
              <span key={h} className="rounded bg-hover px-2 py-0.5 text-xs text-faint">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
