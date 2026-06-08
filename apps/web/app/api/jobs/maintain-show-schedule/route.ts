import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { ensureGeneratedShowSchedule } from "@/server/services/showSchedule.service";
import { SHOW_INSTANCE_GENERATION_HORIZON_HOURS } from "@showring/rules";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DB_PREFLIGHT_ATTEMPTS = 4;
const DB_PREFLIGHT_DELAY_MS = 2000;

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

      console.warn("maintain-show-schedule DB preflight retry", {
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

async function countGeneratedTimingMismatches(args: {
  currentEpoch: number;
  horizonHours: number;
}): Promise<number> {
  const generatedWindowEndEpoch = args.currentEpoch + args.horizonHours;
  const clusters = await db.showCluster.findMany({
    where: {
      id: {
        startsWith: "generated-year-",
      },
      startEpoch: {
        lte: generatedWindowEndEpoch,
      },
      endEpoch: {
        gte: args.currentEpoch,
      },
      status: {
        notIn: ["COMPLETE", "CANCELLED"],
      },
    },
    select: {
      startEpoch: true,
      endEpoch: true,
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        select: {
          scheduledEpoch: true,
        },
      },
    },
  });

  return clusters.filter((cluster) => {
    const expectedEndEpoch =
      cluster.startEpoch + Math.max(0, cluster.showDays.length - 1);

    return (
      cluster.endEpoch !== expectedEndEpoch ||
      cluster.showDays.some(
        (showDay, dayOffset) =>
          showDay.scheduledEpoch !== cluster.startEpoch + dayOffset
      )
    );
  }).length;
}

export async function GET(request: Request) {
  const jobStartedAtMs = Date.now();
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

  try {
    await runPhase("dbPreflight", ensureDatabaseReachable);
  } catch (error) {
    return fail(
      "Database is unreachable for show schedule maintenance after retries.",
      503,
      {
        code: "P1001",
        detail: error instanceof Error ? error.message : "Unknown database error.",
      }
    );
  }

  const currentEpoch = getCurrentEpoch();
  const mismatchCountBefore = await runPhase("countMismatchesBefore", () =>
    countGeneratedTimingMismatches({
      currentEpoch,
      horizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
    })
  );
  const schedule = await runPhase("ensureGeneratedShowSchedule", () =>
    ensureGeneratedShowSchedule({
      currentEpoch,
      horizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
      includeJudgingBlocks: false,
    })
  );
  const mismatchCountAfter = await runPhase("countMismatchesAfter", () =>
    countGeneratedTimingMismatches({
      currentEpoch,
      horizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
    })
  );
  const summary = {
    currentEpoch,
    horizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
    mismatchCountBefore,
    mismatchCountAfter,
    repairedMismatchCount: Math.max(0, mismatchCountBefore - mismatchCountAfter),
    durationMs: Date.now() - jobStartedAtMs,
    phaseDurationsMs,
  };
  const payload = {
    summary,
    schedule,
  };

  console.info("maintain-show-schedule summary", summary);

  return ok(payload);
}
