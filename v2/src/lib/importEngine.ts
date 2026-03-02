import { query, queryOne, queryAll, transaction } from "./db";
import { auditLog } from "./audit";
import { emit, EventTypes } from "./eventBus";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportTarget {
  module: string;
  table: string;
  requiredFields: string[];
  optionalFields: string[];
  defaults: Record<string, unknown>;
  validators: Record<string, (val: unknown) => string | null>;
}

export interface ImportJob {
  id: string;
  orgId: string;
  userId: string;
  targetModule: string;
  targetTable: string;
  fileName: string;
  fileType: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  columnMapping: Record<string, string>;
}

export interface StagedRow {
  rowNumber: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  status: "pending" | "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  aiCorrections: Record<string, unknown>;
}

// ─── Supported Import Targets ────────────────────────────────────────────────

const IMPORT_TARGETS: Record<string, ImportTarget> = {
  "tc_financial_trades": {
    module: "trades",
    table: "tc_financial_trades",
    requiredFields: ["commodity_id", "direction", "trade_date", "contract_month", "num_contracts", "contract_size", "trade_price"],
    optionalFields: ["broker", "account_number", "commission", "fees", "notes", "external_ref"],
    defaults: { trade_type: "futures", status: "open", currency: "USD" },
    validators: {
      direction: (v) => ["long", "short"].includes(v as string) ? null : "Must be 'long' or 'short'",
      num_contracts: (v) => Number(v) > 0 ? null : "Must be positive",
      trade_price: (v) => !isNaN(Number(v)) ? null : "Must be a number",
    },
  },
  "pm_allocations": {
    module: "positions",
    table: "pm_allocations",
    requiredFields: ["site_id", "commodity_id", "allocated_volume", "trade_price"],
    optionalFields: ["trade_id", "budget_month", "contract_month", "direction", "notes"],
    defaults: { status: "open", direction: "long", currency: "USD" },
    validators: {
      allocated_volume: (v) => Number(v) > 0 ? null : "Must be positive",
      trade_price: (v) => !isNaN(Number(v)) ? null : "Must be a number",
    },
  },
  "pm_physical_positions": {
    module: "positions",
    table: "pm_physical_positions",
    requiredFields: ["site_id", "commodity_id", "direction", "volume"],
    optionalFields: ["price", "pricing_type", "basis_price", "basis_month", "delivery_month", "counterparty", "notes"],
    defaults: { status: "open", pricing_type: "fixed", currency: "USD" },
    validators: {
      direction: (v) => ["buy", "sell"].includes(v as string) ? null : "Must be 'buy' or 'sell'",
      volume: (v) => Number(v) > 0 ? null : "Must be positive",
    },
  },
  "bgt_line_items": {
    module: "budget",
    table: "bgt_line_items",
    requiredFields: ["period_id", "commodity_id", "volume"],
    optionalFields: ["budget_price", "budget_basis", "notes"],
    defaults: { currency: "USD" },
    validators: {
      volume: (v) => Number(v) >= 0 ? null : "Must be non-negative",
    },
  },
  "md_prices": {
    module: "market",
    table: "md_prices",
    requiredFields: ["commodity_id", "contract_month", "price_date", "settle_price"],
    optionalFields: ["open_price", "high_price", "low_price", "volume", "open_interest", "source"],
    defaults: { source: "import" },
    validators: {
      settle_price: (v) => !isNaN(Number(v)) ? null : "Must be a number",
    },
  },
  "ct_physical_contracts": {
    module: "contracts",
    table: "ct_physical_contracts",
    requiredFields: ["site_id", "commodity_id", "counterparty", "direction", "volume", "price"],
    optionalFields: ["contract_number", "delivery_start", "delivery_end", "pricing_type", "notes"],
    defaults: { status: "active", currency: "USD" },
    validators: {
      direction: (v) => ["buy", "sell"].includes(v as string) ? null : "Must be 'buy' or 'sell'",
    },
  },
  "lg_deliveries": {
    module: "logistics",
    table: "lg_deliveries",
    requiredFields: ["site_id", "commodity_id", "delivery_date", "volume"],
    optionalFields: ["contract_id", "ticket_number", "carrier", "grade", "moisture", "notes"],
    defaults: { status: "received" },
    validators: {
      volume: (v) => Number(v) > 0 ? null : "Must be positive",
    },
  },
};

// ─── Core Functions ──────────────────────────────────────────────────────────

