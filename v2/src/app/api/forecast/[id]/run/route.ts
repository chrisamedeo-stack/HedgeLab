import { NextResponse } from "next/server";
import { runScenario, getScenario } from "@/lib/forecastService";
import { requirePlugin, PluginNotEnabledError } from "@/lib/orgHierarchy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const scenario = await getScenario(id);
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    await requirePlugin(scenario.org_id, "forecast");

    const result = await runScenario(id, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[forecast/:id/run] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
