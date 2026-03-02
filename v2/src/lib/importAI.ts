import Anthropic from "@anthropic-ai/sdk";
import { query } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnMappingResult {
  mapping: Record<string, string>;
  confidence: Record<string, number>;
  unmapped: string[];
}

export interface RowCorrection {
  field: string;
  from: unknown;
  to: unknown;
}

export interface RowCorrectionResult {
  correctedRows: Record<string, unknown>[];
  corrections: Record<string, RowCorrection>[];
}

interface TargetSchema {
  requiredFields: string[];
  optionalFields: string[];
}

// ─── Claude Client ───────────────────────────────────────────────────────────

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// ─── Fuzzy Fallback ──────────────────────────────────────────────────────────

function fuzzyMatch(source: string, target: string): number {
  const s = source.toLowerCase().replace(/[^a-z0-9]/g, "");
  const t = target.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s === t) return 1.0;
  if (s.includes(t) || t.includes(s)) return 0.8;
  // Check common synonyms
  const synonyms: Record<string, string[]> = {
    commodity_id: ["commodity", "product", "item", "grain"],
    direction: ["side", "buysell", "buy_sell", "type"],
    trade_date: ["date", "tradedate", "execution_date", "execdate"],
    trade_price: ["price", "tradeprice", "exec_price", "fill_price"],
    contract_month: ["month", "contractmonth", "futures_month", "delivery"],
    num_contracts: ["contracts", "lots", "quantity", "qty", "numcontracts"],
    contract_size: ["size", "contractsize", "lotsize"],
    allocated_volume: ["volume", "vol", "amount", "tonnes", "mt"],
    site_id: ["site", "location", "plant", "facility"],
    delivery_month: ["deliverymonth", "delmonth", "shipment"],
    counterparty: ["counter_party", "cp", "vendor", "supplier", "buyer"],
    settle_price: ["settlement", "close", "closing_price", "settleprice"],
    price_date: ["pricedate", "date", "asof"],
    volume: ["vol", "amount", "tonnes", "mt", "quantity", "qty"],
    broker: ["brokerage", "clearingfirm"],
    delivery_date: ["deliverydate", "shipdate", "arrivaldate"],
  };
  const targetSyns = synonyms[t] ?? [];
  if (targetSyns.some((syn) => s.includes(syn) || syn.includes(s))) return 0.6;
  return 0;
}

function fallbackMapping(sourceHeaders: string[], targetSchema: TargetSchema): ColumnMappingResult {
  const allFields = [...targetSchema.requiredFields, ...targetSchema.optionalFields];
  const mapping: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const unmapped: string[] = [];

  for (const header of sourceHeaders) {
    let bestField = "";
    let bestScore = 0;
    for (const field of allFields) {
      const score = fuzzyMatch(header, field);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
    if (bestScore >= 0.5) {
      mapping[header] = bestField;
      confidence[header] = bestScore;
    } else {
      unmapped.push(header);
    }
  }

  return { mapping, confidence, unmapped };
}

// ─── AI Column Mapping ───────────────────────────────────────────────────────

export async function suggestColumnMapping(
  sourceHeaders: string[],
  targetSchema: TargetSchema,
  jobId?: string
): Promise<ColumnMappingResult> {
  const client = getClient();
  if (!client) {
    return fallbackMapping(sourceHeaders, targetSchema);
  }

  const systemPrompt =
    "You are a data mapping assistant for a commodity trading system. " +
    "Return ONLY valid JSON, no markdown fences, no explanation.";

  const userPrompt =
    `Given these CSV headers: ${JSON.stringify(sourceHeaders)}\n\n` +
    `And this target schema:\n` +
    `Required fields: ${JSON.stringify(targetSchema.requiredFields)}\n` +
    `Optional fields: ${JSON.stringify(targetSchema.optionalFields)}\n\n` +
    `Return a JSON object with:\n` +
    `- "mapping": { "sourceHeader": "targetField" } for each header that maps to a target field\n` +
    `- "confidence": { "sourceHeader": 0.0-1.0 } confidence score for each mapping\n` +
    `- "unmapped": ["header1", ...] headers that don't map to any target field\n\n` +
    `Rules:\n` +
    `- Match semantically, not just by exact name\n` +
    `- Common synonyms: "qty"→"num_contracts", "vol"→"volume", "side"→"direction", etc.\n` +
    `- If unsure, set low confidence (<0.5) rather than omitting`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text) as ColumnMappingResult;

    // Store AI prompt + response on job for audit
    if (jobId) {
      await query(
        `UPDATE import_jobs SET ai_model = $2, ai_prompt_used = $3, ai_raw_response = $4, updated_at = NOW() WHERE id = $1`,
        [jobId, "claude-sonnet-4-20250514", userPrompt, text]
      );
    }

    return {
      mapping: parsed.mapping ?? {},
      confidence: parsed.confidence ?? {},
      unmapped: parsed.unmapped ?? [],
    };
  } catch (err) {
    console.error("[importAI] Column mapping failed, falling back to fuzzy match:", err);
    return fallbackMapping(sourceHeaders, targetSchema);
  }
}

