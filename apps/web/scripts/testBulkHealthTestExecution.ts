import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PHENOTYPE_HEALTH_TESTS,
  PHENOTYPE_HEALTH_TEST_CODES,
  generateFoundationPhenotypeHealthTruths,
} from "@showring/rules";
import {
  createDeterministicPhenotypeHealthRandom,
  prepareBulkPhenotypeHealthTestPersistence,
} from "../server/services/healthTest.service";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const healthService = source("apps/web/server/services/healthTest.service.ts");
const executionRoute = source("apps/web/app/api/kennel/dogs/health-tests/route.ts");
const bulkStart = healthService.indexOf(
  "export async function runBulkPhenotypeHealthTestsForKennel"
);
const bulkExecution = healthService.slice(bulkStart);

for (const marker of [
  "async function executePhenotypeHealthTestsForKennelTx",
  "export function prepareBulkPhenotypeHealthTestPersistence",
  "export async function runPhenotypeHealthTestsForKennel",
  "export async function runBulkPhenotypeHealthTestsForKennel",
  "return db.$transaction(async (tx) =>",
  "lockDogsForPhenotypeHealthTesting(tx, dogIds)",
  "FOR UPDATE",
  "getRequiredHealthTestsForBreed(dog.breedCode2)",
  "PHENOTYPE_HEALTH_TESTS[testTypeCode].fee",
  "NOT_OWNED_OR_NOT_FOUND",
  "NOT_ALIVE",
  "NOT_APPLICABLE_TO_BREED",
  "TOO_YOUNG",
  "ALREADY_COMPLETED",
  'transactionType: "HEALTH_TEST_FEE"',
  "balanceAfter: args.runningBalance.value",
  'operation: "bulk-health-tests"',
  'console.info("Bulk health test execution started"',
  'console.info("Bulk health test execution completed"',
  'console.error("Bulk health test execution failed"',
  "runnableTestCount",
  "plannedTestCount",
  "processedTestCount",
  "transactionDurationMs",
  "errorName",
  "errorCode",
  "errorMessage",
  'phase = "dogLock"',
  'phase = "loadHealthTruth"',
  'phase = "prepareResults"',
  'phase = "persistResults"',
  'phase = "persistLedger"',
  'phase = "transactionCommit"',
]) {
  assert.ok(healthService.includes(marker), `bulk health execution retains ${marker}`);
}

assert.ok(
  healthService.indexOf("lockDogsForPhenotypeHealthTesting(tx, dogIds)", bulkStart) <
    healthService.indexOf("const dogs = await tx.dog.findMany({", bulkStart),
  "bulk execution locks dogs before final state and completion revalidation"
);
assert.ok(
  executionRoute.includes("runBulkPhenotypeHealthTestsForKennel"),
  "bulk execution route delegates to the canonical service"
);
assert.ok(
  executionRoute.includes("dogIds: body.dogIds"),
  "execution route accepts the current cohort only from its request body"
);
assert.ok(
  executionRoute.includes("selection: body.selection"),
  "execution route mirrors preview selection semantics"
);
assert.ok(
  executionRoute.includes("error.message.startsWith(\"Insufficient funds\")"),
  "bulk execution retains the player-safe insufficient-funds message"
);
assert.ok(
  !executionRoute.includes("error instanceof Error ? error.message"),
  "bulk execution does not expose unexpected server errors"
);
assert.ok(
  bulkExecution.includes("}, { timeout: 15_000 });") &&
    !bulkExecution.includes("maxWait:"),
  "bulk execution has a scoped 15-second safety timeout without changing maxWait"
);
assert.ok(
  !healthService.includes('console.info("Bulk health test execution completed", {\n      resultCode'),
  "bulk health success diagnostics do not log health result values"
);
assert.ok(
  bulkExecution.includes(
    "await ensurePhenotypeHealthTruthsForDogs(\n      tx,\n      executionPlan.map((item) => item.dog.id)"
  ) && !bulkExecution.includes("tx.dogHealthConditionTruth.findMany"),
  "bulk execution loads and repairs health truth once for the runnable cohort"
);
assert.ok(
  bulkExecution.includes("await tx.healthTestRecord.createMany({ data: healthTestRecords })") &&
    bulkExecution.includes("await tx.ledgerTransaction.createMany({ data: ledgerTransactions })") &&
    !bulkExecution.includes("tx.healthTestRecord.create({") &&
    !bulkExecution.includes("tx.ledgerTransaction.create({"),
  "bulk execution persists result and ledger rows with bounded writes"
);

const testTypeCode = PHENOTYPE_HEALTH_TEST_CODES[0]!;
const dogIds = Array.from({ length: 50 }, (_, index) => `bulk-dog-${index + 1}`);
const startingBalance = 100_000;
let preparedCount = 0;
const prepared = prepareBulkPhenotypeHealthTestPersistence({
  kennelId: "bulk-kennel",
  executionPlan: dogIds.map((id) => ({
    dog: { id, regNumber: `REG-${id}` },
    testTypeCodes: [testTypeCode],
  })),
  truthsByDogId: new Map(
    dogIds.map((id) => [
      id,
      generateFoundationPhenotypeHealthTruths(
        createDeterministicPhenotypeHealthRandom(id)
      ),
    ])
  ),
  currentEpoch: 12345,
  runningBalance: { value: startingBalance },
  onPrepared: () => {
    preparedCount += 1;
  },
});

assert.equal(preparedCount, 50, "large cohorts prepare every runnable pair");
assert.equal(prepared.healthTestRecords.length, 50, "one result row is prepared per pair");
assert.equal(prepared.ledgerTransactions.length, 50, "one ledger row is prepared per pair");
assert.equal(
  prepared.ledgerTransactions.at(-1)?.balanceAfter,
  startingBalance - 50 * PHENOTYPE_HEALTH_TESTS[testTypeCode].fee,
  "large cohorts retain deterministic progressive ledger balances"
);

console.log("Bulk health test execution source checks passed.");
