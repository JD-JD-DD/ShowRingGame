import { NextResponse } from "next/server";

import { runBreedKennelPrestigeLeaderboardCron } from "@/server/services/breedKennelPrestigeLeaderboardOrchestration.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RunCron = typeof runBreedKennelPrestigeLeaderboardCron;

export function createProcessBreedKennelPrestigeLeaderboardCronHandler(
  args: { runCron?: RunCron } = {}
) {
  const runCron = args.runCron ?? runBreedKennelPrestigeLeaderboardCron;

  return async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const startedAtMs = Date.now();
    try {
      const result = await runCron();
      const failed = result.outcome === "calculation_failed" || result.outcome === "publication_failed";
      const response = { ok: !failed, ...result, durationMs: Date.now() - startedAtMs };
      console.info("process-breed-kennel-prestige-leaderboard-cron-summary", {
        route: "/api/cron/process-breed-kennel-prestige-leaderboard",
        ...response,
      });
      return NextResponse.json(response, { status: failed ? 500 : 200 });
    } catch (error) {
      const response = { ok: false, outcome: "failed", durationMs: Date.now() - startedAtMs };
      console.error("GET /api/cron/process-breed-kennel-prestige-leaderboard failed", {
        route: "/api/cron/process-breed-kennel-prestige-leaderboard",
        durationMs: response.durationMs,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json({ ...response, error: "Breed kennel prestige leaderboard cron failed." }, { status: 500 });
    }
  };
}

export const GET = createProcessBreedKennelPrestigeLeaderboardCronHandler();