// ─── AI Row Corrections ─────────────────────────────────────────────────────

export async function suggestRowCorrections(
  rows: Record<string, unknown>[],
  targetSchema: TargetSchema,
  commodities: { id: string; name: string; code?: string }[],
  jobId?: string
): Promise<RowCorrectionResult> {
  const client = getClient();
  if (!client) {
    // No AI — return rows unchanged
    return { correctedRows: rows, corrections: rows.map(() => ({})) };
  }

  const allCorrectedRows: Record<string, unknown>[] = [];
  const allCorrections: Record<string, RowCorrection>[] = [];
  const BATCH_SIZE = 50;

  const systemPrompt =
    "You are a data normalization assistant for a commodity trading system. " +
    "Return ONLY valid JSON, no markdown fences, no explanation.";

  const commodityList = commodities.map((c) => `${c.id} (${c.name}${c.code ? ", " + c.code : ""})`).join(", ");
  const allFields = [...targetSchema.requiredFields, ...targetSchema.optionalFields];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const userPrompt =
      `Normalize these ${batch.length} data rows for a commodity trading system.\n\n` +
      `Target fields: ${JSON.stringify(allFields)}\n` +
      `Known commodities: ${commodityList}\n\n` +
      `Rules:\n` +
      `- Commodity abbreviations to full IDs (C->CORN, S->SOYBEAN, W->WHEAT, etc.)\n` +
      `- Date formats to YYYY-MM-DD\n` +
      `- Direction synonyms: buy/long, sell/short (use long/short for futures, buy/sell for physical)\n` +
      `- Strip currency symbols from numbers\n` +
      `- Contract months to standard format: Jul26->N26, Dec25->Z25\n` +
      `  (F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec)\n` +
      `- Numbers: remove commas, convert to plain decimals\n\n` +
      `Input rows:\n${JSON.stringify(batch)}\n\n` +
      `Return JSON:\n` +
      `{\n` +
      `  "correctedRows": [<same rows with corrected values>],\n` +
      `  "corrections": [<one object per row, each mapping field->{ "from": original, "to": corrected } for changed fields only>]\n` +
      `}`;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(text) as { correctedRows: Record<string, unknown>[]; corrections: Record<string, RowCorrection>[] };

      allCorrectedRows.push(...(parsed.correctedRows ?? batch));
      allCorrections.push(...(parsed.corrections ?? batch.map(() => ({}))));

      // Store AI interaction on the job
      if (jobId && i === 0) {
        await query(
          `UPDATE import_jobs SET ai_model = $2, ai_prompt_used = $3, ai_raw_response = $4, updated_at = NOW() WHERE id = $1`,
          [jobId, "claude-sonnet-4-20250514", userPrompt, text]
        );
      }
    } catch (err) {
      console.error(`[importAI] Row correction batch ${i} failed, using raw data:`, err);
      allCorrectedRows.push(...batch);
      allCorrections.push(...batch.map(() => ({})));
    }
  }

  return { correctedRows: allCorrectedRows, corrections: allCorrections };
}
