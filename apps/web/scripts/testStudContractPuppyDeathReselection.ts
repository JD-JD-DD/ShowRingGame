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
  "PUPPY_SALE_MIN_AGE_HOURS",
  "hasSelectableStudContractPuppy",
  'status: "STUD_PICK"',
  "selectedDogId: null",
  'status: "UNFULFILLABLE"',
  "STUD_PUPPY_SELECTION_REOPENED:",
  "STUD_PUPPY_SELECTION_UNFULFILLABLE_DEATH:",
]) assert.ok(selection.includes(fragment), fragment);

assert.ok(lifecycle.includes("reconcileSelectedStudContractPuppyDeath"));
assert.ok(lifecycle.indexOf('lifecycleState: "DECEASED"') < lifecycle.indexOf("reconcileSelectedStudContractPuppyDeath"));
assert.ok(contractLifecycle.includes("reconcileSelectedStudContractPuppyDeaths"));
assert.ok(route.includes("reconcileSelectedStudContractPuppyDeaths"));
assert.equal(selection.includes("studOffer.find"), false);
assert.equal(selection.includes("ledgerTransaction"), false);
assert.equal(selection.includes("ownerKennelId:"), false);

console.log("Stud Contract selected puppy death reselection checks passed.");
