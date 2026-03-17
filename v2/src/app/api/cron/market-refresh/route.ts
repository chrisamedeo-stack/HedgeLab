import { NextResponse } from "next/server";
import { queryAll, query } from "@/lib/db";
import { refreshFromExternalApi } from "@/lib/marketDataService";

interface ActiveProvider {
  id: string;
  org_id: string;
  provider_type: string;
  poll_interval_minutes: number;
  last_poll_at: string | null;
}

export async function GET(request: Request) {
  // Verify cron secret (standard Vercel cron auth pattern)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all orgs with market_data plugin enabled
    const orgs = await queryAll<{ org_id: string }>(
      `SELECT org_id FROM org_plugins
       WHERE plugin_id = 'market_data' AND is_enabled = true`
    );

    let totalPolled = 0;
    let totalUpserted = 0;
    let totalErrors = 0;
    const orgResults: { orgId: string; providers: number; upserted: number; errors: number }[] = [];

    for (const { org_id: orgId } of orgs) {
      // Find active providers with polling enabled that are due for refresh
      const providers = await queryAll<ActiveProvider>(
        `SELECT id, org_id, provider_type, poll_interval_minutes, last_poll_at
         FROM md_providers
         WHERE org_id = $1
           AND is_active = true
           AND poll_interval_minutes > 0
           AND (
             last_poll_at IS NULL
             OR last_poll_at + (poll_interval_minutes || ' minutes')::interval <= NOW()
           )`,
        [orgId]
      );

      if (providers.length === 0) continue;

      let orgUpserted = 0;
      let orgErrors = 0;

      for (const provider of providers) {
        try {
          const result = await refreshFromExternalApi(orgId, 1);
          orgUpserted += result.upserted;
          orgErrors += result.errors;

          // Update last_poll_at and status
          await query(
            `UPDATE md_providers
             SET last_poll_at = NOW(),
                 last_poll_status = $2
             WHERE id = $1`,
            [provider.id, result.errors > 0 ? "partial" : "success"]
          );
        } catch (err) {
          orgErrors++;
          await query(
            `UPDATE md_providers
             SET last_poll_at = NOW(),
                 last_poll_status = $2
             WHERE id = $1`,
            [provider.id, `error: ${(err as Error).message.slice(0, 200)}`]
          );
        }

        totalPolled++;
      }

      totalUpserted += orgUpserted;
      totalErrors += orgErrors;
      orgResults.push({
        orgId,
        providers: providers.length,
        upserted: orgUpserted,
        errors: orgErrors,
      });
    }

    return NextResponse.json({
      orgs: orgs.length,
      polled: totalPolled,
      upserted: totalUpserted,
      errors: totalErrors,
      details: orgResults,
    });
  } catch (err) {
    console.error("[cron/market-refresh] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
