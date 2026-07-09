import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import {
  ensureAnnualInvitationalShow,
  ensureDueAnnualInvitationalShows,
} from "@/server/services/invitational.service";
import {
  closeReadyEmptyShowDays,
  finalizeReadyShowDayResults,
  judgeShowBlock,
  ShowDayFinalizationPhaseError,
} from "@/server/services/judging.service";
import { Prisma } from "@prisma/client";

export const DEFAULT_BLOCK_BATCH_SIZE = 2;
export const MAX_BLOCK_BATCH_SIZE = 12;
export const DEFAULT_FINALIZE_BATCH_SIZE = 4;
export const MAX_FINALIZE_BATCH_SIZE = 12;

const DB_PREFLIGHT_ATTEMPTS = 4;
const DB_PREFLIGHT_DELAY_MS = 2000;

export class PublishShowResultsJobPreflightError extends Error {
  detail: string;

  constructor(error: unknown) {
    const detail = error instanceof Error ? error.message : "Unknown database error.";

    super("Database is unreachable for publish show results after retries.");
    this.name = "PublishShowResultsJobPreflightError";
    this.detail = detail;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export function parsePublishShowResultsBatchSize(
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

function getJobErrorDetails(error: unknown): {
  message: string;
  name?: string;
  code?: string;
  meta?: unknown;
  finalizationPhase?: string;
  phaseDurationMs?: number;
} {
  if (error instanceof ShowDayFinalizationPhaseError) {
    const cause = error.cause;
    const causeDetails =
      cause instanceof Prisma.PrismaClientKnownRequestError
        ? {
            code: cause.code,
            meta: cause.meta,
          }
        : {};

    return {
      message: error.message,
      name: error.name,
      finalizationPhase: error.finalizationPhase,
      phaseDurationMs: error.phaseDurationMs,
      ...causeDetails,
    };
  }

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

export async function runPublishShowResultsJob(args: {
  blockBatchSize: number;
  finalizeBatchSize: number;
  currentEpoch?: number;
  trigger: "GITHUB_ACTIONS" | "VERCEL_CRON" | "MANUAL" | string;
  runBlocks?: boolean;
  runFinalizers?: boolean;
  runEmptyClosures?: boolean;
  runInvitationals?: boolean;
  maxRuntimeMs?: number;
}) {
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
  const runBlocks = args.runBlocks ?? true;
  const runFinalizers = args.runFinalizers ?? true;
  const runEmptyClosures = args.runEmptyClosures ?? true;
  const runInvitationals = args.runInvitationals ?? true;
  const maxRuntimeMs = args.maxRuntimeMs;
  let stoppedForRuntimeBudget = false;
  const isRuntimeBudgetSpent = () =>
    maxRuntimeMs !== undefined && Date.now() - jobStartedAtMs >= maxRuntimeMs;

  try {
    await runPhase("dbPreflight", ensureDatabaseReachable);
  } catch (error) {
    throw new PublishShowResultsJobPreflightError(error);
  }

  const currentEpoch = args.currentEpoch ?? getCurrentEpoch();
  const currentTimeIso = new Date().toISOString();
  const { blockBatchSize, finalizeBatchSize, trigger } = args;
  const invitationalsBeforeJudging = runInvitationals
    ? await runPhase("ensureDueAnnualInvitationalShows", () =>
        ensureDueAnnualInvitationalShows({ currentEpoch })
      )
    : { results: [] };
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
  const dueBlockBacklogCount = runBlocks
    ? await runPhase("countReadyBlocks", () =>
        db.showJudgingBlock.count({
          where: readyBlockWhere,
        })
      )
    : 0;
  const readyBlocks = runBlocks
    ? await runPhase("findReadyBlocks", () =>
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
      )
    : [];
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
    trigger,
    currentEpoch,
    currentTimeIso,
    jobStartedAtIso,
    phase: runBlocks && runFinalizers ? "combined" : runBlocks ? "blocks" : "finalizers",
    blockBatchSize,
    finalizeBatchSize,
    runBlocks,
    runFinalizers,
    runEmptyClosures,
    runInvitationals,
    maxRuntimeMs,
    dueBlockBacklogCount,
    dueBlocksLoaded: readyBlocks.length,
    selectedShowDayIds,
    selectedJudgingBlockIds,
  });

  const emptyClosed = runEmptyClosures
    ? await runPhase("closeReadyEmptyShowDays", () =>
        closeReadyEmptyShowDays({
          currentEpoch,
          batchSize: finalizeBatchSize,
        })
      )
    : { closedShowDayIds: [] };

  // Keep each run within one show day. This lets Group and BIS finals update
  // championship titles before any later-day breed blocks are judged.
  for (const block of selectedBlocks) {
    if (isRuntimeBudgetSpent()) {
      stoppedForRuntimeBudget = true;
      break;
    }

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
        trigger,
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

      console.error("publish-show-results failed for block", {
        trigger,
        judgingBlockId: block.id,
        showDayId: block.showDayId,
        durationMs,
        finalizationPhase: errorDetails.finalizationPhase,
        phaseDurationMs: errorDetails.phaseDurationMs,
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
        finalizationPhase: errorDetails.finalizationPhase,
        phaseDurationMs: errorDetails.phaseDurationMs,
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
  const readyFinalizerBacklogCount = runFinalizers
    ? await runPhase("countReadyFinalizers", () =>
        db.showDay.count({
          where: readyFinalizerWhere,
        })
      )
    : 0;
  const readyToFinalize = runFinalizers
    ? await runPhase("findReadyFinalizers", () =>
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
      )
    : [];

  console.info("publish-show-results selected finalizers", {
    trigger,
    readyFinalizerBacklogCount,
    selectedFinalizerShowDayIds: readyToFinalize.map((showDay) => showDay.id),
  });

  for (const showDay of readyToFinalize) {
    if (isRuntimeBudgetSpent()) {
      stoppedForRuntimeBudget = true;
      break;
    }

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
        trigger,
        showDayId: showDay.id,
        durationMs,
        readyToFinalize: result.readyToFinalize,
        groupAwardsCreated: result.groupAwardsCreated,
        bestInShowAwardsCreated: result.bestInShowAwardsCreated,
        finalsTitleProgress: result.finalsTitleProgress,
        grandChampionProcessing: result.grandChampionProcessing,
      });
    } catch (error) {
      const errorDetails = getJobErrorDetails(error);
      const durationMs = Date.now() - finalizerStartedAtMs;

      console.error("publish-show-results failed to finalize day", {
        trigger,
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        durationMs,
        finalizationPhase: errorDetails.finalizationPhase,
        phaseDurationMs: errorDetails.phaseDurationMs,
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
        finalizationPhase: errorDetails.finalizationPhase,
        phaseDurationMs: errorDetails.phaseDurationMs,
        durationMs,
      });
    }
  }

  const invitationalsAfterFinalization = runInvitationals
    ? await runPhase("ensureDueAnnualInvitationalShows", () =>
        ensureDueAnnualInvitationalShows({ currentEpoch })
      )
    : { results: [] };
  const invitationalResults = [
    ...invitationalsBeforeJudging.results,
    ...invitationalsAfterFinalization.results,
  ];
  const invitational = runInvitationals
    ? invitationalResults.at(-1) ??
      (await runPhase("ensureAnnualInvitationalShow", () =>
        ensureAnnualInvitationalShow({ currentEpoch })
      ))
    : null;
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
  const finalsTitleProgress = finalized.map(
    (showDay) => showDay.result.finalsTitleProgress
  );
  const finalsTitleDogsRecalculated = finalsTitleProgress.reduce(
    (total, result) => total + result.dogsRecalculated,
    0
  );
  const finalsTitlePointAwardCount = finalsTitleProgress.reduce(
    (total, result) => total + result.pointAwardCount,
    0
  );
  const summary = {
    trigger,
    phase: runBlocks && runFinalizers ? "combined" : runBlocks ? "blocks" : "finalizers",
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
    blocksProcessed: processedBlocks.length,
    blocksFailed: blockFailureCount,
    blocksSkipped,
    judged: processedBlocks.length,
    cancelledNoEntries: emptyClosed.closedShowDayIds.length,
    closedEmptyShowDays: emptyClosed.closedShowDayIds.length,
    readyFinalizerBacklogCount,
    selectedFinalizerShowDayIds: readyToFinalize.map((showDay) => showDay.id),
    selectedFinalizers: readyToFinalize.length,
    finalizationAttempts: readyToFinalize.length,
    finalizationSucceeded: finalized.length,
    finalizationPublished: finalizationPublishedCount,
    finalizationFailed: finalizationFailureCount,
    finalized: finalized.length,
    finalizedShowDays: finalized.length,
    failedCount: errors.length,
    stoppedForRuntimeBudget,
    maxRuntimeMs: maxRuntimeMs ?? null,
    grandChampionExecuted: grandChampionExecutedCount,
    grandChampionSkipped: grandChampionSkippedCount,
    grandChampionCreditsProcessed,
    grandChampionDogsRecalculated,
    grandChampionProcessing,
    finalsTitleDogsRecalculated,
    finalsTitlePointAwardCount,
    finalsTitleProgress,
    skippedFuture: 0,
    skippedFutureReason:
      "Future shows are not loaded by the publish job; due queries require epoch <= currentEpoch.",
    invitationalsCreated: invitationalResults.filter((result) => result.created)
      .length,
    durationMs: jobDurationMs,
    phaseDurationsMs,
  };
  const payload = {
    trigger,
    phase: runBlocks && runFinalizers ? "combined" : runBlocks ? "blocks" : "finalizers",
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

  return payload;
}
