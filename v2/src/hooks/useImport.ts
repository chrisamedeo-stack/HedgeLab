"use client";

import { useEffect, useCallback, useState } from "react";
import { API_BASE } from "@/lib/api";

// ─── Shared fetch hook ──────────────────────────────────────────────────────

function useFetch<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// ─── Import Jobs (history) ──────────────────────────────────────────────────

interface ImportJob {
  id: string;
  org_id: string;
  user_id: string;
  user_name?: string;
  target_module: string;
  target_table: string;
  file_name: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  warning_rows: number;
  created_at: string;
}

export function useImportJobs(orgId: string) {
  return useFetch<ImportJob[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/v2/kernel/import?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}

// ─── Single Import Job ──────────────────────────────────────────────────────

interface StagedRow {
  id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  status: string;
  errors: string[];
  warnings: string[];
  ai_corrections: Record<string, unknown> | null;
  user_overrides: Record<string, unknown> | null;
}

interface ImportJobDetail {
  job: ImportJob;
  rows: StagedRow[];
}

export function useImportJob(jobId: string | null) {
  return useFetch<ImportJobDetail | null>(async () => {
    if (!jobId) return null;
    const res = await fetch(`${API_BASE}/api/v2/kernel/import?jobId=${jobId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [jobId]);
}

// ─── Import Targets ─────────────────────────────────────────────────────────

interface ImportTarget {
  table: string;
  module: string;
  requiredFields: string[];
  optionalFields: string[];
}

export function useImportTargets() {
  return useFetch<ImportTarget[]>(async () => {
    const res = await fetch(`${API_BASE}/api/v2/kernel/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "targets" }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, []);
}

// ─── Import Templates ───────────────────────────────────────────────────────

interface ImportTemplate {
  id: string;
  name: string;
  target_module: string;
  target_table: string;
  column_mapping: Record<string, string>;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
}

export function useImportTemplates(orgId: string) {
  return useFetch<ImportTemplate[]>(async () => {
    if (!orgId) return [];
    const res = await fetch(`${API_BASE}/api/v2/import/templates?orgId=${orgId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
  }, [orgId]);
}
