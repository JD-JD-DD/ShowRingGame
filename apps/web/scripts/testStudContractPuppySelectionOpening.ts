import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const lifecycle = readFileSync(join(root, "apps/web/server/services/studContractLifecycle.service.ts"), "utf8");
const route = readFileSync(join(root, "apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts"), "utf8");
const page = readFileSync(join(root, "apps/web/app/litters/page.tsx"), "utf8");

for (const fragment of [
  "openQualifiedStudContractPuppySelections",
  'compensationType: { in: ["PUPPY_BACK", "CASH_AND_PUPPY_BACK"] }',
  "whelpQualificationAt: { not: null }",
  "puppyBackMinimumMet: true",
  "PUPPY_SELECTION_TURN_MS",
  'status: "WAITING"',
  'status: state, currentActor, turnStartedAt: now, turnDeadlineAt: deadline',
  "STUD_PUPPY_SELECTION_OPEN:",
]) assert.ok(lifecycle.includes(fragment), fragment);
assert.ok(!lifecycle.includes("studOffer.find"));
assert.ok(!route.includes("openQualifiedStudContractPuppySelections"));
assert.ok(page.includes("Stud Contract Selection"));
assert.ok(page.includes("turnDeadlineAt"));
assert.ok(!page.includes("Select Puppy"));
console.log("Stud Contract Puppy Back selection opening checks passed.");
