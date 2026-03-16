import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import pool from "./db";

/** Run all pending SQL migrations from the migrations/ directory */
export async function runMigrations(): Promise<string[]> {
  const client = await pool.connect();
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(500) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await client.query<{ filename: string }>(
      `SELECT filename FROM _migrations ORDER BY id`
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    // Read migration files
    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const newlyApplied: string[] = [];

    for (const file of files) {
      if (appliedSet.has(file)) continue;

      console.info(`[migrate] Applying ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), "utf-8");

      await client.query(sql);
      await client.query(
        `INSERT INTO _migrations (filename) VALUES ($1)`,
        [file]
      );
      newlyApplied.push(file);
      console.info(`[migrate] Applied ${file}`);
    }

    if (newlyApplied.length === 0) {
      console.info("[migrate] No new migrations to apply.");
    }

    return newlyApplied;
  } finally {
    client.release();
  }
}
