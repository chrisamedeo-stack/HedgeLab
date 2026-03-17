import { NextResponse } from "next/server";
import { getApiUser, AuthError } from "@/lib/auth";
import { getLastPollStatus } from "@/lib/marketDataService";

export async function GET() {
  try {
    const user = await getApiUser();
    const status = await getLastPollStatus(user.orgId);
    return NextResponse.json(status ?? { lastPollAt: null, lastPollStatus: null, providerName: null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
