"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useImportStore, type ImportJobRecord } from "@/store/importStore";

// TODO: Replace with real org context from auth
const DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001";

const TABLE_LABELS: Record<string, string> = {
  tc_financial_trades: "Futures Trades",
  pm_allocations: "Allocations",
  pm_physical_positions: "Physical Positions",
  bgt_line_items: "Budget Lines",
  md_prices: "Market Prices",
  ct_physical_contracts: "Contracts",
  lg_deliveries: "Deliveries",
};

const columns: Column<ImportJobRecord>[] = [
  {
    key: "file_name",
    header: "File",
    render: (row) => (
      <span className="font-medium text-secondary">{row.file_name}</span>
    ),
  },
  {
    key: "target_table",
    header: "Target",
    render: (row) => (
      <span className="text-muted">{TABLE_LABELS[row.target_table] ?? row.target_table}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "total_rows",
    header: "Rows",
    align: "right",
    render: (row) => (
      <span className="tabular-nums text-secondary">{row.total_rows ?? "—"}</span>
    ),
  },
  {
    key: "valid_rows",
    header: "Valid",
    align: "right",
    render: (row) => (
      <span className="tabular-nums text-profit">{row.valid_rows ?? "—"}</span>
    ),
  },
  {
    key: "error_rows",
    header: "Errors",
    align: "right",
    render: (row) => (
      <span className={`tabular-nums ${row.error_rows > 0 ? "text-loss" : "text-faint"}`}>
        {row.error_rows ?? 0}
      </span>
    ),
  },
  {
    key: "user_name",
    header: "User",
    render: (row) => (
      <span className="text-muted">{row.user_name ?? "—"}</span>
    ),
  },
  {
    key: "created_at",
    header: "Created",
    render: (row) => (
      <span className="text-xs text-faint">
        {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
      </span>
    ),
  },
];

export default function ImportDashboardPage() {
  const { jobs, fetchJobs, loading } = useImportStore();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs(DEMO_ORG_ID);
  }, [fetchJobs]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Import History</h1>
          <p className="mt-0.5 text-sm text-faint">
            View past imports and start new ones.
          </p>
        </div>
        <Link
          href="/import/new"
          className="rounded-md bg-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-action-hover"
        >
          New Import
        </Link>
      </div>

      {/* Jobs table */}
      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-faint">
          Loading import history...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={jobs}
          keyField="id"
          onRowClick={(row) => setSelectedJob(selectedJob === row.id ? null : row.id)}
          emptyMessage="No imports yet. Click 'New Import' to get started."
        />
      )}

      {/* Expanded job detail */}
      {selectedJob && <JobDetail jobId={selectedJob} />}
    </div>
  );
}

function JobDetail({ jobId }: { jobId: string }) {
  const { stagedRows, fetchJob, loading } = useImportStore();

  useEffect(() => {
    fetchJob(jobId);
  }, [jobId, fetchJob]);

  if (loading) {
    return (
      <div className="mt-4 rounded-lg border border-b-default bg-surface p-4 text-sm text-faint">
        Loading staged rows...
      </div>
    );
  }

  if (stagedRows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-b-default bg-surface p-4 text-sm text-faint">
        No staged rows for this job.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-b-default bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-secondary">
        Staged Rows ({stagedRows.length})
      </h3>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-b-default">
              <th className="px-2 py-1.5 text-left text-faint">#</th>
              <th className="px-2 py-1.5 text-left text-faint">Status</th>
              <th className="px-2 py-1.5 text-left text-faint">Data</th>
              <th className="px-2 py-1.5 text-left text-faint">Issues</th>
            </tr>
          </thead>
          <tbody>
            {stagedRows.slice(0, 50).map((row) => (
              <tr key={row.id} className="border-b border-b-default">
                <td className="px-2 py-1.5 text-faint">{row.row_number}</td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-2 py-1.5 text-muted">
                  {Object.entries(row.mapped_data)
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </td>
                <td className="px-2 py-1.5 text-loss">
                  {row.errors?.length ? row.errors.join("; ") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
