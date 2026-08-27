import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith(join("apps", "web"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const service = readFileSync(
  join(root, "apps/web/server/services/infectiousDisease.service.ts"),
  "utf8"
);
const bulkExecution = service.slice(
  service.indexOf("export async function runBulkBrucellosisScreeningForKennel"),
  service.indexOf("export async function transmitBrucellosisThroughBreeding")
);
const standaloneRoute = readFileSync(
  join(root, "apps/web/app/api/dogs/[dogId]/brucellosis-screening/route.ts"),
  "utf8"
);

assert.ok(
  bulkExecution.includes("return db.$transaction(async (tx) =>"),
  "bulk Brucellosis execution is transactional"
);
assert.ok(
  bulkExecution.includes("const dogIds = normalizeBulkBrucellosisDogIds(args.dogIds);"),
  "bulk Brucellosis execution deduplicates and validates IDs"
);
assert.ok(
  bulkExecution.includes("dog.ownerKennelId !== args.kennelId"),
  "bulk Brucellosis revalidates ownership"
);
assert.ok(
  bulkExecution.includes('dog.lifecycleState !== "ALIVE"'),
  "bulk Brucellosis revalidates lifecycle"
);
assert.ok(
  bulkExecution.includes("screenableDogs.length * BRUCELLOSIS_TEST_FEE"),
  "bulk Brucellosis uses the canonical fee for its final cost"
);
assert.ok(
  bulkExecution.includes("kennel.balance < totalCharged"),
  "bulk Brucellosis rejects an insufficient full cohort before writes"
);
assert.ok(
  bulkExecution.includes("data: { balance: kennel.balance - totalCharged }"),
  "bulk Brucellosis makes one aggregate balance mutation"
);
assert.ok(
  bulkExecution.includes("executeBrucellosisScreeningForKennelTx(tx, {"),
  "bulk Brucellosis delegates each screening to the canonical charged seam"
);
assert.ok(
  service.includes("await tx.ledgerTransaction.create({"),
  "the canonical charged seam creates per-dog ledger rows"
);
assert.ok(
  service.includes("balanceAfter: args.runningBalance.value"),
  "ledger rows retain deterministic progressive balances"
);
assert.ok(
  !bulkExecution.includes("getValidNegativeBrucellosisTest"),
  "bulk Brucellosis does not exclude prior negative screenings"
);
assert.ok(
  !bulkExecution.includes("birthEpoch"),
  "bulk Brucellosis has no age gate"
);
assert.ok(
  standaloneRoute.includes("executeBrucellosisScreeningForKennelTx(tx, {"),
  "standalone Brucellosis screening reuses the canonical charged seam"
);
assert.ok(
  standaloneRoute.includes("currentKennel.balance < BRUCELLOSIS_TEST_FEE"),
  "standalone Brucellosis screening retains its funds requirement"
);
for (const marker of [
  'operation: "bulk-brucellosis"',
  'console.info("Bulk brucellosis execution started"',
  'console.info("Bulk brucellosis execution completed"',
  'console.error("Bulk brucellosis execution failed"',
  "screenableDogCount",
  "processedScreeningCount",
  "transactionDurationMs",
  "errorName",
  "errorCode",
  "errorMessage",
  'phase = "screeningProcessing"',
  'phase = "transactionCommit"',
]) {
  assert.ok(service.includes(marker), `bulk Brucellosis diagnostics retain ${marker}`);
}
assert.ok(
  !bulkExecution.includes("timeout:") && !bulkExecution.includes("maxWait:"),
  "bulk Brucellosis observability does not change transaction timing"
);
assert.ok(
  !service.includes('console.info("Bulk brucellosis execution completed", {\n      resultCode'),
  "bulk Brucellosis success diagnostics do not log screening result values"
);

console.log("Bulk brucellosis execution source checks passed.");
