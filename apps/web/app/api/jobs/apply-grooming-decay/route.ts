import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { applyMissedGroomingDecayForDueDogs } from "@/server/services/grooming.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_DECAY_BATCH_SIZE = 400;
const MAX_DECAY_BATCH_SIZE = 400;
const DB_PREFLIGHT_ATTEMPTS = 4;
const DB_PREFLIGHT_DELAY_MS = 2000;

function parseBatchSize(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_DECAY_BATCH_SIZE;
  }

  return Math.min(parsed, MAX_DECAY_BATCH_SIZE);
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

      console.warn("apply-grooming-decay DB preflight retry", {
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
  const startedAtMs = Date.now();
  const secret = process.env.SHOWRING_JOBS_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    return fail("SHOWRING_JOBS_SECRET is required in production.", 500);
  }

  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return fail("Unauthorized.", 401);
  }

  try {
    await ensureDatabaseReachable();
  } catch (error) {
    return fail(
      "Database is unreachable for grooming decay maintenance after retries.",
      503,
      {
        code: "P1001",
        detail: error instanceof Error ? error.message : "Unknown database error.",
      }
    );
  }

  const currentEpoch = getCurrentEpoch();
  const { searchParams } = new URL(request.url);
  const result = await applyMissedGroomingDecayForDueDogs({
    currentEpoch,
    limit: parseBatchSize(searchParams.get("limit") ?? undefined),
  });
  const summary = {
    ...result,
    currentEpoch,
    durationMs: Date.now() - startedAtMs,
  };

  console.info("apply-grooming-decay summary", summary);

  return ok({ summary });
}
