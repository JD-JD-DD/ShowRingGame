import { strict as assert } from "node:assert";

import {
  getGrandChampionCompletionPrestigeForHandling,
  getGrandChampionMilestonePrestige,
  isGrandChampionPrestigeComplete,
} from "@/server/services/kennelPrestige.service";

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "CH",
    grandPoints: 25,
    grandMajorCount: 3,
    grandChampionDefeatShowCount: 3,
  }),
  false,
  "CH dogs with GCH totals are not complete GCH prestige dogs until promoted"
);

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "GCH",
    grandPoints: 25,
    grandMajorCount: 3,
    grandChampionDefeatShowCount: 3,
  }),
  true,
  "base GCH completion qualifies for GCH prestige"
);

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "GCH",
    grandPoints: 25,
    grandMajorCount: 2,
    grandChampionDefeatShowCount: 3,
  }),
  false,
  "base GCH prestige requires the GCH major requirement"
);

assert.equal(getGrandChampionCompletionPrestigeForHandling(false), 45);
assert.equal(getGrandChampionCompletionPrestigeForHandling(true), 30);
assert.equal(getGrandChampionCompletionPrestigeForHandling(null), 30);
assert.equal(getGrandChampionCompletionPrestigeForHandling(undefined), 30);

assert.deepEqual(getGrandChampionMilestonePrestige(99), {
  milestoneCount: 0,
  prestige: 0,
});
assert.deepEqual(getGrandChampionMilestonePrestige(100), {
  milestoneCount: 1,
  prestige: 20,
});
assert.deepEqual(getGrandChampionMilestonePrestige(800), {
  milestoneCount: 4,
  prestige: 140,
});
assert.deepEqual(getGrandChampionMilestonePrestige(4000), {
  milestoneCount: 8,
  prestige: 240,
});

console.log("Kennel prestige tests passed.");
