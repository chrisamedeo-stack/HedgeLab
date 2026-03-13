import * as XLSX from "xlsx";
import type { MarketDataProvider, ParsedRow, ValidationError, IngestResult, ParseFileOptions } from "../types";
import { upsertPriceRow } from "./manual";
import { getSymbolMap, parseContractCode, applyMultiplier } from "../symbolMap";

// ─── Column Detection ─────────────────────────────────────────────────────

const HEADER_PATTERNS: Record<string, RegExp> = {
  date:       /^(date|price.?date|trade.?date|as.?of)$/i,
  settle:     /^(settle|settlement|close|last|price)$/i,
  open:       /^(open|open.?price)$/i,
  high:       /^(high|high.?price|hi)$/i,
  low:        /^(low|low.?price|lo)$/i,
  volume:     /^(volume|vol|qty)$/i,
  oi:         /^(oi|open.?interest|open.?int)$/i,
  contract:   /^(contract|month|contract.?month|delivery|expiry|symbol)$/i,
  commodity:  /^(commodity|product|ticker|code)$/i,
};

function detectColumnMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? "").trim();
    if (!h) continue;
    for (const [field, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (pattern.test(h)) {
        map[i] = field;
        break;
      }
    }
  }
  return map;
}

function excelDateToISO(serial: number): string {
  // Excel serial date → JS date
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().split("T")[0];
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return excelDateToISO(value);
  const s = String(value).trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // Try Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function normalizeMonth(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // Standard contract code like ZCN25
  const parsed = parseContractCode(s);
  if (parsed) return parsed.month;
  // YYYY-MM-DD → take YYYY-MM
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return null;
}

// ─── Excel Provider ───────────────────────────────────────────────────────

export const excelProvider: MarketDataProvider = {
  name: "excel",
  supportedFormats: [".xlsx", ".xls", ".csv"],

  validateRow(row: Partial<ParsedRow>, rowIndex: number): ValidationError[] {
    const errors: ValidationError[] = [];
    if (!row.commodityId) errors.push({ row: rowIndex, field: "commodityId", message: "Required" });
    if (!row.contractMonth || !/^\d{4}-\d{2}$/.test(row.contractMonth)) {
      errors.push({ row: rowIndex, field: "contractMonth", message: "Must be YYYY-MM format" });
    }
    if (!row.priceDate || !/^\d{4}-\d{2}-\d{2}$/.test(row.priceDate)) {
      errors.push({ row: rowIndex, field: "priceDate", message: "Must be YYYY-MM-DD format" });
    }
    if (row.settle === undefined || row.settle === null || isNaN(Number(row.settle))) {
      errors.push({ row: rowIndex, field: "settle", message: "Must be a valid number" });
    }
    return errors;
  },

  async parseFile(buffer: Buffer, options?: ParseFileOptions): Promise<ParsedRow[]> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetIndex = options?.sheetIndex ?? 0;
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) throw new Error("No sheet found at index " + sheetIndex);
    const sheet = wb.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (raw.length < 2) throw new Error("File must have at least a header row and one data row");

    // Detect header row
    const headerRowIdx = options?.headerRow ?? 0;
    const headers = (raw[headerRowIdx] as unknown[]).map((h) => String(h ?? ""));
    const colMap = options?.columnMap
      ? Object.fromEntries(
          Object.entries(options.columnMap).map(([col, field]) => [
            headers.findIndex((h) => h.toLowerCase() === col.toLowerCase()),
            field,
          ]).filter(([i]) => (i as number) >= 0)
        )
      : detectColumnMap(headers);

    // Resolve symbol map if provider specified
    let symbolMap: Map<string, { commodityId: string; multiplier: number }> | null = null;
    if (options?.providerId && options?.orgId) {
      symbolMap = await getSymbolMap(options.orgId, options.providerId);
    }

    const rows: ParsedRow[] = [];

    for (let r = headerRowIdx + 1; r < raw.length; r++) {
      const dataRow = raw[r] as unknown[];
      if (!dataRow || dataRow.every((c) => c === null || c === "")) continue;

      let commodityId = "";
      let contractMonth = "";
      let priceDate = "";
      let settle = 0;
      let open: number | undefined;
      let high: number | undefined;
      let low: number | undefined;
      let volume: number | undefined;
      let openInterest: number | undefined;
      let multiplier = 1;

      for (const [colIdxStr, field] of Object.entries(colMap)) {
        const colIdx = Number(colIdxStr);
        const val = dataRow[colIdx];
        if (val === null || val === undefined) continue;

        switch (field) {
          case "date":
            priceDate = normalizeDate(val) ?? "";
            break;
          case "settle":
            settle = Number(val);
            break;
          case "open":
            open = Number(val) || undefined;
            break;
          case "high":
            high = Number(val) || undefined;
            break;
          case "low":
            low = Number(val) || undefined;
            break;
          case "volume":
            volume = Number(val) || undefined;
            break;
          case "oi":
            openInterest = Number(val) || undefined;
            break;
          case "contract": {
            const monthVal = normalizeMonth(val);
            if (monthVal) {
              contractMonth = monthVal;
              // Try to extract commodity from contract code
              const parsed = parseContractCode(String(val));
              if (parsed && !commodityId) {
                // Resolve via symbol map if available
                if (symbolMap) {
                  const resolved = symbolMap.get(parsed.root);
                  if (resolved) {
                    commodityId = resolved.commodityId;
                    multiplier = resolved.multiplier;
                  }
                }
              }
            }
            break;
          }
          case "commodity":
            commodityId = String(val);
            // Check symbol map
            if (symbolMap) {
              const resolved = symbolMap.get(String(val));
              if (resolved) {
                commodityId = resolved.commodityId;
                multiplier = resolved.multiplier;
              }
            }
            break;
        }
      }

      if (settle && priceDate) {
        rows.push({
          commodityId,
          contractMonth,
          priceDate,
          settle: applyMultiplier(settle, multiplier),
          open: open !== undefined ? applyMultiplier(open, multiplier) : undefined,
          high: high !== undefined ? applyMultiplier(high, multiplier) : undefined,
          low: low !== undefined ? applyMultiplier(low, multiplier) : undefined,
          volume,
          openInterest,
        });
      }
    }

    return rows;
  },

  async ingestPrices(rows: ParsedRow[], orgId: string, userId: string): Promise<IngestResult> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: ValidationError[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowErrors = excelProvider.validateRow(rows[i], i);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        skipped++;
        continue;
      }

      try {
        const { action } = await upsertPriceRow(rows[i], orgId, userId, "excel");
        if (action === "inserted") inserted++;
        else updated++;
      } catch (err) {
        errors.push({ row: i, field: "general", message: (err as Error).message });
        skipped++;
      }
    }

    return { inserted, updated, skipped, errors };
  },
};
