import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import {
  createImportJob,
  stageRows,
  commitImport,
  findMatchingTemplate,
  getSupportedTargets,
} from "@/lib/importEngine";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    const jobId = searchParams.get("jobId");

    // Get a specific job with its staged rows
    if (jobId) {
      const job = await queryOne(
        `SELECT * FROM import_jobs WHERE id = $1`,
        [jobId]
      );
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      const rows = await queryAll(
        `SELECT id, row_number, raw_data, mapped_data, status, errors, warnings, ai_corrections, user_overrides, final_data
         FROM import_staged_rows WHERE job_id = $1 ORDER BY row_number`,
        [jobId]
      );

      return NextResponse.json({ job, rows });
    }

    // List jobs for org
    if (!orgId) {
      return NextResponse.json(
        { error: "Missing orgId or jobId parameter" },
        { status: 400 }
      );
    }

    const jobs = await queryAll(
      `SELECT ij.*, u.name as user_name
       FROM import_jobs ij
       LEFT JOIN users u ON u.id = ij.user_id
       WHERE ij.org_id = $1
       ORDER BY ij.created_at DESC
       LIMIT 50`,
      [orgId]
    );

    return NextResponse.json(jobs);
  } catch (err) {
    console.error("[import] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "targets": {
        // List supported import targets
        return NextResponse.json(getSupportedTargets());
      }

      case "create": {
        // Create a new import job
        const jobId = await createImportJob({
          orgId: body.orgId,
          userId: body.userId,
          targetModule: body.targetModule,
          targetTable: body.targetTable,
          fileName: body.fileName,
          fileType: body.fileType,
          fileSize: body.fileSize,
          filePath: body.filePath,
        });
        return NextResponse.json({ jobId }, { status: 201 });
      }

      case "stage": {
        // Stage parsed rows for review
        const result = await stageRows(body.jobId, body.rows);
        return NextResponse.json(result);
      }

      case "commit": {
        // Commit approved rows
        const result = await commitImport(body.jobId, body.userId, body.orgId);
        return NextResponse.json(result);
      }

      case "find-template": {
        // Find matching template for auto-mapping
        const mapping = await findMatchingTemplate(
          body.orgId,
          body.targetTable,
          body.headers
        );
        return NextResponse.json({ mapping });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action. Use: targets, create, stage, commit, find-template" },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[import] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
