import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getReleasedBreedCodes } from "@/server/services/breed.service";
import { ensureFoundationInventoryForBreed } from "@/server/services/foundationDog.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const startedAtMs = Date.now();
  try {
    const currentEpoch = getCurrentEpoch();
    const breedCode2List = await getReleasedBreedCodes();
    const failedBreedCodes: string[] = [];

    // Sequential orchestration bounds database load; FOUNDATION-05 retains
    // per-breed concurrency protection against player-triggered maintenance.
    for (const breedCode2 of breedCode2List) {
      try {
        await ensureFoundationInventoryForBreed({ breedCode2, currentEpoch });
      } catch (error) {
        failedBreedCodes.push(breedCode2);
        console.error("foundation-inventory-scheduled-maintenance-failed", {
          breedCode2,
          stage: "ensure-foundation-inventory",
          error,
        });
      }
    }

    const response = {
      ok: failedBreedCodes.length === 0,
      currentEpoch,
      eligibleBreeds: breedCode2List.length,
      processedBreeds: breedCode2List.length,
      succeededBreeds: breedCode2List.length - failedBreedCodes.length,
      failedBreeds: failedBreedCodes.length,
      failedBreedCodes,
      durationMs: Date.now() - startedAtMs,
      message:
        failedBreedCodes.length === 0
          ? "Foundation inventory scheduled maintenance completed."
          : "Foundation inventory scheduled maintenance completed with errors.",
    };

    console.info("foundation-inventory-scheduled-maintenance-summary", response);
    return NextResponse.json(response, {
      status: failedBreedCodes.length === 0 ? 200 : 207,
    });
  } catch (error) {
    console.error("GET /api/cron/maintain-foundation-inventory failed", { error });
    return NextResponse.json(
      { ok: false, error: "Foundation inventory scheduled maintenance failed." },
      { status: 500 }
    );
  }
}
