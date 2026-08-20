import assert from "node:assert/strict";

import {
  calculateGrandChampionCompetitionCounts,
  GrandChampionCompetitionError,
  type GrandChampionCompetitionSnapshot,
} from "../engines/grandChampionCompetition.engine";

const competitor = (
  dogId: string,
  sex: "M" | "F",
  overrides: Partial<GrandChampionCompetitionSnapshot["bobLevelCompetitors"][number]> = {}
) => ({ dogId, sex, countsForGchCompetition: true, eligibleForGchRecipient: true, championDefeatEligible: true, ...overrides });

function snapshot(overrides: Partial<GrandChampionCompetitionSnapshot> = {}): GrandChampionCompetitionSnapshot {
  return {
    breedCode2: "TST",
    regularCompetitorCounts: { M: 3, F: 2 },
    bobLevelCompetitors: [competitor("bob-m", "M"), competitor("bos-f", "F"), competitor("select-m", "M"), competitor("select-f", "F")],
    awards: { BOB: { dogId: "bob-m", sex: "M" }, BOS: { dogId: "bos-f", sex: "F" }, SELECT_DOG: { dogId: "select-m", sex: "M" }, SELECT_BITCH: { dogId: "select-f", sex: "F" } },
    sameShowDayWinnersDogIds: new Set<string>(),
    sameShowDayWinnersBitchIds: new Set<string>(),
    ...overrides,
  };
}

function resultFor(value: GrandChampionCompetitionSnapshot, awardCode: string) {
  return calculateGrandChampionCompetitionCounts(value).find((result) => result.awardCode === awardCode);
}

{
  const value = resultFor(snapshot(), "BOB");
  assert.deepEqual(value && { count: value.competitionCount, sameSex: value.bobSameSexComparisonCount }, { count: 9, sameSex: 5 }, "male BOB includes both regular sexes and all additional BOB competitors");
  assert.equal(value?.recipientEligible, true, "previously Champion BOB recipient is eligible");
}
{
  const value = resultFor(snapshot({ awards: { BOB: { dogId: "bos-f", sex: "F" } } }), "BOB");
  assert.deepEqual(value && { count: value.competitionCount, sameSex: value.bobSameSexComparisonCount }, { count: 9, sameSex: 4 }, "female BOB is symmetric and returns its same-sex comparison");
}
assert.equal(resultFor(snapshot(), "BOS")?.competitionCount, 4, "BOS female excludes male population");
assert.equal(resultFor(snapshot({ awards: { BOB: { dogId: "bos-f", sex: "F" }, BOS: { dogId: "bob-m", sex: "M" } } }), "BOS")?.competitionCount, 5, "BOS male excludes female population");
assert.equal(resultFor(snapshot(), "SELECT_DOG")?.competitionCount, 4, "Select Dog subtracts exactly one higher male award and keeps recipient");
assert.equal(resultFor(snapshot(), "SELECT_BITCH")?.competitionCount, 3, "Select Bitch subtracts exactly one higher female award and keeps recipient");

{
  const value = resultFor(snapshot({ sameShowDayWinnersDogIds: new Set(["bob-m"]) }), "BOB");
  assert.equal(value?.recipientEligible, false, "same-show WD overrides recipient eligibility");
  assert.equal(value?.competitionCount, 9, "same-show WD exclusion does not alter numerical count");
}
assert.equal(resultFor(snapshot({ sameShowDayWinnersBitchIds: new Set(["bos-f"]) }), "BOS")?.recipientEligible, false, "same-show WB overrides recipient eligibility");

{
  const value = resultFor(snapshot({ bobLevelCompetitors: [
    competitor("bob-m", "M"), competitor("bos-f", "F"), competitor("select-m", "M"), competitor("select-f", "F"),
    competitor("class-wd", "M", { countsForGchCompetition: false, eligibleForGchRecipient: false, championDefeatEligible: false }),
  ] }), "BOB");
  assert.equal(value?.competitionCount, 9, "regular-class Winner represented at BOB level is not double-counted");
  assert.equal(value?.championDefeatFacts.qualifyingChampionOpponentCount, 3, "same-day finishing WD is not Champion-defeat evidence");
}
{
  const value = resultFor(snapshot(), "BOB");
  assert.equal(value?.championDefeatFacts.qualifyingChampionOpponentCount, 3, "Champion-defeat evidence excludes recipient and is not competition count minus one");
}
{
  const original = snapshot();
  const before = structuredClone({ regularCompetitorCounts: original.regularCompetitorCounts, bobLevelCompetitors: original.bobLevelCompetitors, awards: original.awards, winnersDog: [...original.sameShowDayWinnersDogIds], winnersBitch: [...original.sameShowDayWinnersBitchIds] });
  const first = calculateGrandChampionCompetitionCounts(original);
  const reversed = calculateGrandChampionCompetitionCounts({ ...original, bobLevelCompetitors: [...original.bobLevelCompetitors].reverse() });
  assert.deepEqual(first, reversed, "input order does not alter output");
  assert.deepEqual({ regularCompetitorCounts: original.regularCompetitorCounts, bobLevelCompetitors: original.bobLevelCompetitors, awards: original.awards, winnersDog: [...original.sameShowDayWinnersDogIds], winnersBitch: [...original.sameShowDayWinnersBitchIds] }, before, "engine does not mutate input");
}
for (const invalidSnapshot of [
  snapshot({ regularCompetitorCounts: { M: -1, F: 0 } }),
  snapshot({ bobLevelCompetitors: [competitor("dup", "M"), competitor("dup", "F")] }),
  snapshot({ awards: { BOB: { dogId: "bob-m", sex: "M" }, BOS: { dogId: "bob-m", sex: "F" } } }),
  snapshot({ awards: { BOB: { dogId: "bob-m", sex: "F" } } }),
  snapshot({ awards: { BOB: { dogId: "bob-m", sex: "M" }, BOS: { dogId: "bos-f", sex: "F" }, SELECT_DOG: { dogId: "select-m", sex: "F" } } }),
  snapshot({ awards: { BOB: { dogId: "bob-m", sex: "M" }, BOS: { dogId: "bos-f", sex: "F" }, SELECT_DOG: { dogId: "bob-m", sex: "M" } } }),
]) assert.throws(() => calculateGrandChampionCompetitionCounts(invalidSnapshot), GrandChampionCompetitionError);
{
  const large = snapshot({
    regularCompetitorCounts: { M: 5_000, F: 5_000 },
    bobLevelCompetitors: Array.from({ length: 10_000 }, (_, index) => competitor(index === 0 ? "bob-m" : `special-${index}`, index % 2 === 0 ? "M" : "F", { eligibleForGchRecipient: index === 0, championDefeatEligible: index % 3 === 0 })),
    awards: { BOB: { dogId: "bob-m", sex: "M" } },
  });
  assert.equal(calculateGrandChampionCompetitionCounts(large)[0]?.competitionCount, 20_000, "large snapshot uses bounded population arithmetic");
}
assert.deepEqual(calculateGrandChampionCompetitionCounts(snapshot({ awards: {} })), [], "empty qualifying awards are deterministic");
console.log("Grand Champion competition engine checks passed.");
