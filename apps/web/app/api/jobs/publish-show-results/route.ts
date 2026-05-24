import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import { publishReadyShowDayResults } from "@/server/services/judging.service";

export const dynamic = "force-dynamic";

const DEFAULT_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 3;

function parseBatchSize(value: string | undefined): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(parsed, MAX_BATCH_SIZE);
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
  const batchSize = parseBatchSize(process.env.SHOW_RESULTS_JOB_BATCH_SIZE);
  const showDays = await db.showDay.findMany({
    where: {
      scheduledEpoch: { lte: currentEpoch },
      status: { notIn: ["RESULTS_PUBLISHED", "CANCELLED"] },
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
      clusterId: true,
      dayIndex: true,
    },
    take: batchSize,
  });
  const processed = [];
  const errors = [];

  for (const showDay of showDays) {
    try {
      const result = await publishReadyShowDayResults({
        showDayId: showDay.id,
        currentEpoch,
      });

      processed.push({
        showDayId: showDay.id,
        clusterId: showDay.clusterId,
        dayIndex: showDay.dayIndex,
        result,
      });
    } catch (error) {
      console.error("GET /api/jobs/publish-show-results failed for show day", {
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
            : "Failed to publish show day results.",
      });
    }
  }

  const payload = {
    currentEpoch,
    batchSize,
    selected: showDays.length,
    processed,
    errors,
  };

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, ...payload }, { status: 500 });
  }

  return ok(payload);
}
