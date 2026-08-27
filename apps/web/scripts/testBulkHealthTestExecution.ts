import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const healthService = source("apps/web/server/services/healthTest.service.ts");
const executionRoute = source("apps/web/app/api/kennel/dogs/health-tests/route.ts");

for (const marker of [
  "async function executePhenotypeHealthTestsForKennelTx",
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
  'phase = "healthResultProcessing"',
  'phase = "transactionCommit"',
]) {
  assert.ok(healthService.includes(marker), `bulk health execution retains ${marker}`);
}

assert.ok(
  healthService.indexOf("export async function runBulkPhenotypeHealthTestsForKennel") >
    healthService.indexOf("async function executePhenotypeHealthTestsForKennelTx"),
  "bulk orchestration reuses the transaction-aware execution helper"
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
  !healthService.includes("timeout:") && !healthService.includes("maxWait:"),
  "bulk health observability does not change transaction timing"
);
assert.ok(
  !healthService.includes('console.info("Bulk health test execution completed", {\n      resultCode'),
  "bulk health success diagnostics do not log health result values"
);

console.log("Bulk health test execution source checks passed.");
