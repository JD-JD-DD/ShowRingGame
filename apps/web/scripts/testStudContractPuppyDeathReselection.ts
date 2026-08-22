import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const selection = source("apps/web/server/services/studContractPuppySelection.service.ts");
const lifecycle = source("apps/web/server/services/lifecycle.service.ts");
const contractLifecycle = source("apps/web/server/services/studContractLifecycle.service.ts");
const route = source("apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts");

for (const fragment of [
  "reconcileSelectedStudContractPuppyDeath",
  'where: { status: "SELECTED", selectedDogId: args.dogId }',
  'selectedDog?.lifecycleState !== "DECEASED"',
  'litter: { select: { bornEpoch: true } }',
  'const bornEpoch = selection.litter.bornEpoch',
  'bornEpoch + PUPPY_SALE_MIN_AGE_HOURS',
  "PUPPY_SALE_MIN_AGE_HOURS",
  "hasSelectableStudContractPuppy",
  'status: "STUD_PICK"',
  "selectedDogId: null",
  'status: "UNFULFILLABLE"',
  "STUD_PUPPY_SELECTION_REOPENED:",
  "STUD_PUPPY_SELECTION_UNFULFILLABLE_DEATH:",
]) assert.ok(selection.includes(fragment), fragment);

const selectedDeath = selection.slice(
  selection.indexOf("export async function reconcileSelectedStudContractPuppyDeath"),
  selection.indexOf("export async function selectDamProtectedPuppy"),
);
assert.equal(selectedDeath.includes("selectedDog.birthEpoch"), false);
assert.equal(selectedDeath.includes("whelpQualificationAt"), false);
assert.equal(selectedDeath.includes("liveBornPuppyCount"), false);
assert.equal(selectedDeath.includes("puppyBackMinimumMet"), false);
assert.equal(selectedDeath.includes("smallLitterReturnServiceMet"), false);
assert.ok(lifecycle.includes("reconcileSelectedStudContractPuppyDeath"));
const mortality = lifecycle.slice(lifecycle.indexOf("export async function markDogDeceased"));
assert.ok(mortality.indexOf('lifecycleState: "DECEASED"') < mortality.indexOf("reconcileSelectedStudContractPuppyDeath"));
assert.ok(contractLifecycle.includes("reconcileSelectedStudContractPuppyDeaths"));
assert.ok(route.includes("reconcileSelectedStudContractPuppyDeaths"));
assert.equal(selection.includes("studOffer.find"), false);
assert.equal(selection.includes("ledgerTransaction"), false);
assert.equal(selection.includes("ownerKennelId:"), false);

console.log("Stud Contract selected puppy death reselection checks passed.");
