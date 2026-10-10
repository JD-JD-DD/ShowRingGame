import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { maintainDueBreedGeneticBackgroundSnapshots } from "@/server/services/breedGeneticBackgroundProgression.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const summary = await maintainDueBreedGeneticBackgroundSnapshots({
      currentEpoch: getCurrentEpoch(),
    });
    const response = {
      ok: summary.failedYears === 0,
      ...summary,
      message:
        summary.failedYears === 0
          ? "Breed genetic background scheduled maintenance completed."
          : "Breed genetic background scheduled maintenance completed with errors.",
    };
    console.info("breed-genetic-background-scheduled-maintenance-summary", response);
    return NextResponse.json(response, {
      status: summary.failedYears === 0 ? 200 : 207,
    });
  } catch (error) {
    console.error("GET /api/cron/maintain-breed-genetic-background failed", {
      error,
    });
    return NextResponse.json(
      { ok: false, error: "Breed genetic background scheduled maintenance failed." },
      { status: 500 }
    );
  }
}
