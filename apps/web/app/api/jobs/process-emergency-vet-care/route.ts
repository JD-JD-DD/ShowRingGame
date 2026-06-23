import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { processExpiredEmergencyCareEvents } from "@/server/services/emergencyVetCare.service";

export const dynamic = "force-dynamic";

const DEFAULT_EXPIRATION_BATCH_SIZE = 100;
const MAX_EXPIRATION_BATCH_SIZE = 500;

function parseBatchSize(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_EXPIRATION_BATCH_SIZE;
  }

  return Math.min(parsed, MAX_EXPIRATION_BATCH_SIZE);
}

export async function POST(request: Request) {
  const startedAtMs = Date.now();
  const secret = process.env.SHOWRING_JOBS_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return fail("SHOWRING_JOBS_SECRET is required in production.", 500);
  }

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("Unauthorized.", 401);
  }

  try {
    const currentEpoch = getCurrentEpoch();
    const { searchParams } = new URL(request.url);
    const result = await processExpiredEmergencyCareEvents({
      currentEpoch,
      limit: parseBatchSize(searchParams.get("limit") ?? undefined),
    });
    const summary = {
      ...result,
      currentEpoch,
      durationMs: Date.now() - startedAtMs,
    };

    console.info("process-emergency-vet-care summary", summary);

    return ok({ summary });
  } catch (error) {
    console.error("POST /api/jobs/process-emergency-vet-care failed:", error);

    return fail(
      error instanceof Error
        ? error.message
        : "Unable to process emergency vet care.",
      500
    );
  }
}
