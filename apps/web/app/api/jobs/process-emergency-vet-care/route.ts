import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/jobAuthorization";
import { processExpiredEmergencyCareEvents } from "@/server/services/emergencyVetCare.service";
import { processAuthorizedReproductiveEmergencyEvents, processExpiredReproductiveEmergencyEvents } from "@/server/services/reproductiveEmergencyResolution.service";

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

async function runJob(request: Request) {
  const startedAtMs = Date.now();
  const cronSecret = process.env.CRON_SECRET;
  const manualSecret = process.env.SHOWRING_JOBS_SECRET;

  if (!cronSecret && !manualSecret && process.env.NODE_ENV === "production") {
    return fail("A job authorization secret is required in production.", 500);
  }

  if (
    !isAuthorizedJobRequest({
      authorization: request.headers.get("authorization"),
      cronSecret,
      manualSecret,
    })
  ) {
    return fail("Unauthorized.", 401);
  }

  try {
    const currentEpoch = getCurrentEpoch();
    const { searchParams } = new URL(request.url);
    const result = await processExpiredEmergencyCareEvents({
      currentEpoch,
      limit: parseBatchSize(searchParams.get("limit") ?? undefined),
    });
    const reproductiveResult = await processExpiredReproductiveEmergencyEvents({
      currentEpoch,
      limit: parseBatchSize(searchParams.get("limit") ?? undefined),
    });
    const authorizedReproductiveResult = await processAuthorizedReproductiveEmergencyEvents({
      currentEpoch,
      limit: parseBatchSize(searchParams.get("limit") ?? undefined),
    });
    const summary = {
      ...result,
      reproductive: reproductiveResult,
      authorizedReproductive: authorizedReproductiveResult,
      treatedReproductive: authorizedReproductiveResult,
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

export async function POST(request: Request) {
  return runJob(request);
}

export async function GET(request: Request) {
  return runJob(request);
}
