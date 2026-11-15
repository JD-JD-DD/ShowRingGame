import { NextResponse } from "next/server";

import {
  refreshDueOverallKennelPrestigeLeaderboard,
  type OverallKennelPrestigeLeaderboardRefreshResult,
} from "@/server/services/kennelPrestigeLeaderboard.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RefreshDue = () => Promise<OverallKennelPrestigeLeaderboardRefreshResult>;

export function createRefreshKennelPrestigeLeaderboardCronHandler(
  args: { refreshDue?: RefreshDue } = {}
) {
  const refreshDue = args.refreshDue ?? refreshDueOverallKennelPrestigeLeaderboard;

  return async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("Authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }

    const startedAtMs = Date.now();
    try {
      const result = await refreshDue();
      const published = result.outcome === "published";
      const failed = result.outcome === "failed";
      const response = {
        ok: !failed,
        outcome: result.outcome,
        published,
        durationMs: Date.now() - startedAtMs,
      };

      console.info("refresh-kennel-prestige-leaderboard-cron-summary", {
        route: "/api/cron/refresh-kennel-prestige-leaderboard",
        ...response,
      });

      return NextResponse.json(response, { status: failed ? 500 : 200 });
    } catch (error) {
      const response = {
        ok: false,
        outcome: "failed",
        published: false,
        durationMs: Date.now() - startedAtMs,
      };
      console.error("GET /api/cron/refresh-kennel-prestige-leaderboard failed", {
        route: "/api/cron/refresh-kennel-prestige-leaderboard",
        durationMs: response.durationMs,
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json(
        { ...response, error: "Kennel prestige leaderboard refresh failed." },
        { status: 500 }
      );
    }
  };
}

export const GET = createRefreshKennelPrestigeLeaderboardCronHandler();
