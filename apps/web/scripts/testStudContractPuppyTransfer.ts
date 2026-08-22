import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const lifecycle = read("apps/web/server/services/studContractLifecycle.service.ts");
const selection = read("apps/web/server/services/studContractPuppySelection.service.ts");
const cron = read("apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts");
const protection = read("apps/web/server/services/studContractPuppyProtection.service.ts");
const transfer = lifecycle.slice(
  lifecycle.indexOf("export async function processDueStudContractPuppyTransfers"),
  lifecycle.indexOf("export async function processExpiredStudContractRequests")
);

for (const fragment of [
  "processDueStudContractPuppyTransfers",
  'status: "SELECTED"',
  "selectedDogId: { not: null }",
  'selectedDog: { lifecycleState: "ALIVE" }',
  "litter: { bornEpoch:",
  "getStudContractPuppySelectionCutoffEpoch(bornEpoch)",
  "ownerKennelId !== selection.contract.damKennelId",
  "ensureUncategorizedKennelRun",
  "ownerKennelId: destinationKennel.id, kennelRunId: destinationRun.id",
  'status: "COMPLETED"',
  "completedAt: now",
  "STUD_PUPPY_TRANSFER_DAM:",
  "STUD_PUPPY_TRANSFER_STUD:",
]) assert.ok(transfer.includes(fragment), fragment);

assert.ok(selection.includes("getStudContractPuppySelectionCutoffEpoch"));
assert.ok(selection.includes("PUPPY_SALE_MIN_AGE_HOURS"));
assert.ok(cron.includes("processDueStudContractPuppyTransfers"));
assert.ok(cron.includes("puppyTransfers"));
assert.ok(protection.includes('"COMPLETED"') === false);
assert.equal(transfer.includes("selectedDog.birthEpoch"), false);
assert.equal(transfer.includes("ledgerTransaction"), false);
assert.equal(transfer.includes("breederKennelId:"), false);

console.log("Stud Contract Day-56 Puppy Back transfer checks passed.");
