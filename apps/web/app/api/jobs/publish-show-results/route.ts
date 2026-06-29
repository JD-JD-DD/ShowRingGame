import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import {
  ensureAnnualInvitationalShow,
  ensureDueAnnualInvitationalShows,
} from "@/server/services/invitational.service";
import {
  closeReadyEmptyShowDays,
  finalizeReadyShowDayResults,
  judgeShowBlock,
} from "@/server/services/judging.service";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_BLOCK_BATCH_SIZE = 2;
const MAX_BLOCK_BATCH_SIZE = 12;
const DEFAULT_FINALIZE_BATCH_SIZE = 4;
const MAX_FINALIZE_BATCH_SIZE = 12;
const DB_PREFLIGHT_ATTEMPTS = 4;
const DB_PREFLIGHT_DELAY_MS = 2000;

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

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

  return parseBatchSize(
    requestedValue ?? envValue,
    defaultValue,
    maxValue
  );
}

function getJobErrorDetails(error: unknown): {
  message: string;
  name?: string;
  code?: string;
  meta?: unknown;
} {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      message: error.message,
      name: error.name,
      code: error.code,
      meta: error.meta,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }

  return {
    message: "Unknown publish show results job error.",
  };
}

function isPrismaConnectivityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  return (
    error instanceof Error &&
    (error.message.includes("P1001") ||
      error.message.includes("Can't reach database server"))
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabaseReachable(): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= DB_PREFLIGHT_ATTEMPTS; attempt += 1) {
    try {
      await db.$queryRaw`SELECT 1`;
      return;
    } catch (error) {
      lastError = error;

      if (!isPrismaConnectivityError(error) || attempt === DB_PREFLIGHT_ATTEMPTS) {
        break;
      }

      console.warn("publish-show-results DB preflight retry", {
        attempt,
        remainingAttempts: DB_PREFLIGHT_ATTEMPTS - attempt,
        error: error instanceof Error ? error.message : error,
      });
      await sleep(DB_PREFLIGHT_DELAY_MS);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Database connectivity preflight failed.");
}

export async function GET(request: Request) {
  const jobStartedAtMs = Date.now();
  const jobStartedAtIso = new Date(jobStartedAtMs).toISOString();
  const phaseDurationsMs: Record<string, number> = {};
  const runPhase = async <T>(
    phaseName: string,
    action: () => Promise<T>
  ): Promise<T> => {
    const startedAtMs = Date.now();

    try {
      return await action();
    } finally {
      phaseDurationsMs[phaseName] =
        (phaseDurationsMs[phaseName] ?? 0) + Date.now() - startedAtMs;
    }
  };
  const secret = process.env.SHOWRING_JOBS_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return fail("SHOWRING_JOBS_SECRET is required in production.", 500);
  }

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("Unauthorized.", 401);
  }

  // This route is called by GitHub Actions through the deployed app. A quick
  // DB preflight with retry smooths over transient Neon wake-up/P1001 errors
  // before we start judging or finalizing any show data.
  try {
    await runPhase("dbPreflight", ensureDatabaseReachable);
  } catch (error) {
    return fail(
      "Database is unreachable for publish show results after retries.",
      503,
      {
        code: "P1001",
        detail: error instanceof Error ? error.message : "Unknown database error.",
      }
    );
  }

  const currentEpoch = getCurrentEpoch();
  const currentTimeIso = new Date().toISOString();
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
  const invitationalsBeforeJudging = await runPhase(
    "ensureDueAnnualInvitationalShows",
    () => ensureDueAnnualInvitationalShows({ currentEpoch })
  );
  const readyBlockWhere = Prisma.validator<Prisma.ShowJudgingBlockWhereInput>()({
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
  });
  const dueBlockBacklogCount = await runPhase("countReadyBlocks", () =>
    db.showJudgingBlock.count({
      where: readyBlockWhere,
    })
  );
  const readyBlocks = await runPhase("findReadyBlocks", () =>
    db.showJudgingBlock.findMany({
      where: readyBlockWhere,
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
    })
  );
  const earliestReadyShowDayId = readyBlocks[0]?.showDayId;
  const selectedBlocks = earliestReadyShowDayId
    ? readyBlocks.filter((block) => block.showDayId === earliestReadyShowDayId)
    : [];
  const selectedShowDayIds = uniqueStrings(
    selectedBlocks.map((block) => block.showDayId)
  );
  const selectedJudgingBlockIds = selectedBlocks.map((block) => block.id);
  const processedBlocks = [];
  const finalized = [];
  const errors = [];
  const touchedShowDayIds = new Set<string>();

  console.info("publish-show-results start", {
    currentEpoch,
    currentTimeIso,
    jobStartedAtIso,
    blockBatchSize,
    finalizeBatchSize,
    dueBlockBacklogCount,
    dueBlocksLoaded: readyBlocks.length,
    selectedShowDayIds,
    selectedJudgingBlockIds,
  });

  const emptyClosed = await runPhase("closeReadyEmptyShowDays", () =>
    closeReadyEmptyShowDays({
      currentEpoch,
      batchSize: finalizeBatchSize,
    })
  );

  // Keep each workflow run within one show day. This lets Group and BIS finals
  // update championship titles before any later-day breed blocks are judged,
  // so a newly finished champion moves from the classes into specials.
  for (const block of selectedBlocks) {
    const blockStartedAtMs = Date.now();

    try {
      const result = await runPhase("judgeSelectedBlocks", () =>
        judgeShowBlock({
          judgingBlockId: block.id,
          currentEpoch,
        })
      );
      const durationMs = Date.now() - blockStartedAtMs;

      touchedShowDayIds.add(block.showDayId);
      processedBlocks.push({
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        clusterId: block.showDay.clusterId,
        dayIndex: block.showDay.dayIndex,
        breedCode2: block.breedCode2,
        durationMs,
        result,
      });

      console.info("publish-show-results judged block", {
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        breedCode2: block.breedCode2,
        durationMs,
        alreadyPublished: result.alreadyPublished,
        eligibleEntryCount: result.eligibleEntryCount,
        ineligibleEntryCount: result.ineligibleEntryCount,
        resultCount: result.results.length,
      });
    } catch (error) {
      const errorDetails = getJobErrorDetails(error);
      const durationMs = Date.now() - blockStartedAtMs;

      console.error("GET /api/jobs/publish-show-results failed for block", {
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        durationMs,
        error,
      });

      errors.push({
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        clusterId: block.showDay.clusterId,
        dayIndex: block.showDay.dayIndex,
        breedCode2: block.breedCode2,
        error: errorDetails.message,
        errorName: errorDetails.name,
        errorCode: errorDetails.code,
        errorMeta: errorDetails.meta,
        durationMs,
      });
    }
  }

  const readyFinalizerWhere = Prisma.validator<Prisma.ShowDayWhereInput>()({
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
  });
  const readyFinalizerBacklogCount = await runPhase("countReadyFinalizers", () =>
    db.showDay.count({
      where: readyFinalizerWhere,
    })
  );
  const readyToFinalize = await runPhase("findReadyFinalizers", () =>
    db.showDay.findMany({
      where: readyFinalizerWhere,
      orderBy: [{ scheduledEpoch: "asc" }, { dayIndex: "asc" }],
      select: {
        id: true,
        clusterId: true,
        dayIndex: true,
      },
      take: finalizeBatchSize,
    })
  );

  console.info("publish-show-results selected finalizers", {
    readyFinalizerBacklogCount,
    selectedFinalizerShowDayIds: readyToFinalize.map((showDay) => showDay.id),
  });

  for (const showDay of readyToFinalize) {
    touchedShowDayIds.add(showDay.id);
    const finalizerStartedAtMs = Date.now();

    try {
      const result = await runPhase("finalizeReadyShowDays", () =>
        finalizeReadyShowDayResults({
          showDayId: showDay.id,
          currentEpoch,
        })
      );
      const durationMs = Date.now() - finalizerStartedAtMs;

      finalized.push({
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        durationMs,
        result,
      });

      console.info("publish-show-results finalized day", {
        showDayId: showDay.id,
        durationMs,
        readyToFinalize: result.readyToFinalize,
        groupAwardsCreated: result.groupAwardsCreated,
        bestInShowAwardsCreated: result.bestInShowAwardsCreated,
        grandChampionProcessing: result.grandChampionProcessing,
      });
    } catch (error) {
      const errorDetails = getJobErrorDetails(error);
      const durationMs = Date.now() - finalizerStartedAtMs;

      console.error("GET /api/jobs/publish-show-results failed to finalize day", {
        showDayId: showDay.id,
        durationMs,
        error,
      });

      errors.push({
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        error: errorDetails.message,
        errorName: errorDetails.name,
        errorCode: errorDetails.code,
        errorMeta: errorDetails.meta,
        durationMs,
      });
    }
  }

  const invitationalsAfterFinalization = await runPhase(
    "ensureDueAnnualInvitationalShows",
    () => ensureDueAnnualInvitationalShows({ currentEpoch })
  );
  const invitationalResults = [
    ...invitationalsBeforeJudging.results,
    ...invitationalsAfterFinalization.results,
  ];
  const invitational =
    invitationalResults.at(-1) ??
    (await runPhase("ensureAnnualInvitationalShow", () =>
      ensureAnnualInvitationalShow({ currentEpoch })
    ));
  const jobDurationMs = Date.now() - jobStartedAtMs;
  const blockFailureCount = errors.filter((error) => "judgingBlockId" in error)
    .length;
  const finalizationFailureCount = errors.filter(
    (error) => !("judgingBlockId" in error)
  ).length;
  const blocksSkipped =
    selectedBlocks.length - processedBlocks.length - blockFailureCount;
  const finalizationPublishedCount = finalized.filter(
    (showDay) => showDay.result.readyToFinalize
  ).length;
  const grandChampionProcessing = finalized.map(
    (showDay) => showDay.result.grandChampionProcessing
  );
  const grandChampionExecutedCount = grandChampionProcessing.filter(
    (result) => result.status === "EXECUTED"
  ).length;
  const grandChampionSkippedCount = grandChampionProcessing.filter(
    (result) => result.status === "SKIPPED"
  ).length;
  const grandChampionCreditsProcessed = grandChampionProcessing.reduce(
    (total, result) => total + result.creditsProcessed,
    0
  );
  const grandChampionDogsRecalculated = grandChampionProcessing.reduce(
    (total, result) => total + result.dogsRecalculated,
    0
  );
  const summary = {
    currentEpoch,
    currentTimeIso,
    jobStartedAtIso,
    candidatesFound: readyBlocks.length,
    dueBlockBacklogCount,
    dueBlocksAvailable: dueBlockBacklogCount,
    dueBlocksLoaded: readyBlocks.length,
    selectedShowDayIds,
    selectedJudgingBlockIds,
    selectedForJudging: selectedBlocks.length,
    blocksAttempted: selectedBlocks.length,
    blocksSucceeded: processedBlocks.length,
    blocksFailed: blockFailureCount,
    blocksSkipped,
    judged: processedBlocks.length,
    cancelledNoEntries: emptyClosed.closedShowDayIds.length,
    readyFinalizerBacklogCount,
    selectedFinalizerShowDayIds: readyToFinalize.map((showDay) => showDay.id),
    selectedFinalizers: readyToFinalize.length,
    finalizationAttempts: readyToFinalize.length,
    finalizationSucceeded: finalized.length,
    finalizationPublished: finalizationPublishedCount,
    finalizationFailed: finalizationFailureCount,
    finalized: finalized.length,
    grandChampionExecuted: grandChampionExecutedCount,
    grandChampionSkipped: grandChampionSkippedCount,
    grandChampionCreditsProcessed,
    grandChampionDogsRecalculated,
    grandChampionProcessing,
    skippedFuture: 0,
    skippedFutureReason:
      "Future shows are not loaded by the publish job; due queries require epoch <= currentEpoch.",
    invitationalsCreated: invitationalResults.filter((result) => result.created)
      .length,
    durationMs: jobDurationMs,
    phaseDurationsMs,
  };
  const payload = {
    currentEpoch,
    currentTimeIso,
    jobStartedAtIso,
    blockBatchSize,
    finalizeBatchSize,
    dueBlockBacklogCount,
    readyFinalizerBacklogCount,
    selectedBlocks: selectedBlocks.length,
    selectedFinalizers: readyToFinalize.length,
    summary,
    emptyClosed,
    touchedShowDayIds: [...touchedShowDayIds],
    processedBlocks,
    finalized,
    invitational,
    invitationals: {
      beforeJudging: invitationalsBeforeJudging,
      afterFinalization: invitationalsAfterFinalization,
    },
    errors,
  };

  console.info("publish-show-results summary", summary);
  console.info("publish-show-results payload", payload);

  // The workflow calls this endpoint with curl --fail. Preserve the detailed
  // payload, but return a failing status so a repeated judging error is visible.
  if (errors.length > 0) {
    return fail("Show results job completed with errors.", 500, payload);
  }

  return ok(payload);
}
