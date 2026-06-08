import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listStewardingOpportunities } from "@/server/services/kennelService.service";

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const currentEpoch = getCurrentEpoch();
    const opportunities = await listStewardingOpportunities({
      kennelId: kennel.id,
      currentEpoch,
    });

    return NextResponse.json({
      ok: true,
      currentEpoch,
      opportunities,
    });
  } catch (error) {
    console.error("GET /api/kennel/services/stewarding failed:", error);
    return NextResponse.json(
      { error: "Unable to load stewarding opportunities." },
      { status: 500 }
    );
  }
}
