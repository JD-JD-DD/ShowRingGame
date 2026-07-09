import { NextResponse } from "next/server";
import {
  parsePublishShowResultsBatchSize,
  PublishShowResultsJobPreflightError,
  runPublishShowResultsJob,
} from "@/server/services/publishShowResultsJob.service";

export const dynamic = "force-dynamic";

const CRON_DEFAULT_BLOCK_BATCH_SIZE = 4;
const CRON_MAX_BLOCK_BATCH_SIZE = 4;
const CRON_DEFAULT_FINALIZE_BATCH_SIZE = 8;
const CRON_MAX_FINALIZE_BATCH_SIZE = 8;

function getCronBatchSizeParam(
  request: Request,
  paramName: string,
  defaultValue: number,
  maxValue: number
): number {
  const requestedValue = new URL(request.url, "http://localhost").searchParams.get(
    paramName
  );

  return parsePublishShowResultsBatchSize(
    requestedValue ?? undefined,
    defaultValue,
    maxValue
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

  const blockBatchSize = getCronBatchSizeParam(
    request,
    "blockBatchSize",
    CRON_DEFAULT_BLOCK_BATCH_SIZE,
    CRON_MAX_BLOCK_BATCH_SIZE
  );
  const finalizeBatchSize = getCronBatchSizeParam(
    request,
    "finalizeBatchSize",
    CRON_DEFAULT_FINALIZE_BATCH_SIZE,
    CRON_MAX_FINALIZE_BATCH_SIZE
  );

  try {
    const payload = await runPublishShowResultsJob({
      blockBatchSize,
      finalizeBatchSize,
      trigger: "VERCEL_CRON",
    });
    const response = {
      ok: true,
      currentEpoch: payload.currentEpoch,
      blockBatchSize: payload.blockBatchSize,
      finalizeBatchSize: payload.finalizeBatchSize,
      blocksProcessed: payload.summary.blocksProcessed,
      finalizedShowDays: payload.summary.finalizedShowDays,
      closedEmptyShowDays: payload.summary.closedEmptyShowDays,
      failedCount: payload.summary.failedCount,
      durationMs: payload.summary.durationMs,
      message:
        payload.summary.failedCount > 0
          ? "Judge due shows cron completed with errors."
          : "Judge due shows cron completed.",
    };

    console.info("judge-due-shows cron summary", {
      trigger: "VERCEL_CRON",
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

    console.error("GET /api/cron/judge-due-shows failed", { error });

    return NextResponse.json(
      {
        ok: false,
        error: "Judge due shows cron failed.",
      },
      { status: 500 }
    );
  }
}
