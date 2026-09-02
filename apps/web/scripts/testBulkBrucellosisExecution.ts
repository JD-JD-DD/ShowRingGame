import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRUCELLOSIS_DISEASE_CODE,
  BRUCELLOSIS_TEST_FEE,
  BRUCELLOSIS_TEST_VALID_HOURS,
} from "@showring/rules";
import { prepareBulkBrucellosisScreeningPersistence } from "../server/services/infectiousDisease.service";

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
const singleExecution = service.slice(
  service.indexOf("export async function runBrucellosisScreeningForKennel"),
  service.indexOf("export function prepareBulkBrucellosisScreeningPersistence")
);
const standaloneRoute = readFileSync(
  join(root, "apps/web/app/api/dogs/[dogId]/brucellosis-screening/route.ts"),
  "utf8"
);

assert.ok(
  bulkExecution.includes("const result = await db.$transaction(async (tx) =>"),
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
  bulkExecution.includes("await tx.dogInfectiousDiseaseStatus.findMany({") &&
    !bulkExecution.includes("executeBrucellosisScreeningForKennelTx(tx, {") &&
    !bulkExecution.includes("runBrucellosisTest(tx,"),
  "bulk Brucellosis loads disease statuses once instead of invoking the per-dog seam"
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
  standaloneRoute.includes("runBrucellosisScreeningForKennel({"),
  "standalone Brucellosis screening delegates to the Health-domain transaction"
);
assert.ok(
  !standaloneRoute.includes("tx.kennel.update({") &&
    !standaloneRoute.includes("ledgerTransaction.create"),
  "standalone route does not own balance or ledger mutation"
);
assert.ok(
  singleExecution.includes("return db.$transaction(async (tx) =>") &&
    singleExecution.includes("kennel.balance < BRUCELLOSIS_TEST_FEE") &&
    singleExecution.includes("executeBrucellosisScreeningForKennelTx(tx, {"),
  "single Brucellosis screening validates affordability and runs through one service transaction"
);
assert.ok(
  singleExecution.includes('throw new BrucellosisScreeningError("Dog not found.")') &&
    singleExecution.includes("You can only screen dogs owned by your kennel.") &&
    singleExecution.includes("Only living dogs can complete brucellosis screening."),
  "single Brucellosis screening preserves route-visible validation errors"
);
assert.ok(
  service.includes("data: { balance: args.runningBalance.value }") &&
    service.includes("amount: -BRUCELLOSIS_TEST_FEE") &&
    service.includes("balanceAfter: args.runningBalance.value"),
  "single Brucellosis screening co-persists the existing debit and post-debit ledger semantics"
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
  'phase = "loadDiseaseStatus"',
  'phase = "prepareScreenings"',
  'phase = "persistScreenings"',
  'phase = "persistLedger"',
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
assert.ok(
  bulkExecution.includes(
    "await tx.infectiousDiseaseTestRecord.createMany({ data: testRecords })"
  ) &&
    bulkExecution.includes(
      "await tx.ledgerTransaction.createMany({ data: ledgerTransactions })"
    ) &&
    !bulkExecution.includes("tx.dogInfectiousDiseaseStatus.findUnique") &&
    !bulkExecution.includes("tx.infectiousDiseaseTestRecord.create({") &&
    !bulkExecution.includes("tx.ledgerTransaction.create({"),
  "bulk Brucellosis uses one status query and bounded record/ledger writes"
);

const dogs = Array.from({ length: 50 }, (_, index) => ({
  id: `bruc-dog-${index + 1}`,
  registeredName: null,
  callName: null,
  regNumber: `BRUC-${index + 1}`,
  visibleTitlePrefix: null,
  visibleTitleSuffix: null,
}));
const startingBalance = 100_000;
let preparedCount = 0;
const prepared = prepareBulkBrucellosisScreeningPersistence({
  kennelId: "bruc-kennel",
  dogs,
  statusByDogId: new Map([[dogs[0]!.id, "INFECTED"]]),
  currentEpoch: 4321,
  runningBalance: { value: startingBalance },
  onPrepared: () => {
    preparedCount += 1;
  },
});

assert.equal(preparedCount, 50, "a 50-dog cohort prepares every screening");
assert.equal(prepared.testRecords.length, 50, "one test record is prepared per dog");
assert.equal(prepared.ledgerTransactions.length, 50, "one ledger row is prepared per dog");
assert.equal(prepared.testRecords[0]?.resultCode, "POSITIVE", "infected dogs screen positive");
assert.equal(
  prepared.testRecords[1]?.resultCode,
  "NEGATIVE",
  "dogs without an infected status screen negative"
);
assert.equal(
  prepared.testRecords[1]?.validUntilEpoch,
  4321 + BRUCELLOSIS_TEST_VALID_HOURS,
  "negative screens retain their existing validity period"
);
assert.equal(
  prepared.ledgerTransactions[0]?.amount,
  -BRUCELLOSIS_TEST_FEE,
  "every screening retains the canonical charge"
);
assert.equal(
  prepared.ledgerTransactions.at(-1)?.balanceAfter,
  startingBalance - 50 * BRUCELLOSIS_TEST_FEE,
  "ledger rows retain deterministic progressive balances"
);
assert.equal(
  prepared.testRecords[0]?.diseaseCode,
  BRUCELLOSIS_DISEASE_CODE,
  "every prepared test retains the Brucellosis disease code"
);

console.log("Bulk brucellosis execution source checks passed.");
