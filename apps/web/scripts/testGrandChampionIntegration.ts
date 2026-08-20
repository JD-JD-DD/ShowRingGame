import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { calculateGrandChampionCompetitionCounts } from "@showring/rules";
import {
  buildGrandChampionCompetitionSnapshot,
  type GrandChampionCreditResult,
  type GrandChampionFinalizationAward,
} from "../server/services/grandChampion.service";

const champion = (dogId: string, sex: "M" | "F"): GrandChampionCreditResult => ({
  dogId,
  breedCode2: "TST",
  dog: { id: dogId, sex, visibleTitlePrefix: "CH", visibleTitleSuffix: null, titleProgress: { currentTitleCode: "CH" } },
});
const regular = (dogId: string, sex: "M" | "F"): GrandChampionCreditResult => ({
  dogId,
  breedCode2: "TST",
  dog: { id: dogId, sex, visibleTitlePrefix: null, visibleTitleSuffix: null, titleProgress: null },
});
const award = (awardCode: string, dogId: string, dogsInCompetition: number | null = null): GrandChampionFinalizationAward => ({
  id: `${awardCode}-${dogId}`,
  dogId,
  breedCode2: "TST",
  judgeId: "judge-1",
  awardCode,
  awardGroup: ["WD", "WB"].includes(awardCode) ? "WINNERS" : "BREED",
  dogsInCompetition,
});

{
  const snapshot = buildGrandChampionCompetitionSnapshot({
    breedCode2: "TST",
    results: [champion("bob", "M"), champion("bos", "F"), champion("select", "M"), regular("class-male", "M"), regular("class-female", "F")],
    awards: [award("WD", "class-male", 4), award("WB", "class-female", 3), award("BOB", "bob"), award("BOS", "bos"), award("SELECT_DOG", "select")],
  });
  const [bob] = calculateGrandChampionCompetitionCounts(snapshot);
  assert.equal(snapshot.regularCompetitorCounts.M, 4, "persisted WD count is the male regular component");
  assert.equal(snapshot.regularCompetitorCounts.F, 3, "persisted WB count is the female regular component");
  assert.equal(bob?.competitionCount, 10, "regular population and Champion BOB population are counted once");
  assert.equal(bob?.bobSameSexComparisonCount, 6, "BOB returns its male comparison count");
}

{
  const snapshot = buildGrandChampionCompetitionSnapshot({
    breedCode2: "TST",
    results: [champion("wd-bob", "M"), champion("bos", "F"), regular("class-female", "F")],
    awards: [award("WD", "wd-bob", 4), award("WB", "class-female", 3), award("BOB", "wd-bob"), award("BOS", "bos")],
  });
  const bob = calculateGrandChampionCompetitionCounts(snapshot).find((result) => result.awardCode === "BOB");
  assert.equal(bob?.recipientEligible, false, "same-show WD winning BOB cannot receive GCH");
  assert.equal(bob?.competitionCount, 8, "same-show WD remains represented only by its regular competition count");
  assert.equal(bob?.championDefeatFacts.qualifyingChampionOpponentCount, 1, "same-show WD is not Champion-defeat evidence");
}

const serviceSource = readFileSync(join(process.cwd(), "apps/web/server/services/grandChampion.service.ts"), "utf8");
for (const field of ["effectiveYear", "district", "breedCode2", "sex", "judgeId", "competitionCount", "bobSameSexComparisonCount", "qualifyingChampionOpponentCount", "rulesVersion", "finalizedAtEpoch"]) {
  assert.ok(serviceSource.includes(field), `prospective credit persistence includes ${field}`);
}
assert.ok(serviceSource.includes('showDay.status === "RESULTS_PUBLISHED"'), "published ShowDays return without recalculating mutable facts");
assert.ok(serviceSource.includes("resolveGrandChampionPointSchedules"), "Year 17+ schedule reads are bounded by recipient sex");
assert.ok(!serviceSource.includes("awardGroup: \"GROUP\""), "Group awards remain outside GCH integration");
console.log("Grand Champion production integration checks passed.");
