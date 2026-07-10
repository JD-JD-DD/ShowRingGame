import { NextResponse } from "next/server";
import { getCurrentEpoch } from "@/lib/gameClock";
import { resolveDueBreedingProgressBatch } from "@/server/services/breeding.service";

export const dynamic = "force-dynamic";

const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 100;

function getLimitParam(request: Request): number {
  const requestedValue = new URL(request.url, "http://localhost").searchParams.get(
    "limit"
  );
  const parsed = Number.parseInt(requestedValue ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_LIMIT;
  }

  return Math.min(parsed, MAX_BATCH_LIMIT);
}

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
  const limit = getLimitParam(request);
  const startedAt = Date.now();

  try {
    const summary = await resolveDueBreedingProgressBatch({
      currentEpoch,
      limit,
    });
    const response = {
      ok: true,
      currentEpoch,
      limit,
      checkedCount: summary.checkedCount,
      becamePregnantCount: summary.becamePregnantCount,
      didNotTakeCount: summary.didNotTakeCount,
      whelpedCount: summary.whelpedCount,
      skippedCount: summary.skippedCount,
      failedCount: summary.failedCount,
      durationMs: Date.now() - startedAt,
      message: "Breeding progress resolution completed.",
    };

    console.info("resolve-breeding-progress cron summary", response);

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/cron/resolve-breeding-progress failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Resolve breeding progress cron failed.",
      },
      { status: 500 }
    );
  }
}
