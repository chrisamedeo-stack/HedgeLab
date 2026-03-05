import { NextResponse } from "next/server";
import { listScenarios, createScenario } from "@/lib/forecastService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    await requirePlugin(orgId, "forecast");

    const scenarios = await listScenarios(orgId, {
      scenarioType: (searchParams.get("scenarioType") as "price_move" | "volume_change" | "what_if" | "stress_test") ?? undefined,
      status: (searchParams.get("status") as "draft" | "running" | "completed" | "failed") ?? undefined,
      baseCommodity: searchParams.get("baseCommodity") ?? undefined,
    });

    return NextResponse.json(scenarios);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[forecast] GET error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, userId, name, description, scenarioType, baseDate, baseCommodity, baseSiteId, assumptions } = body;

    if (!orgId || !userId || !name || !scenarioType || !assumptions) {
      return NextResponse.json(
        { error: "Missing required fields: orgId, userId, name, scenarioType, assumptions" },
        { status: 400 }
      );
    }

    await requirePlugin(orgId, "forecast");

    const scenario = await createScenario({
      orgId, userId, name, description, scenarioType,
      baseDate, baseCommodity, baseSiteId, assumptions,
    });

    return NextResponse.json(scenario, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[forecast] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
