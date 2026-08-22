import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const lifecycle = source("apps/web/server/services/studContractLifecycle.service.ts");
const selection = source("apps/web/server/services/studContractPuppySelection.service.ts");
const route = source("apps/web/app/api/cron/process-stud-contract-lifecycle/route.ts");
const page = source("apps/web/app/litters/page.tsx");

for (const fragment of [
  "processExpiredStudContractPuppySelectionTurns",
  'status: { in: ["DAM_FIRST_PICK", "STUD_PICK"] }',
  "turnDeadlineAt: { not: null, lte: now }",
  "take: limit",
  "damFirstPickForfeitedAt: now",
  'status: "STUD_PICK"',
  "litter: { select: { bornEpoch: true } }",
  "getStudContractPuppySelectionDeadlines(selection.litter.bornEpoch).secondPickStudDeadlineAt",
  "turnDeadlineAt: studDeadline",
  "hasSelectableStudContractPuppy",
  'status: "UNFULFILLABLE"',
  "studSelectionForfeitedAt: now",
  'status: "FORFEITED"',
  "completedAt: now",
  "turnDeadlineAt: null",
  "STUD_PUPPY_SELECTION_DAM_FORFEITED:",
  "STUD_PUPPY_SELECTION_STUD_FORFEITED:",
]) assert.ok(lifecycle.includes(fragment), fragment);

assert.equal(lifecycle.includes("new Date(now.getTime() + PUPPY_SELECTION_TURN_MS)"), false);
assert.ok(lifecycle.includes("Your fixed deadline is ${studDeadline.toLocaleString()}"));

assert.ok(selection.includes("hasSelectableStudContractPuppy"));
assert.ok(route.includes("processExpiredStudContractPuppySelectionTurns"));
assert.ok(route.indexOf("openQualifiedStudContractPuppySelections") < route.indexOf("processExpiredStudContractPuppySelectionTurns"));
assert.ok(page.includes("Protected first-pick deadline missed."));
assert.ok(page.includes("Puppy Back selection deadline missed."));
assert.equal(lifecycle.includes("studOffer.find"), false);
assert.equal(lifecycle.includes("ledgerTransaction"), false);
assert.equal(lifecycle.includes("dog.update({"), false);

console.log("Stud Contract Puppy Back deadline lifecycle checks passed.");
