import { fail, ok } from "@/lib/http";
import {
  DEFAULT_BLOCK_BATCH_SIZE,
  DEFAULT_FINALIZE_BATCH_SIZE,
  MAX_BLOCK_BATCH_SIZE,
  MAX_FINALIZE_BATCH_SIZE,
  parsePublishShowResultsBatchSize,
  PublishShowResultsJobPreflightError,
  runPublishShowResultsJob,
} from "@/server/services/publishShowResultsJob.service";

export const dynamic = "force-dynamic";

function getBatchSizeParam(
  request: Request,
  paramName: string,
  envValue: string | undefined,
  defaultValue: number,
  maxValue: number
): number {
  const requestedValue = new URL(request.url, "http://localhost").searchParams.get(
    paramName
  );

  return parsePublishShowResultsBatchSize(
    requestedValue ?? envValue,
    defaultValue,
    maxValue
  );
}

export async function GET(request: Request) {
  const secret = process.env.SHOWRING_JOBS_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return fail("SHOWRING_JOBS_SECRET is required in production.", 500);
  }

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("Unauthorized.", 401);
  }

  const blockBatchSize = getBatchSizeParam(
    request,
    "blockBatchSize",
    process.env.SHOW_RESULTS_JOB_BLOCK_BATCH_SIZE ??
      process.env.SHOW_RESULTS_JOB_BATCH_SIZE,
    DEFAULT_BLOCK_BATCH_SIZE,
    MAX_BLOCK_BATCH_SIZE
  );
  const finalizeBatchSize = getBatchSizeParam(
    request,
    "finalizeBatchSize",
    process.env.SHOW_RESULTS_JOB_FINALIZE_BATCH_SIZE,
    DEFAULT_FINALIZE_BATCH_SIZE,
    MAX_FINALIZE_BATCH_SIZE
  );

  try {
    const payload = await runPublishShowResultsJob({
      blockBatchSize,
      finalizeBatchSize,
      trigger: "GITHUB_ACTIONS",
    });

    // The workflow calls this endpoint with curl --fail. Preserve the detailed
    // payload, but return a failing status so a repeated judging error is visible.
    if (payload.errors.length > 0) {
      return fail("Show results job completed with errors.", 500, payload);
    }

    return ok(payload);
  } catch (error) {
    if (error instanceof PublishShowResultsJobPreflightError) {
      return fail(error.message, 503, {
        code: "P1001",
        detail: error.detail,
      });
    }

    console.error("GET /api/jobs/publish-show-results failed:", { error });

    return fail("Show results job failed.", 500);
  }
}
