import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type BlockStatus =
  | "SCHEDULED"
  | "ENTRY_OPEN"
  | "ENTRY_LOCKED"
  | "JUDGING"
  | "RESULTS_PUBLISHED"
  | "CANCELLED";

const source = readFileSync(
  resolve(process.cwd(), "server/services/judging.service.ts"),
  "utf8"
);
const judgeShowBlockSection = source.slice(
  source.indexOf("export async function judgeShowBlock"),
  source.indexOf("export async function judgeShowDay")
);
const claimableStatuses = new Set<BlockStatus>([
  "SCHEDULED",
  "ENTRY_OPEN",
  "ENTRY_LOCKED",
]);

function compareAndSetClaim(state: { status: BlockStatus }): number {
  if (!claimableStatuses.has(state.status)) return 0;
  state.status = "JUDGING";
  return 1;
}

function releaseClaim(
  state: { status: BlockStatus },
  priorStatus: BlockStatus
): void {
  if (state.status === "JUDGING") state.status = priorStatus;
}

const sameBlock = { status: "ENTRY_LOCKED" as BlockStatus };
assert.equal(compareAndSetClaim(sameBlock), 1, "first worker claims the block");
assert.equal(compareAndSetClaim(sameBlock), 0, "second same-block worker loses before preparation");
assert.equal(sameBlock.status, "JUDGING");

const differentBlocks = [
  { status: "SCHEDULED" as BlockStatus },
  { status: "ENTRY_OPEN" as BlockStatus },
];
assert.deepEqual(
  differentBlocks.map(compareAndSetClaim),
  [1, 1],
  "different blocks remain independently claimable"
);

const failedPreparation = { status: "ENTRY_OPEN" as BlockStatus };
assert.equal(compareAndSetClaim(failedPreparation), 1);
releaseClaim(failedPreparation, "ENTRY_OPEN");
assert.equal(
  failedPreparation.status,
  "ENTRY_OPEN",
  "preparation failure restores the exact retryable status"
);
assert.equal(compareAndSetClaim(failedPreparation), 1, "released claim can retry");
failedPreparation.status = "RESULTS_PUBLISHED";
releaseClaim(failedPreparation, "ENTRY_OPEN");
assert.equal(
  failedPreparation.status,
  "RESULTS_PUBLISHED",
  "conditional release never overwrites completed publication"
);

const claimStart = source.indexOf("const claim = await db.showJudgingBlock.updateMany");
const preparationStart = source.indexOf(
  "const preparedHealthTruthsByDogId = await ensureAndLoadBreedJudgingHealthTruths"
);
const resultWrite = source.indexOf("await tx.showResult.createMany({ data: resultsToCreate })");
assert.ok(claimStart >= 0, "publication uses a persisted compare-and-set claim");
assert.ok(
  claimStart < preparationStart,
  "health/preparation work starts only after the claim succeeds"
);
assert.ok(
  source.includes('status: { in: CLAIMABLE_JUDGING_BLOCK_STATUSES }'),
  "claim is limited to pre-publication statuses"
);
assert.ok(
  source.includes('where: { id: judgingBlockId, status: "JUDGING" }'),
  "failure release is conditional on the claim still being held"
);
assert.ok(
  source.includes("alreadyProcessing: true"),
  "losing JUDGING caller returns a benign no-op"
);
const losingClaimSection = source.slice(
  source.indexOf("if (claim.count === 0)"),
  source.indexOf("  try {", source.indexOf("if (claim.count === 0)"))
);
assert.ok(
  losingClaimSection.includes("select: { status: true, showDayId: true }"),
  "losing caller reloads only state needed to stop before preparation"
);
assert.ok(
  source.includes("const existingResults = await tx.showResult.findMany"),
  "result creation performs a stale-state lookup"
);
assert.ok(
  source.includes("existingShowResultId=${crossBlockResult.id}"),
  "cross-block stale result diagnostic identifies the existing result"
);
assert.ok(
  source.indexOf("const existingResults = await tx.showResult.findMany") < resultWrite,
  "stale-state lookup precedes ShowResult creation"
);
assert.equal(
  judgeShowBlockSection.includes("skipDuplicates"),
  false,
  "ShowResult writes do not silently skip conflicts"
);

console.log("Judging publication claim regression checks passed.");
