import { NextResponse } from "next/server";
import {
  parsePublishShowResultsBatchSize,
  PublishShowResultsJobPreflightError,
  runPublishShowResultsJob,
} from "@/server/services/publishShowResultsJob.service";

export const dynamic = "force-dynamic";

const DEFAULT_FINALIZE_BATCH_SIZE = 1;
const MAX_FINALIZE_BATCH_SIZE = 1;
const MAX_RUNTIME_MS = 110_000;

function getBatchSizeParam(request: Request): number {
  const requestedValue = new URL(request.url, "http://localhost").searchParams.get(
    "finalizeBatchSize"
  );

  return parsePublishShowResultsBatchSize(
    requestedValue ?? undefined,
    DEFAULT_FINALIZE_BATCH_SIZE,
    MAX_FINALIZE_BATCH_SIZE
  );
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

  const finalizeBatchSize = getBatchSizeParam(request);

  try {
    const payload = await runPublishShowResultsJob({
      blockBatchSize: 0,
      finalizeBatchSize,
      trigger: "VERCEL_CRON_FINALIZERS",
      runBlocks: false,
      runFinalizers: true,
      runEmptyClosures: true,
      runInvitationals: true,
      maxRuntimeMs: MAX_RUNTIME_MS,
    });
    const response = {
      ok: true,
      currentEpoch: payload.currentEpoch,
      finalizeBatchSize: payload.finalizeBatchSize,
      readyFinalizerBacklogCount: payload.readyFinalizerBacklogCount,
      finalizedShowDays: payload.summary.finalizedShowDays,
      failedCount: payload.summary.failedCount,
      durationMs: payload.summary.durationMs,
      message: payload.summary.stoppedForRuntimeBudget
        ? "Show result finalization paused at runtime budget."
        : "Show result finalization completed.",
    };

    console.info("finalize-show-results cron summary", {
      trigger: "VERCEL_CRON_FINALIZERS",
      phase: "finalizers",
      closedEmptyShowDays: payload.summary.closedEmptyShowDays,
      phaseDurationsMs: payload.summary.phaseDurationsMs,
      ...response,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PublishShowResultsJobPreflightError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: "P1001",
          detail: error.detail,
        },
        { status: 503 }
      );
    }

    console.error("GET /api/cron/finalize-show-results failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Finalize show results cron failed.",
      },
      { status: 500 }
    );
  }
}
