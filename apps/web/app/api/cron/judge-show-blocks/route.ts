import { NextResponse } from "next/server";
import {
  parsePublishShowResultsBatchSize,
  PublishShowResultsJobPreflightError,
  runPublishShowResultsJob,
} from "@/server/services/publishShowResultsJob.service";

export const dynamic = "force-dynamic";

const DEFAULT_BLOCK_BATCH_SIZE = 8;
const MAX_BLOCK_BATCH_SIZE = 12;
const MAX_RUNTIME_MS = 110_000;

function getBatchSizeParam(request: Request): number {
  const requestedValue = new URL(request.url, "http://localhost").searchParams.get(
    "blockBatchSize"
  );

  return parsePublishShowResultsBatchSize(
    requestedValue ?? undefined,
    DEFAULT_BLOCK_BATCH_SIZE,
    MAX_BLOCK_BATCH_SIZE
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

  const blockBatchSize = getBatchSizeParam(request);

  try {
    const payload = await runPublishShowResultsJob({
      blockBatchSize,
      finalizeBatchSize: 0,
      trigger: "VERCEL_CRON_BLOCKS",
      runBlocks: true,
      runFinalizers: false,
      runEmptyClosures: false,
      runInvitationals: false,
      maxRuntimeMs: MAX_RUNTIME_MS,
    });
    const response = {
      ok: true,
      currentEpoch: payload.currentEpoch,
      blockBatchSize: payload.blockBatchSize,
      dueBlockBacklogCount: payload.dueBlockBacklogCount,
      selectedShowDayIds: payload.summary.selectedShowDayIds,
      blocksProcessed: payload.summary.blocksProcessed,
      blocksFailed: payload.summary.blocksFailed,
      durationMs: payload.summary.durationMs,
      message: payload.summary.stoppedForRuntimeBudget
        ? "Show block judging paused at runtime budget."
        : "Show block judging completed.",
    };

    console.info("judge-show-blocks cron summary", {
      trigger: "VERCEL_CRON_BLOCKS",
      phase: "blocks",
      failedCount: payload.summary.failedCount,
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

    console.error("GET /api/cron/judge-show-blocks failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Judge show blocks cron failed.",
      },
      { status: 500 }
    );
  }
}
