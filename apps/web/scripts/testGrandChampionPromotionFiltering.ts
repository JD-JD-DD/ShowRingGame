import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateGrandChampionQualification } from "@showring/rules";
import { getGrandChampionPromotionDecision } from "../server/services/titleProgress.service";

function qualification(points: number, alreadyGrandChampion = false) {
  return evaluateGrandChampionQualification({
    alreadyGrandChampion,
    credits: [
      { id: "1", showDayId: "1", pointsAwarded: points, isMajor: true, judgeId: "a", countsAsChampionDefeat: true, qualifyingChampionOpponentCount: 1 },
      { id: "2", showDayId: "2", pointsAwarded: 3, isMajor: true, judgeId: "b", countsAsChampionDefeat: true, qualifyingChampionOpponentCount: 1 },
      { id: "3", showDayId: "3", pointsAwarded: 3, isMajor: true, judgeId: "c", countsAsChampionDefeat: true, qualifyingChampionOpponentCount: 1 },
      { id: "4", showDayId: "4", pointsAwarded: 1, isMajor: false, judgeId: "d", countsAsChampionDefeat: false, qualifyingChampionOpponentCount: 0 },
    ],
  });
}

function decision(args: {
  currentTitleCode: string | null;
  visibleTitlePrefix?: string | null;
  points?: number;
}) {
  return getGrandChampionPromotionDecision({
    visibleTitlePrefix: args.visibleTitlePrefix ?? args.currentTitleCode,
    progress: {
      championshipPoints: 15,
      majorCount: 2,
      grandPoints: 0,
      grandMajorCount: 0,
      grandChampionDefeatShowCount: 0,
      grandCompletedAtShowDayId: null,
      grandCompletedAtEpoch: null,
      currentTitleCode: args.currentTitleCode,
    },
    qualification: qualification(args.points ?? 18, args.currentTitleCode?.startsWith("GCH") ?? false),
    showDayId: "current-show-day",
    currentEpoch: 123,
  });
}

assert.equal(decision({ currentTitleCode: "CH", points: 17 })?.requiresAtomicReconciliation, false);
assert.equal(decision({ currentTitleCode: "GCH", points: 18 })?.requiresAtomicReconciliation, false);

const firstGch = decision({ currentTitleCode: "CH", points: 18 });
assert.equal(firstGch?.nextTitleCode, "GCH");
assert.equal(firstGch?.requiresAtomicReconciliation, true);
assert.deepEqual(firstGch?.completionFields, {
  grandCompletedAtShowDayId: "current-show-day",
  grandCompletedAtEpoch: 123,
});

assert.equal(decision({ currentTitleCode: "GCH", points: 93 })?.nextTitleCode, "GCHB");
assert.equal(decision({ currentTitleCode: "GCH", points: 193 })?.nextTitleCode, "GCHS");
assert.equal(decision({ currentTitleCode: "GCH", points: 393 })?.nextTitleCode, "GCHG");
assert.equal(decision({ currentTitleCode: "GCH", points: 793 })?.nextTitleCode, "GCHP");
assert.equal(decision({ currentTitleCode: "GCH", points: 3993 })?.nextTitleCode, "GCHP5");
assert.equal(decision({ currentTitleCode: "GCH", points: 393 })?.requiresAtomicReconciliation, true);

const grandChampionSource = readFileSync(
  join(process.cwd(), "apps/web/server/services/grandChampion.service.ts"),
  "utf8"
);
const judgingSource = readFileSync(
  join(process.cwd(), "apps/web/server/services/judging.service.ts"),
  "utf8"
);

assert.match(grandChampionSource, /getGrandChampionPromotionDecision/);
assert.match(grandChampionSource, /const promotionCandidates: Array<\{/);
assert.match(grandChampionSource, /if \(decision\?\.requiresAtomicReconciliation\) \{\s*promotionCandidates\.push\(\{ dogId, qualification \}\)/);
assert.match(judgingSource, /for \(const promotionCandidate of grandChampionCredits\.promotionCandidates\)/);
assert.match(judgingSource, /qualification: promotionCandidate\.qualification/);
assert.doesNotMatch(judgingSource, /for \(const dogId of \[\.\.\.new Set\(grandChampionCredits\.dogIds\)\]\)/);
assert.match(
  readFileSync(join(process.cwd(), "apps/web/server/services/titleProgress.service.ts"), "utf8"),
  /const qualification = args\.qualification \?\? await/
);

console.log("Grand Champion promotion filtering regression checks passed.");
