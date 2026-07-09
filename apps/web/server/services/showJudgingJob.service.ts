import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import {
  closeReadyEmptyShowDays,
  publishReadyShowDayResults,
} from "@/server/services/judging.service";
import { Prisma, ShowDayStatus, ShowJudgingBlockStatus } from "@prisma/client";

const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;
const DB_PREFLIGHT_ATTEMPTS = 4;
const DB_PREFLIGHT_DELAY_MS = 2000;

const DUE_SHOW_DAY_STATUSES: ShowDayStatus[] = [
  ShowDayStatus.SCHEDULED,
  ShowDayStatus.ENTRY_OPEN,
  ShowDayStatus.ENTRY_LOCKED,
];

const ACTIVE_OR_STUCK_SHOW_DAY_STATUSES: ShowDayStatus[] = [
  ShowDayStatus.JUDGING,
];

const DUE_BLOCK_STATUSES: ShowJudgingBlockStatus[] = [
  ShowJudgingBlockStatus.SCHEDULED,
  ShowJudgingBlockStatus.ENTRY_OPEN,
  ShowJudgingBlockStatus.ENTRY_LOCKED,
];

export type DueShowJudgingJobResult = {
  showDayId: string;
  status: "processed" | "skipped" | "failed";
  message: string;
};

export type DueShowJudgingJobSummary = {
  ok: true;
  currentEpoch: number;
  processedCount: number;
  skippedCount: number;
  failedCount: number;
  results: DueShowJudgingJobResult[];
};

function clampBatchSize(batchSize: number | undefined): number {
  if (!Number.isInteger(batchSize) || (batchSize ?? 0) < 1) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
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

      console.warn("judge-due-shows DB preflight retry", {
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

function countByStatus(results: DueShowJudgingJobResult[]) {
  return {
    processedCount: results.filter((result) => result.status === "processed")
      .length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
  };
}

async function findActiveOrStuckShowDays(args: {
  currentEpoch: number;
  limit: number;
}) {
  return db.showDay.findMany({
    where: {
      scheduledEpoch: { lte: args.currentEpoch },
      status: { in: ACTIVE_OR_STUCK_SHOW_DAY_STATUSES },
      cluster: {
        status: { not: "CANCELLED" },
      },
    },
    orderBy: [{ scheduledEpoch: "asc" }, { dayIndex: "asc" }],
    select: {
      id: true,
    },
    take: args.limit,
  });
}

async function findDueShowDays(args: { currentEpoch: number; limit: number }) {
  return db.showDay.findMany({
    where: {
      scheduledEpoch: { lte: args.currentEpoch },
      status: { in: DUE_SHOW_DAY_STATUSES },
      showEntries: {
        some: {},
      },
      cluster: {
        status: { not: "CANCELLED" },
      },
    },
    orderBy: [{ scheduledEpoch: "asc" }, { dayIndex: "asc" }],
    select: {
      id: true,
      judgingBlocks: {
        where: {
          status: ShowJudgingBlockStatus.JUDGING,
        },
        select: {
          id: true,
        },
        take: 1,
      },
      _count: {
        select: {
          judgingBlocks: {
            where: {
              startEpoch: { lte: args.currentEpoch },
              status: { in: DUE_BLOCK_STATUSES },
              showEntries: {
                some: {},
              },
            },
          },
        },
      },
    },
    take: args.limit,
  });
}

async function lockShowDayForJudging(args: {
  showDayId: string;
  currentEpoch: number;
}): Promise<boolean> {
  const locked = await db.showDay.updateMany({
    where: {
      id: args.showDayId,
      scheduledEpoch: { lte: args.currentEpoch },
      status: { in: DUE_SHOW_DAY_STATUSES },
      cluster: {
        status: { not: "CANCELLED" },
      },
    },
    data: {
      status: ShowDayStatus.JUDGING,
    },
  });

  return locked.count === 1;
}

export async function runDueShowJudgingJob(args: {
  batchSize?: number;
} = {}): Promise<DueShowJudgingJobSummary> {
  const jobStartedAtMs = Date.now();
  const currentEpoch = getCurrentEpoch();
  const batchSize = clampBatchSize(args.batchSize);
  const results: DueShowJudgingJobResult[] = [];

  await ensureDatabaseReachable();

  const activeOrStuckShowDays = await findActiveOrStuckShowDays({
    currentEpoch,
    limit: batchSize,
  });

  for (const showDay of activeOrStuckShowDays) {
    results.push({
      showDayId: showDay.id,
      status: "skipped",
      message: "Show day is already judging; skipped as active or stuck.",
    });
  }

  const remainingAfterStuck = Math.max(0, batchSize - results.length);
  const closedEmpty =
    remainingAfterStuck > 0
      ? await closeReadyEmptyShowDays({
          currentEpoch,
          batchSize: remainingAfterStuck,
          statuses: DUE_SHOW_DAY_STATUSES,
        })
      : { closedShowDayIds: [] };

  for (const showDayId of closedEmpty.closedShowDayIds) {
    results.push({
      showDayId,
      status: "processed",
      message: "Closed due show day with no entered or judged entries.",
    });
  }

  const remainingBatchSize = Math.max(0, batchSize - results.length);
  const dueShowDays =
    remainingBatchSize > 0
      ? await findDueShowDays({
          currentEpoch,
          limit: remainingBatchSize,
        })
      : [];

  console.info("judge-due-shows start", {
    currentEpoch,
    batchSize,
    activeOrStuckCount: activeOrStuckShowDays.length,
    closedEmptyCount: closedEmpty.closedShowDayIds.length,
    dueShowDayIds: dueShowDays.map((showDay) => showDay.id),
  });

  for (const showDay of dueShowDays) {
    if (showDay.judgingBlocks.length > 0) {
      results.push({
        showDayId: showDay.id,
        status: "skipped",
        message: "Show day has an active judging block; skipped as active or stuck.",
      });
      continue;
    }

    if (showDay._count.judgingBlocks === 0) {
      results.push({
        showDayId: showDay.id,
        status: "skipped",
        message: "No due judging blocks with entries were found for this show day.",
      });
      continue;
    }

    const locked = await lockShowDayForJudging({
      showDayId: showDay.id,
      currentEpoch,
    });

    if (!locked) {
      results.push({
        showDayId: showDay.id,
        status: "skipped",
        message: "Show day was no longer in a due status when re-checked.",
      });
      continue;
    }

    try {
      const result = await publishReadyShowDayResults({
        showDayId: showDay.id,
        currentEpoch,
      });

      results.push({
        showDayId: showDay.id,
        status: "processed",
        message:
          result.breedBlocksJudged === 0
            ? "Show day was already judged or had no newly judged breed blocks."
            : "Show day judging completed and ready results were published.",
      });

      console.info("judge-due-shows processed show day", {
        showDayId: showDay.id,
        breedBlocksJudged: result.breedBlocksJudged,
        eligibleEntryCount: result.eligibleEntryCount,
        groupAwardsCreated: result.groupAwardsCreated,
        bestInShowAwardsCreated: result.bestInShowAwardsCreated,
      });
    } catch (error) {
      results.push({
        showDayId: showDay.id,
        status: "failed",
        message: "Show day judging failed; see server logs.",
      });

      console.error("judge-due-shows failed for show day", {
        showDayId: showDay.id,
        error,
      });
    }
  }

  const counts = countByStatus(results);
  const summary = {
    ok: true as const,
    currentEpoch,
    ...counts,
    results,
  };

  console.info("judge-due-shows summary", {
    ...summary,
    durationMs: Date.now() - jobStartedAtMs,
  });

  return summary;
}
