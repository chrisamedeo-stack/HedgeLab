"use client";

import React, { useState, useMemo } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: string;
  onRowClick?: (row: T) => void;
  expandedKey?: string | null;
  renderExpandedRow?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

type SortDir = "asc" | "desc";

export function DataTable<T extends object>({
  columns,
  data,
  keyField = "id",
  onRowClick,
  expandedKey,
  renderExpandedRow,
  emptyMessage = "No data",
  className = "",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const rec = (o: T) => (o as Record<string, unknown>);
      const aVal = rec(a)[sortKey];
      const bVal = rec(b)[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const alignCls = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-b-default bg-input-bg/50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted whitespace-nowrap ${alignCls(col.align)} ${
                  col.sortable !== false ? "cursor-pointer select-none hover:text-secondary transition-colors" : ""
                }`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable !== false && handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sortKey === col.key ? (
                    <span className="text-action">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                  ) : col.sortable !== false ? (
                    <span className="text-ph">{"▴▾"}</span>
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-b-default">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const rowKey = String((row as Record<string, unknown>)[keyField] ?? i);
              const isExpanded = expandedKey != null && rowKey === expandedKey;
              return (
                <React.Fragment key={rowKey}>
                  <tr
                    className={`transition-colors ${
                      onRowClick ? "cursor-pointer hover:bg-row-hover" : "hover:bg-row-hover"
                    } ${isExpanded ? "bg-row-hover" : ""}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${alignCls(col.align)}`}
                      >
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "\u2014")}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && renderExpandedRow && (
                    <tr>
                      <td colSpan={columns.length} className="p-0 border-t border-tbl-border">
                        {renderExpandedRow(row)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