/** Create an import job record */
export async function createImportJob(params: {
  orgId: string;
  userId: string;
  targetModule: string;
  targetTable: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  filePath?: string;
}): Promise<string> {
  const target = IMPORT_TARGETS[params.targetTable];
  if (!target) {
    throw new Error(`Unsupported import target: ${params.targetTable}`);
  }

  const result = await query<{ id: string }>(
    `INSERT INTO import_jobs (org_id, user_id, target_module, target_table, file_name, file_type, file_size, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [params.orgId, params.userId, params.targetModule, params.targetTable,
     params.fileName, params.fileType, params.fileSize ?? null, params.filePath ?? null]
  );

  return result.rows[0].id;
}

/** Stage parsed rows for review */
export async function stageRows(
  jobId: string,
  rows: Array<{ rawData: Record<string, unknown>; mappedData: Record<string, unknown> }>
): Promise<{ valid: number; warnings: number; errors: number }> {
  const job = await queryOne<{ target_table: string }>(
    `SELECT target_table FROM import_jobs WHERE id = $1`,
    [jobId]
  );
  if (!job) throw new Error("Import job not found");

  const target = IMPORT_TARGETS[job.target_table];
  if (!target) throw new Error(`No target config for ${job.target_table}`);

  let valid = 0, warnings = 0, errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // Check required fields
    for (const field of target.requiredFields) {
      if (row.mappedData[field] === undefined || row.mappedData[field] === null || row.mappedData[field] === "") {
        rowErrors.push(`Missing required field: ${field}`);
      }
    }

    // Run validators
    for (const [field, validator] of Object.entries(target.validators)) {
      const val = row.mappedData[field];
      if (val !== undefined && val !== null) {
        const err = validator(val);
        if (err) rowErrors.push(`${field}: ${err}`);
      }
    }

    const status = rowErrors.length > 0 ? "error" : rowWarnings.length > 0 ? "warning" : "valid";
    if (status === "valid") valid++;
    else if (status === "warning") warnings++;
    else errors++;

    await query(
      `INSERT INTO import_staged_rows (job_id, row_number, raw_data, mapped_data, status, errors, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jobId, i + 1, JSON.stringify(row.rawData), JSON.stringify(row.mappedData),
       status, JSON.stringify(rowErrors), JSON.stringify(rowWarnings)]
    );
  }

  // Update job counts
  await query(
    `UPDATE import_jobs SET total_rows = $2, valid_rows = $3, error_rows = $4, warning_rows = $5,
       status = 'validated', updated_at = NOW()
     WHERE id = $1`,
    [jobId, rows.length, valid, errors, warnings]
  );

  return { valid, warnings, errors };
}

/** Commit approved rows to their target table */
export async function commitImport(
  jobId: string,
  userId: string,
  orgId: string
): Promise<{ committed: number; skipped: number }> {
  const job = await queryOne<{ target_table: string; status: string }>(
    `SELECT target_table, status FROM import_jobs WHERE id = $1`,
    [jobId]
  );
  if (!job) throw new Error("Import job not found");
  if (job.status === "committed") throw new Error("Import already committed");

  const target = IMPORT_TARGETS[job.target_table];
  if (!target) throw new Error(`No target config for ${job.target_table}`);

  // Get all valid/warning rows (skip errors)
  const rows = await queryAll<{ id: string; mapped_data: Record<string, unknown>; status: string }>(
    `SELECT id, mapped_data, status FROM import_staged_rows
     WHERE job_id = $1 AND status IN ('valid', 'warning')
     ORDER BY row_number`,
    [jobId]
  );

  let committed = 0;
  const skipped = 0;

  await transaction(async (client) => {
    for (const row of rows) {
      const data = { ...target.defaults, ...row.mapped_data, org_id: orgId, import_job_id: jobId };
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

      await client.query(
        `INSERT INTO ${target.table} (${fields.join(", ")}) VALUES (${placeholders})`,
        values
      );

      // Mark row as committed
      await client.query(
        `UPDATE import_staged_rows SET status = 'committed', final_data = $2 WHERE id = $1`,
        [row.id, JSON.stringify(data)]
      );

      committed++;
    }

    // Update job status
    await client.query(
      `UPDATE import_jobs SET status = 'committed', reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId, userId]
    );
  });

  await auditLog({
    orgId,
    userId,
    module: "kernel",
    entityType: "import_job",
    entityId: jobId,
    action: "commit",
    after: { committed, skipped, targetTable: job.target_table },
  });

  await emit({
    type: EventTypes.IMPORT_COMMITTED,
    source: "import",
    entityType: "import_job",
    entityId: jobId,
    payload: { targetTable: job.target_table, committed },
    orgId,
    userId,
  });

  return { committed, skipped };
}

/** Find a matching template for auto-mapping */
export async function findMatchingTemplate(
  orgId: string,
  targetTable: string,
  headers: string[]
): Promise<Record<string, string> | null> {
  const templates = await queryAll<{ id: string; column_mapping: Record<string, string>; sample_headers: string[] }>(
    `SELECT id, column_mapping, sample_headers FROM import_templates
     WHERE org_id = $1 AND target_table = $2
     ORDER BY use_count DESC`,
    [orgId, targetTable]
  );

  for (const tmpl of templates) {
    if (!tmpl.sample_headers) continue;
    // Check if enough headers match
    const overlap = headers.filter((h) =>
      tmpl.sample_headers.some((sh) => sh.toLowerCase() === h.toLowerCase())
    );
    if (overlap.length >= tmpl.sample_headers.length * 0.7) {
      // Bump use count
      await query(
        `UPDATE import_templates SET use_count = use_count + 1, last_used_at = NOW() WHERE id = $1`,
        [tmpl.id]
      );
      return tmpl.column_mapping;
    }
  }

  return null;
}

/** Get supported import targets */
export function getSupportedTargets(): Array<{ table: string; module: string; requiredFields: string[]; optionalFields: string[] }> {
  return Object.entries(IMPORT_TARGETS).map(([table, config]) => ({
    table,
    module: config.module,
    requiredFields: config.requiredFields,
    optionalFields: config.optionalFields,
  }));
}
