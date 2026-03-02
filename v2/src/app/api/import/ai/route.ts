import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { suggestColumnMapping, suggestRowCorrections } from "@/lib/importAI";
import { getSupportedTargets } from "@/lib/importEngine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "map": {
        // AI column mapping
        const { jobId, userId, sourceHeaders, targetTable } = body;
        await requirePermission(userId, "import.upload");

        // Look up target schema
        const targets = getSupportedTargets();
        const target = targets.find((t) => t.table === targetTable);
        if (!target) {
          return NextResponse.json({ error: `Unknown target: ${targetTable}` }, { status: 400 });
        }

        const result = await suggestColumnMapping(
          sourceHeaders,
          { requiredFields: target.requiredFields, optionalFields: target.optionalFields },
          jobId
        );

        // Save column mapping to the job
        if (jobId) {
          await query(
            `UPDATE import_jobs SET column_mapping = $2, updated_at = NOW() WHERE id = $1`,
            [jobId, JSON.stringify(result.mapping)]
          );
        }

        return NextResponse.json(result);
      }

      case "correct": {
        // AI row corrections
        const { jobId, userId, rows, targetTable } = body;
        await requirePermission(userId, "import.upload");

        const targets = getSupportedTargets();
        const target = targets.find((t) => t.table === targetTable);
        if (!target) {
          return NextResponse.json({ error: `Unknown target: ${targetTable}` }, { status: 400 });
        }

        // Fetch commodities for normalization context
        const { rows: commodities } = await query<{ id: string; name: string; code: string }>(
          `SELECT id, name, code FROM commodities WHERE active = true`
        );

        const result = await suggestRowCorrections(
          rows,
          { requiredFields: target.requiredFields, optionalFields: target.optionalFields },
          commodities,
          jobId
        );

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: map, correct" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[import/ai] Error:", err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
