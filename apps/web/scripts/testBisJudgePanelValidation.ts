import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_SHOW_GROUP_CODES } from "@showring/rules";
import { requireCompleteShowDayJudgePanelForBis } from "../server/services/showDayGroupJudgeAssignment.service";

const assignments = CANONICAL_SHOW_GROUP_CODES.map((groupCode, index) => ({
  groupCode,
  judgeId: `judge-${index + 1}`,
}));

function requirePanel(overrides: Partial<Parameters<typeof requireCompleteShowDayJudgePanelForBis>[0]> = {}) {
  return requireCompleteShowDayJudgePanelForBis({
    showDayId: "show-day-1",
    bisJudgeId: "judge-1",
    assignments,
    ...overrides,
  });
}

function assertInvalid(overrides: Partial<Parameters<typeof requireCompleteShowDayJudgePanelForBis>[0]>, label: string) {
  assert.throws(() => requirePanel(overrides), /Invalid scheduled BIS judge panel/, label);
}

assert.equal(requirePanel().bisJudgeId, "judge-1", "complete canonical panel accepts its scheduled BIS judge");
assert.equal(requirePanel().bisJudgeId, "judge-1", "an empty assigned group does not affect BIS panel validation");
assertInvalid({ assignments: assignments.slice(0, 7) }, "seven assignments fail closed");
assertInvalid({ assignments: [...assignments, { groupCode: CANONICAL_SHOW_GROUP_CODES[0], judgeId: "judge-9" }] }, "nine assignments fail closed");
assertInvalid({ assignments: assignments.slice(1) }, "missing canonical group fails closed");
assertInvalid({ assignments: assignments.map((assignment, index) => index === 7 ? { ...assignment, groupCode: CANONICAL_SHOW_GROUP_CODES[0] } : assignment) }, "duplicate group fails closed");
assertInvalid({ assignments: assignments.map((assignment) => ({ ...assignment, judgeId: "judge-1" })) }, "duplicate judge fails closed");
assertInvalid({ bisJudgeId: null }, "null BIS judge fails closed");
assertInvalid({ bisJudgeId: "outside-panel" }, "BIS judge outside panel fails closed");

const root = process.cwd().endsWith(join("apps", "web")) ? join(process.cwd(), "..", "..") : process.cwd();
const judging = readFileSync(join(root, "apps/web/server/services/judging.service.ts"), "utf8");
const invitational = readFileSync(join(root, "apps/web/server/services/invitational.service.ts"), "utf8");
const validatorCall = judging.indexOf("await requirePersistedCompleteShowDayJudgePanelForBis({");
const bisScoring = judging.indexOf("const judgedBestInShowAwards = judgeBestInShow({");
assert.ok(validatorCall >= 0 && validatorCall < bisScoring, "regular and invitational BIS finalization validate before scoring");
assert.ok(invitational.includes("judgeId: invitationalDayPlan.bisJudgeId"), "Week 52 persists the scheduled BIS judge consumed by shared finalization");
assert.ok(invitational.includes("tx.showDayGroupJudgeAssignment.createMany"), "Week 52 persists the panel consumed by shared finalization");
assert.ok(judging.includes("judgeId: bisJudgeId"), "BIS and Reserve BIS persist the same validated judge");

console.log("BIS judge panel validation checks passed.");
