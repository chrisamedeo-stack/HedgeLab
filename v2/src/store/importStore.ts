import { create } from "zustand";
import Papa from "papaparse";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportTarget {
  table: string;
  module: string;
  requiredFields: string[];
  optionalFields: string[];
}

export interface ImportJobRecord {
  id: string;
  org_id: string;
  user_id: string;
  user_name?: string;
  target_module: string;
  target_table: string;
  file_name: string;
  file_type: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  warning_rows: number;
  column_mapping: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface StagedRowRecord {
  id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  status: string;
  errors: string[];
  warnings: string[];
  ai_corrections: Record<string, { from: unknown; to: unknown }> | null;
  user_overrides: Record<string, unknown> | null;
  final_data: Record<string, unknown> | null;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

interface ImportState {
  // Wizard state
  step: WizardStep;
  targetTable: string | null;
  targetModule: string | null;
  fileName: string | null;
  jobId: string | null;

  // Parsed CSV
  rawHeaders: string[];
  rawRows: Record<string, string>[];

  // AI mapping
  columnMapping: Record<string, string>;
  confidence: Record<string, number>;
  unmappedHeaders: string[];

  // Staging & commit results
  stagedResult: { valid: number; warnings: number; errors: number } | null;
  stagedRows: StagedRowRecord[];
  commitResult: { committed: number; skipped: number } | null;

  // History
  jobs: ImportJobRecord[];
  targets: ImportTarget[];

  // UI
  loading: boolean;
  error: string | null;

  // Actions
  setTarget: (table: string, module: string) => void;
  parseCSV: (file: File) => Promise<void>;
  requestAIMapping: (orgId: string, userId: string) => Promise<void>;
  adjustMapping: (sourceHeader: string, targetField: string) => void;
  stageAndValidate: (orgId: string, userId: string) => Promise<void>;
  commitImport: (orgId: string, userId: string) => Promise<void>;
  fetchJobs: (orgId: string) => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  fetchTargets: () => Promise<void>;
  setStep: (step: WizardStep) => void;
  reset: () => void;
  clearError: () => void;
}

const initialState = {
  step: 1 as WizardStep,
  targetTable: null,
  targetModule: null,
  fileName: null,
  jobId: null,
  rawHeaders: [],
  rawRows: [],
  columnMapping: {},
  confidence: {},
  unmappedHeaders: [],
  stagedResult: null,
  stagedRows: [],
  commitResult: null,
  jobs: [],
  targets: [],
  loading: false,
  error: null,
};

export const useImportStore = create<ImportState>((set, get) => ({
  ...initialState,

  setTarget: (table, module) => {
    set({ targetTable: table, targetModule: module, step: 2 });
  },

  parseCSV: async (file) => {
    set({ loading: true, error: null });
    try {
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });

      if (result.errors.length > 0 && result.data.length === 0) {
        throw new Error(`CSV parse error: ${result.errors[0].message}`);
      }

      set({
        rawHeaders: result.meta.fields ?? [],
        rawRows: result.data,
        fileName: file.name,
        step: 3,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  requestAIMapping: async (orgId, userId) => {
    const { rawHeaders, targetTable, jobId } = get();
    if (!targetTable || rawHeaders.length === 0) return;

    set({ loading: true, error: null });
    try {
      // First check for existing template
      const templateRes = await fetch("/api/kernel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "find-template", orgId, targetTable, headers: rawHeaders }),
      });
      const templateData = await templateRes.json();

      if (templateData.mapping) {
        // Template match — use it with high confidence
        const confidence: Record<string, number> = {};
        for (const key of Object.keys(templateData.mapping)) {
          confidence[key] = 1.0;
        }
        set({
          columnMapping: templateData.mapping,
          confidence,
          unmappedHeaders: rawHeaders.filter((h) => !templateData.mapping[h]),
          loading: false,
        });
        return;
      }

      // No template — ask AI
      const res = await fetch("/api/import/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "map",
          jobId,
          userId,
          sourceHeaders: rawHeaders,
          targetTable,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();

      set({
        columnMapping: data.mapping ?? {},
        confidence: data.confidence ?? {},
        unmappedHeaders: data.unmapped ?? [],
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  adjustMapping: (sourceHeader, targetField) => {
    set((s) => {
      const newMapping = { ...s.columnMapping };
      if (targetField === "") {
        delete newMapping[sourceHeader];
        return {
          columnMapping: newMapping,
          unmappedHeaders: [...s.unmappedHeaders, sourceHeader],
          confidence: { ...s.confidence, [sourceHeader]: 0 },
        };
      } else {
        newMapping[sourceHeader] = targetField;
        return {
          columnMapping: newMapping,
          unmappedHeaders: s.unmappedHeaders.filter((h) => h !== sourceHeader),
          confidence: { ...s.confidence, [sourceHeader]: 1.0 },
        };
      }
    });
  },

  stageAndValidate: async (orgId, userId) => {
    const { rawRows, columnMapping, targetTable, targetModule, fileName } = get();
    if (!targetTable || !targetModule) return;

    set({ loading: true, error: null });
    try {
      // Create job if not yet created
      let { jobId } = get();
      if (!jobId) {
        const createRes = await fetch("/api/kernel/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            orgId,
            userId,
            targetModule,
            targetTable,
            fileName: fileName ?? "upload.csv",
            fileType: "csv",
          }),
        });
        if (!createRes.ok) throw new Error((await createRes.json()).error);
        const createData = await createRes.json();
        jobId = createData.jobId;
        set({ jobId });
      }

      // Map raw rows using column mapping
      const mappedRows = rawRows.map((raw) => {
        const mapped: Record<string, unknown> = {};
        for (const [source, target] of Object.entries(columnMapping)) {
          if (raw[source] !== undefined && raw[source] !== "") {
            mapped[target] = raw[source];
          }
        }
        return { rawData: raw, mappedData: mapped };
      });

      // Try AI corrections
      const correctedMapped = mappedRows.map((r) => r.mappedData);
      let correctedRows = correctedMapped;
      let corrections: Record<string, { from: unknown; to: unknown }>[] = correctedMapped.map(() => ({}));

      try {
        const aiRes = await fetch("/api/import/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "correct",
            jobId,
            userId,
            rows: correctedMapped,
            targetTable,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.correctedRows) correctedRows = aiData.correctedRows;
          if (aiData.corrections) corrections = aiData.corrections;
        }
      } catch {
        // AI corrections are optional — continue with raw mapped data
      }

      // Stage with the (possibly corrected) data
      const rowsToStage = mappedRows.map((r, i) => ({
        rawData: r.rawData,
        mappedData: correctedRows[i] ?? r.mappedData,
      }));

      const stageRes = await fetch("/api/kernel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stage", jobId, rows: rowsToStage }),
      });
      if (!stageRes.ok) throw new Error((await stageRes.json()).error);
      const stageResult = await stageRes.json();

      // Fetch staged rows for review
      const jobRes = await fetch(`/api/kernel/import?jobId=${jobId}`);
      const jobData = await jobRes.json();

      // Merge AI corrections into staged rows for display
      const stagedRows = (jobData.rows ?? []).map((row: StagedRowRecord, i: number) => ({
        ...row,
        ai_corrections: corrections[i] && Object.keys(corrections[i]).length > 0 ? corrections[i] : null,
      }));

      set({
        stagedResult: stageResult,
        stagedRows,
        step: 4,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  commitImport: async (orgId, userId) => {
    const { jobId } = get();
    if (!jobId) return;

    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/kernel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", jobId, userId, orgId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const result = await res.json();
      set({ commitResult: result, step: 5, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchJobs: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/kernel/import?orgId=${orgId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const jobs = await res.json();
      set({ jobs, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchJob: async (jobId) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/kernel/import?jobId=${jobId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      set({ stagedRows: data.rows ?? [], loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchTargets: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/kernel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "targets" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const targets = await res.json();
      set({ targets, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setStep: (step) => set({ step }),

  reset: () => set({ ...initialState }),

  clearError: () => set({ error: null }),
}));
