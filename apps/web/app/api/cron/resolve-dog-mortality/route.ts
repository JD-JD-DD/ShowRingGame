import { NextResponse } from "next/server";
import { getCurrentEpoch } from "@/lib/gameClock";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  const currentEpoch = getCurrentEpoch();
  const startedAt = Date.now();

  try {
    const result = await resolveDogDeaths({ currentEpoch });
    const response = {
      ok: true,
      currentEpoch,
      candidatesEvaluated: result.candidatesEvaluated,
      dueCandidates: result.dueCandidates,
      processedCandidates: result.processedCandidates,
      remainingDueBacklog: Math.max(
        0,
        result.dueCandidates - result.processedCandidates
      ),
      deathsFinalized: result.deceasedDogIds.length,
      deceasedDogIds: result.deceasedDogIds,
      deaths: result.deceasedDogs,
      durationMs: Date.now() - startedAt,
      message: "Scheduled dog mortality resolution completed.",
    };

    console.info("resolve-dog-mortality cron summary", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/cron/resolve-dog-mortality failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Resolve dog mortality cron failed.",
      },
      { status: 500 }
    );
  }
}
