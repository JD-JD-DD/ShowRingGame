import { strict as assert } from "node:assert";

import { evaluateGrandChampionQualification } from "../engines/grandChampionQualification.engine";

const credit = (id: string, showDayId: string, pointsAwarded: number, judgeId: string | null, overrides = {}) => ({
  id, showDayId, pointsAwarded, judgeId,
  isMajor: pointsAwarded >= 3,
  countsAsChampionDefeat: true,
  qualifyingChampionOpponentCount: null,
  ...overrides,
});
const evaluate = (credits: Parameters<typeof evaluateGrandChampionQualification>[0]["credits"], alreadyGrandChampion = false) =>
  evaluateGrandChampionQualification({ credits, alreadyGrandChampion });

const threeMajors = [credit("a", "a", 8, "A"), credit("b", "b", 8, "B"), credit("c", "c", 8, "C")];
assert.equal(evaluate([credit("one", "one", 25, "A")]).qualifiesForInitialGch, false);
assert.equal(evaluate([...threeMajors.map((item, index) => ({ ...item, judgeId: index === 2 ? "B" : item.judgeId })), credit("d", "d", 1, "D")]).requirements.majorJudgesMet, false);
assert.equal(evaluate(threeMajors).requirements.majorJudgesMet, true);
assert.equal(evaluate(threeMajors).qualifiesForInitialGch, false);
assert.equal(evaluate([...threeMajors, credit("d", "d", 1, "D")]).qualifiesForInitialGch, true);
assert.equal(evaluate([...threeMajors, credit("d", "d", 3, "D")]).qualifiesForInitialGch, true);
assert.equal(evaluate([...threeMajors, credit("zero", "zero", 0, "D")]).requirements.additionalJudgeMet, false);
assert.equal(evaluate(threeMajors).qualifyingMajorPoints, 24);
assert.equal(evaluate([...threeMajors, credit("two", "two", 2, "D")]).majorShowCount, 3);
assert.equal(evaluate([...threeMajors, credit("d", "d", 1, "D", { countsAsChampionDefeat: false })]).championDefeatShowCount, 3);
assert.equal(evaluate([...threeMajors.slice(0, 2), credit("d", "d", 1, "D")]).requirements.championDefeatsMet, false);
assert.equal(evaluate([...threeMajors, credit("duplicate", "a", 7, "D")]).totalPoints, 24);
assert.equal(evaluate([credit("new", "new", 1, "A", { countsAsChampionDefeat: false, qualifyingChampionOpponentCount: 1 })]).championDefeatShowCount, 1);
assert.equal(evaluate([credit("new", "new", 1, "A", { countsAsChampionDefeat: true, qualifyingChampionOpponentCount: 0 })]).championDefeatShowCount, 0);
assert.equal(evaluate([credit("legacy", "legacy", 1, null, { countsAsChampionDefeat: true })]).pointAwardingJudgeCount, 0);
assert.equal(evaluate([...threeMajors, credit("d", "d", 1, "D")], true).highestPointTier, "GCH");
assert.equal(evaluate([credit("historic", "historic", 1, null)], true).highestPointTier, "GCH");
assert.equal(evaluate([...threeMajors, credit("d", "d", 76, "D")], true).highestPointTier, "GCHB");
assert.deepEqual(evaluate([...threeMajors, credit("d", "d", 1, "D")]), evaluate([credit("d", "d", 1, "D"), ...threeMajors].reverse()));

console.log("Grand Champion qualification tests passed.");
