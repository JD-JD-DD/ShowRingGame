import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { canReconcileExistingBreedBlock } from "../server/services/showEntry.service";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

const showEntryService = source("apps/web/server/services/showEntry.service.ts");
const showEntryRoute = source("apps/web/app/api/shows/[showId]/enter/route.ts");

assertIncludes(
  showEntryService,
  'code: "JUDGING_BLOCK_LOCKED"',
  "locked stale judging blocks use a classified show-entry error"
);
assertIncludes(
  showEntryService,
  "canReconcileExistingBreedBlock({",
  "only pre-judging block statuses are mutable"
);
assertIncludes(
  showEntryService,
  "publishedAtEpoch: existingBlock.publishedAtEpoch",
  "published blocks are never reconciled"
);
assertIncludes(
  showEntryService,
  "showResultCount: existingBlock._count.showResults",
  "blocks with results are never reconciled"
);
assertIncludes(
  showEntryService,
  "showAwardCount: existingBlock._count.showAwards",
  "blocks with awards are never reconciled"
);
assertIncludes(
  showEntryService,
  "data: { judgeId: scheduledJudgeId }",
  "reconciliation updates only the stored judge reference"
);
assertIncludes(
  showEntryService,
  "const requiredBreeds = await tx.breed.findMany({",
  "required breed metadata is loaded once for the full judging-block batch"
);
assertIncludes(
  showEntryService,
  "const scheduledAssignments = await tx.showDayGroupJudgeAssignment.findMany({",
  "required group-judge assignments are loaded once for the full judging-block batch"
);
assertIncludes(
  showEntryService,
  "const existingBlocks = await tx.showJudgingBlock.findMany({",
  "required existing judging blocks are loaded once for the full judging-block batch"
);
assertIncludes(
  showEntryService,
  "const siblingBlockOrders = await tx.showJudgingBlock.findMany({",
  "per-day block-order data is loaded once for the full judging-block batch"
);
assertIncludes(
  showEntryService,
  "const nextBlockOrderByShowDayId = new Map<string, number>();",
  "missing block orders are allocated from a per-day in-memory tracker"
);
assertIncludes(
  showEntryService,
  "return db.$transaction(async (tx) =>",
  "bulk entry retains its transaction boundary"
);
assertIncludes(
  showEntryRoute,
  "isShowEntrySubmissionError(error)",
  "classified locked-block errors reach the player-facing entry error path"
);

assert.equal(
  canReconcileExistingBreedBlock({
    status: "ENTRY_OPEN",
    publishedAtEpoch: null,
    showResultCount: 0,
    showAwardCount: 0,
  }),
  true,
  "an open block without historical output is mutable"
);

for (const lockedState of [
  { status: "JUDGING", publishedAtEpoch: null, showResultCount: 0, showAwardCount: 0 },
  { status: "RESULTS_PUBLISHED", publishedAtEpoch: null, showResultCount: 0, showAwardCount: 0 },
  { status: "ENTRY_OPEN", publishedAtEpoch: 1, showResultCount: 0, showAwardCount: 0 },
  { status: "ENTRY_OPEN", publishedAtEpoch: null, showResultCount: 1, showAwardCount: 0 },
  { status: "ENTRY_OPEN", publishedAtEpoch: null, showResultCount: 0, showAwardCount: 1 },
]) {
  assert.equal(
    canReconcileExistingBreedBlock(lockedState),
    false,
    `historical or progressed block remains locked: ${JSON.stringify(lockedState)}`
  );
}

console.log("Show-entry judging-block reconciliation checks passed.");
