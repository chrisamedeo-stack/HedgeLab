import { NextResponse } from "next/server";
import { cloneScenario, getScenario } from "@/lib/forecastService";
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

    const clone = await cloneScenario(id, userId);
    return NextResponse.json(clone, { status: 201 });
  } catch (err) {
    if (err instanceof PluginNotEnabledError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[forecast/:id/clone] POST error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
