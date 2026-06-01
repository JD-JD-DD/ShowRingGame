import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import {
  finalizeReadyShowDayResults,
  judgeShowBlock,
} from "@/server/services/judging.service";

export const dynamic = "force-dynamic";

const DEFAULT_BLOCK_BATCH_SIZE = 4;
const MAX_BLOCK_BATCH_SIZE = 12;
const DEFAULT_FINALIZE_BATCH_SIZE = 4;
const MAX_FINALIZE_BATCH_SIZE = 12;

function parseBatchSize(
  value: string | undefined,
  defaultValue: number,
  maxValue: number
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

export async function GET(request: Request) {
  const secret = process.env.SHOWRING_JOBS_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return fail("SHOWRING_JOBS_SECRET is required in production.", 500);
  }

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("Unauthorized.", 401);
  }

  const currentEpoch = getCurrentEpoch();
  const blockBatchSize = parseBatchSize(
    process.env.SHOW_RESULTS_JOB_BLOCK_BATCH_SIZE ??
      process.env.SHOW_RESULTS_JOB_BATCH_SIZE,
    DEFAULT_BLOCK_BATCH_SIZE,
    MAX_BLOCK_BATCH_SIZE
  );
  const finalizeBatchSize = parseBatchSize(
    process.env.SHOW_RESULTS_JOB_FINALIZE_BATCH_SIZE,
    DEFAULT_FINALIZE_BATCH_SIZE,
    MAX_FINALIZE_BATCH_SIZE
  );
  const readyBlocks = await db.showJudgingBlock.findMany({
    where: {
      startEpoch: { lte: currentEpoch },
      status: { notIn: ["RESULTS_PUBLISHED", "CANCELLED"] },
      showEntries: {
        some: {},
      },
      showDay: {
        scheduledEpoch: { lte: currentEpoch },
        status: { not: "CANCELLED" },
        cluster: {
          status: { not: "CANCELLED" },
        },
      },
    },
    orderBy: [
      { showDay: { scheduledEpoch: "asc" } },
      { showDay: { dayIndex: "asc" } },
      { startEpoch: "asc" },
      { ringNumber: "asc" },
      { blockOrder: "asc" },
    ],
    select: {
      id: true,
      showDayId: true,
      breedCode2: true,
      showDay: {
        select: {
          clusterId: true,
          dayIndex: true,
        },
      },
    },
    take: blockBatchSize,
  });
  const processedBlocks = [];
  const finalized = [];
  const errors = [];
  const touchedShowDayIds = new Set<string>();

  for (const block of readyBlocks) {
    try {
      const result = await judgeShowBlock({
        judgingBlockId: block.id,
        currentEpoch,
      });

      touchedShowDayIds.add(block.showDayId);
      processedBlocks.push({
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        clusterId: block.showDay.clusterId,
        dayIndex: block.showDay.dayIndex,
        breedCode2: block.breedCode2,
        result,
      });
    } catch (error) {
      console.error("GET /api/jobs/publish-show-results failed for block", {
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        error,
      });

      errors.push({
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        clusterId: block.showDay.clusterId,
        dayIndex: block.showDay.dayIndex,
        breedCode2: block.breedCode2,
        error:
          error instanceof Error
            ? error.message
            : "Failed to judge show block.",
      });
    }
  }

  const readyToFinalize = await db.showDay.findMany({
    where: {
      scheduledEpoch: { lte: currentEpoch },
      status: { not: "CANCELLED" },
      showEntries: {
        some: {},
      },
      cluster: {
        status: { not: "CANCELLED" },
      },
      judgingBlocks: {
        none: {
          status: { notIn: ["RESULTS_PUBLISHED", "CANCELLED"] },
          showEntries: {
            some: {},
          },
        },
      },
      OR: [
        { status: { not: "RESULTS_PUBLISHED" } },
        {
          AND: [
            { status: "RESULTS_PUBLISHED" },
            {
              showAwards: {
                some: {
                  awardGroup: "BREED",
                  awardCode: "BOB",
                },
              },
            },
            {
              showAwards: {
                none: {
                  awardGroup: "GROUP",
                },
              },
            },
          ],
        },
        {
          AND: [
            { status: "RESULTS_PUBLISHED" },
            {
              showAwards: {
                some: {},
              },
            },
            {
              prestigeCalculatedAtEpoch: null,
            },
          ],
        },
      ],
    },
    orderBy: [{ scheduledEpoch: "asc" }, { dayIndex: "asc" }],
    select: {
      id: true,
      clusterId: true,
      dayIndex: true,
    },
    take: finalizeBatchSize,
  });

  for (const showDay of readyToFinalize) {
    touchedShowDayIds.add(showDay.id);

    try {
      const result = await finalizeReadyShowDayResults({
        showDayId: showDay.id,
        currentEpoch,
      });

      finalized.push({
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        result,
      });
    } catch (error) {
      console.error("GET /api/jobs/publish-show-results failed to finalize day", {
        showDayId: showDay.id,
        error,
      });

      errors.push({
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize show day results.",
      });
    }
  }

  const payload = {
    currentEpoch,
    blockBatchSize,
    finalizeBatchSize,
    selectedBlocks: readyBlocks.length,
    selectedFinalizers: readyToFinalize.length,
    touchedShowDayIds: [...touchedShowDayIds],
    processedBlocks,
    finalized,
    errors,
  };

  // The workflow calls this endpoint with curl --fail. Preserve the detailed
  // payload, but return a failing status so a repeated judging error is visible.
  if (errors.length > 0) {
    return fail("Show results job completed with errors.", 500, payload);
  }

  return ok(payload);
}
