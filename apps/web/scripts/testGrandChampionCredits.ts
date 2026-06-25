import { strict as assert } from "node:assert";

import {
  buildGrandChampionCreditCandidates,
  getGrandChampionPointsForCount,
  type GrandChampionCreditAward,
  type GrandChampionCreditResult,
} from "../server/services/grandChampion.service";

function result(
  dogId: string,
  sex: "M" | "F",
  breedCode2 = "TST",
  champion = true
): GrandChampionCreditResult {
  return {
    dogId,
    breedCode2,
    dog: {
      id: dogId,
      sex,
      visibleTitlePrefix: champion ? "CH" : null,
      visibleTitleSuffix: null,
      titleProgress: champion ? { currentTitleCode: "CH" } : null,
    },
  };
}

function award(
  awardCode: string,
  dogId: string,
  breedCode2 = "TST"
): GrandChampionCreditAward {
  return {
    id: `award-${awardCode}-${dogId}`,
    showDayId: "show-day-1",
    dogId,
    breedCode2,
    awardCode,
  };
}

function candidates(args: {
  results: GrandChampionCreditResult[];
  awards: GrandChampionCreditAward[];
}) {
  return buildGrandChampionCreditCandidates({
    ...args,
    currentEpoch: 1234,
  });
}

assert.equal(getGrandChampionPointsForCount(1), 0);
assert.equal(getGrandChampionPointsForCount(2), 1);
assert.equal(getGrandChampionPointsForCount(3), 2);
assert.equal(getGrandChampionPointsForCount(4), 3);
assert.equal(getGrandChampionPointsForCount(6), 5);
assert.equal(getGrandChampionPointsForCount(10), 5);

assert.deepEqual(
  candidates({
    results: [result("class-bob", "M", "TST", false), result("champ-1", "F")],
    awards: [award("BOB", "class-bob")],
  }),
  []
);

{
  const [credit] = candidates({
    results: [result("champ-bob", "M"), result("champ-bitch", "F")],
    awards: [award("BOB", "champ-bob")],
  });

  assert.equal(credit?.pointsAwarded, 1);
  assert.equal(credit?.isMajor, false);
  assert.equal(credit?.defeatedChampionCount, 1);
  assert.equal(credit?.countsAsChampionDefeat, true);
}

{
  // BOB uses all eligible Champion specials in the breed competition under
  // ShowRing Game's simplified universal GCH point schedule.
  const [credit] = candidates({
    results: [
      result("champ-bob", "M"),
      result("champ-dog-2", "M"),
      result("champ-bitch-1", "F"),
      result("champ-bitch-2", "F"),
      result("champ-bitch-3", "F"),
      result("champ-bitch-4", "F"),
      result("champ-bitch-5", "F"),
    ],
    awards: [award("BOB", "champ-bob")],
  });

  assert.equal(credit?.pointsAwarded, 5);
  assert.equal(credit?.defeatedChampionCount, 6);
}

{
  const [credit] = candidates({
    results: [
      result("champ-bob", "M"),
      result("champ-bos", "F"),
      result("champ-bitch-2", "F"),
      result("champ-bitch-3", "F"),
    ],
    awards: [award("BOS", "champ-bos")],
  });

  assert.equal(credit?.pointsAwarded, 2);
  assert.equal(credit?.isMajor, false);
  assert.equal(credit?.defeatedChampionCount, 2);
}

{
  const [credit] = candidates({
    results: [
      result("champ-bob", "F"),
      result("champ-bos", "M"),
      result("select-dog", "M"),
      result("champ-dog-3", "M"),
      result("champ-dog-4", "M"),
      result("champ-dog-5", "M"),
    ],
    awards: [
      award("BOB", "champ-bob"),
      award("BOS", "champ-bos"),
      award("SELECT_DOG", "select-dog"),
    ],
  }).filter((candidate) => candidate.awardCode === "SELECT_DOG");

  assert.equal(credit?.pointsAwarded, 3);
  assert.equal(credit?.isMajor, true);
  assert.equal(credit?.defeatedChampionCount, 3);
}

{
  const [credit] = candidates({
    results: [
      result("champ-bob", "M"),
      result("champ-bos", "F"),
      result("select-bitch", "F"),
      result("champ-bitch-3", "F"),
      result("champ-bitch-4", "F"),
      result("champ-bitch-5", "F"),
      result("champ-bitch-6", "F"),
      result("champ-bitch-7", "F"),
    ],
    awards: [
      award("BOB", "champ-bob"),
      award("BOS", "champ-bos"),
      award("SELECT_BITCH", "select-bitch"),
    ],
  }).filter((candidate) => candidate.awardCode === "SELECT_BITCH");

  assert.equal(credit?.pointsAwarded, 5);
  assert.equal(credit?.isMajor, true);
  assert.equal(credit?.defeatedChampionCount, 5);
}

{
  const [credit] = candidates({
    results: [
      result("champ-bob", "M"),
      result("champ-dog-2", "M"),
      result("champ-dog-3", "M"),
      result("champ-dog-4", "M"),
    ],
    awards: [award("BOB", "champ-bob")],
  });

  assert.equal(credit?.pointsAwarded, 3);
  assert.equal(credit?.isMajor, true);
}

{
  const [credit] = candidates({
    results: [result("solo-champion", "M")],
    awards: [award("BOB", "solo-champion")],
  });

  assert.equal(credit, undefined);
}

console.log("Grand Champion credit tests passed.");
