import { Prisma } from "@prisma/client";

import { selectMyResultsClusterPage } from "../app/my-results/myResults.loader";
import { db } from "../lib/db";
import { getCurrentEpoch } from "../lib/gameClock";

type DiagnosticMode = "stages" | "batches";

type DiagnosticOptions = {
  kennelId: string;
  currentEpoch: number;
  mode: DiagnosticMode;
  batchSize: number;
};

type Stage = {
  name: string;
  select: Prisma.ShowEntrySelect;
};

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function readPositiveInteger(value: string | undefined, optionName: string, fallback?: number): number {
  if (value == null) {
    if (fallback == null) throw new Error(`Missing required ${optionName}.`);
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${optionName} must be a non-negative integer.`);
  return parsed;
}

function printUsage(): void {
  console.log([
    "Usage: tsx scripts/diagnoseMyResultsShowEntryQuery.ts --kennel-id=<safe-local-or-clone-kennel-id> [options]",
    "",
    "Read-only staged diagnostic for the My Results ShowEntry query.",
    "Options:",
    "  --current-epoch=<epoch>  Defaults to the current game epoch.",
    "  --mode=stages|batches   Batches runs the full projection in bounded ID batches after all stages succeed.",
    `  --batch-size=<count>    Batch size from 1 to ${MAX_BATCH_SIZE}; defaults to ${DEFAULT_BATCH_SIZE}.`,
    "",
    "Environment alternatives: MY_RESULTS_DIAGNOSTIC_KENNEL_ID, MY_RESULTS_DIAGNOSTIC_CURRENT_EPOCH, MY_RESULTS_DIAGNOSTIC_BATCH_SIZE.",
  ].join("\n"));
}

function parseOptions(): DiagnosticOptions | null {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return null;
  }

  const kennelId = readOption("kennel-id") ?? process.env.MY_RESULTS_DIAGNOSTIC_KENNEL_ID;
  if (!kennelId) throw new Error("A safe local/clone kennel identifier is required via --kennel-id or MY_RESULTS_DIAGNOSTIC_KENNEL_ID.");

  const mode = readOption("mode") ?? "stages";
  if (mode !== "stages" && mode !== "batches") throw new Error("--mode must be stages or batches.");

  const currentEpoch = readPositiveInteger(
    readOption("current-epoch") ?? process.env.MY_RESULTS_DIAGNOSTIC_CURRENT_EPOCH,
    "--current-epoch",
    getCurrentEpoch(),
  );
  const requestedBatchSize = readPositiveInteger(
    readOption("batch-size") ?? process.env.MY_RESULTS_DIAGNOSTIC_BATCH_SIZE,
    "--batch-size",
    DEFAULT_BATCH_SIZE,
  );
  if (requestedBatchSize === 0 || requestedBatchSize > MAX_BATCH_SIZE) {
    throw new Error(`--batch-size must be between 1 and ${MAX_BATCH_SIZE}.`);
  }

  return { kennelId, currentEpoch, mode, batchSize: requestedBatchSize };
}

function errorDetails(error: unknown): { errorClass: string; errorMessage: string } {
  if (error instanceof Error) return { errorClass: error.constructor.name, errorMessage: error.message };
  return { errorClass: typeof error, errorMessage: String(error) };
}

function isRustPanic(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientRustPanicError ||
    (error instanceof Error && (error.name.includes("PrismaClientRustPanicError") || error.message.includes("no entry found for key")));
}

function elapsedSince(startedAt: number): number {
  return Date.now() - startedAt;
}

// This is deliberately staged from the production select in loadMyResultsPage. Each stage only adds
// relations that the production query uses; stage I is the exact production projection.
const scalarSelect = {
  id: true,
  entryStatus: true,
  absenceReason: true,
} satisfies Prisma.ShowEntrySelect;

const stages: Stage[] = [
  { name: "A-scalars", select: scalarSelect },
  {
    name: "B-dog-breed",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
    },
  },
  {
    name: "C-show-day-cluster-judge",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } } } },
    },
  },
  {
    name: "D-judging-block-judge",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } } } },
    },
  },
  {
    name: "E-group-judge-assignments",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } }, groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } } } },
    },
  },
  {
    name: "F-show-result-judge",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } }, groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } } } },
      showResult: { select: { pointsAwarded: true, isMajor: true, judge: { select: { name: true, judgeCode: true } } } },
    },
  },
  {
    name: "G-result-awards",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } }, groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } } } },
      showResult: { select: { pointsAwarded: true, isMajor: true, judge: { select: { name: true, judgeCode: true } }, showAwards: { select: { awardCode: true } } } },
    },
  },
  {
    name: "H-grand-champion-credit",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } }, groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } } } },
      showResult: { select: { pointsAwarded: true, isMajor: true, judge: { select: { name: true, judgeCode: true } }, showAwards: { select: { awardCode: true, grandChampionCredit: { select: { pointsAwarded: true, isMajor: true } } } } } },
    },
  },
  {
    name: "I-production-award-ordering",
    select: {
      ...scalarSelect,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: { select: { id: true, dayIndex: true, scheduledEpoch: true, judge: { select: { name: true, judgeCode: true } }, cluster: { select: { id: true, name: true, district: true } }, groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } } } },
      showResult: { select: { pointsAwarded: true, isMajor: true, judge: { select: { name: true, judgeCode: true } }, showAwards: { orderBy: [{ awardGroup: "asc" }, { rank: "asc" }], select: { awardCode: true, grandChampionCredit: { select: { pointsAwarded: true, isMajor: true } } } } } },
    },
  },
];

async function runStage(stage: Stage, where: Prisma.ShowEntryWhereInput): Promise<boolean> {
  const startedAt = Date.now();
  try {
    const rows = await db.showEntry.findMany({ where, select: stage.select });
    console.log(JSON.stringify({ stage: stage.name, success: true, rowCount: rows.length, elapsedMs: elapsedSince(startedAt) }));
    return true;
  } catch (error) {
    console.log(JSON.stringify({
      stage: stage.name,
      success: false,
      rowCount: 0,
      elapsedMs: elapsedSince(startedAt),
      ...errorDetails(error),
      stoppedAfterRustPanic: isRustPanic(error),
    }));
    return false;
  }
}

async function runBatches(where: Prisma.ShowEntryWhereInput, batchSize: number): Promise<boolean> {
  const ids = await db.showEntry.findMany({ where, select: { id: true } });
  const fullProjection = stages[stages.length - 1];

  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const batchWhere: Prisma.ShowEntryWhereInput = { AND: [where, { id: { in: batch.map((entry) => entry.id) } }] };
    const startedAt = Date.now();
    try {
      const rows = await db.showEntry.findMany({ where: batchWhere, select: fullProjection.select });
      console.log(JSON.stringify({ stage: "I-bounded-batch", batchIndex: start / batchSize, batchSize: batch.length, success: true, rowCount: rows.length, elapsedMs: elapsedSince(startedAt) }));
    } catch (error) {
      console.log(JSON.stringify({
        stage: "I-bounded-batch",
        batchIndex: start / batchSize,
        batchSize: batch.length,
        showEntryIds: batch.map((entry) => entry.id),
        success: false,
        rowCount: 0,
        elapsedMs: elapsedSince(startedAt),
        ...errorDetails(error),
        stoppedAfterRustPanic: isRustPanic(error),
      }));
      return false;
    }
  }
  return true;
}

async function main(): Promise<void> {
  const options = parseOptions();
  if (!options) return;

  // This is the production qualifying ShowDay read and paging helper. The ShowEntry where clause
  // below is intentionally copied because loadMyResultsPage does not expose it without changing
  // production behavior; keep it aligned with that loader when either query changes.
  const qualifyingShowDays = await db.showDay.findMany({
    where: {
      OR: [
        { showEntries: { some: { kennelId: options.kennelId, showResult: { isNot: null } } } },
        { scheduledEpoch: { lte: options.currentEpoch }, showEntries: { some: { kennelId: options.kennelId, entryStatus: "ABSENT" } } },
      ],
    },
    select: { clusterId: true, scheduledEpoch: true },
  });
  const mostRecentEpochByClusterId = new Map<string, number>();
  for (const showDay of qualifyingShowDays) {
    const existing = mostRecentEpochByClusterId.get(showDay.clusterId);
    if (existing == null || showDay.scheduledEpoch > existing) mostRecentEpochByClusterId.set(showDay.clusterId, showDay.scheduledEpoch);
  }
  const page = selectMyResultsClusterPage({
    candidates: [...mostRecentEpochByClusterId].map(([clusterId, mostRecentShowDayEpoch]) => ({ clusterId, mostRecentShowDayEpoch })),
  });
  if (page.clusterIds.length === 0) {
    console.log(JSON.stringify({ stage: "page-selection", success: true, rowCount: 0, elapsedMs: 0 }));
    return;
  }

  const where = {
    kennelId: options.kennelId,
    showDay: { clusterId: { in: page.clusterIds } },
    OR: [
      { showResult: { isNot: null } },
      { entryStatus: "ABSENT", showDay: { scheduledEpoch: { lte: options.currentEpoch } } },
    ],
  } satisfies Prisma.ShowEntryWhereInput;

  for (const stage of stages) {
    if (!await runStage(stage, where)) {
      process.exitCode = 1;
      return;
    }
  }
  if (options.mode === "batches" && !await runBatches(where, options.batchSize)) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.log(JSON.stringify({ stage: "page-selection", success: false, rowCount: 0, elapsedMs: 0, ...errorDetails(error), stoppedAfterRustPanic: isRustPanic(error) }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
