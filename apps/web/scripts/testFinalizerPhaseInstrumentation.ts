import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const judging = readFileSync(
  join(root, "apps/web/server/services/judging.service.ts"),
  "utf8"
);

function section(start: string, end: string): string {
  const startIndex = judging.indexOf(start);
  const endIndex = judging.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing ${start}`);
  return judging.slice(startIndex, endIndex);
}

const wrapper = section(
  "async function runShowDayFinalizationPhase",
  "function skippedGrandChampionProcessing"
);
const finalizer = section(
  "export async function finalizeReadyShowDayResults",
  "export async function closeReadyEmptyShowDays"
);

assert.match(wrapper, /"publish-show-results finalization phase start"/);
assert.match(wrapper, /"publish-show-results finalization phase complete"/);
assert.match(wrapper, /showDayId: args\.showDayId/);
assert.match(wrapper, /phase: args\.phaseName/);
assert.match(wrapper, /durationMs,/);
assert.match(wrapper, /const result = await args\.action\(\);/);
assert.match(wrapper, /return result;/);
assert.match(wrapper, /throw new ShowDayFinalizationPhaseError/);
assert.equal((wrapper.match(/args\.action\(\)/g) ?? []).length, 1);
assert.match(wrapper, /cause: error/);

const phaseNames = [
  "closeEmptyShowDay",
  "remainingJudgingBlocks",
  "groupAwards",
  "bestInShowAwards",
  "finalsTitleProgress",
  "grandChampionProcessing",
  "prestigeRefresh",
  "publishStatus",
];
let previousIndex = -1;
for (const phaseName of phaseNames) {
  const index = finalizer.indexOf(`phaseName: \"${phaseName}\"`);
  assert.ok(index > previousIndex, `${phaseName} must retain finalization order`);
  previousIndex = index;
}

assert.match(finalizer, /getCompletionLogFields: \(created\) => \(\{ groupAwardsCreated: created \}\)/);
assert.match(finalizer, /getCompletionLogFields: \(created\) => \(\{ bestInShowAwardsCreated: created \}\)/);
assert.match(finalizer, /getCompletionLogFields: \(result\) => result/);
assert.match(finalizer, /creditsProcessed: result\.creditsProcessed/);
console.log("Finalizer phase instrumentation regression checks passed.");
