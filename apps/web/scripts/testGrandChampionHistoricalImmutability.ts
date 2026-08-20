import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "apps/web/server/services/grandChampion.service.ts"),
  "utf8"
);
const titleSource = readFileSync(
  join(process.cwd(), "apps/web/server/services/titleProgress.service.ts"),
  "utf8"
);

const publishedGuard = source.indexOf('if (showDay.status === "RESULTS_PUBLISHED")');
const mutableResultsRead = source.indexOf("args.client.showResult.findMany");
const mutableAwardsRead = source.indexOf("args.client.showAward.findMany");
const candidatePreparation = source.indexOf("const candidates:");
const scheduleResolution = source.indexOf("await resolveGrandChampionPointSchedules");
const creditWrite = source.indexOf("args.client.dogGrandChampionCredit.upsert");

assert.ok(publishedGuard >= 0, "published ShowDays have an explicit immutable-history guard");
assert.ok(publishedGuard < mutableResultsRead, "published guard runs before mutable result population is loaded");
assert.ok(publishedGuard < mutableAwardsRead, "published guard runs before mutable award population is loaded");
assert.ok(source.slice(publishedGuard, mutableResultsRead).includes("dogGrandChampionCredit.findMany"), "published reruns return existing durable credit facts");
assert.ok(candidatePreparation < scheduleResolution && scheduleResolution < creditWrite, "all schedule-dependent candidates are prepared before any GCH credit write");
assert.ok(source.includes('usesDynamicGrandChampionPointSchedule(showDay.cluster.year)'), "only Year 17+ resolves published schedules");
assert.ok(source.includes("calculateLegacyGrandChampionPointsFromCompetition"), "Year 16 and earlier retain isolated legacy conversion");
assert.ok(!source.includes('awardGroup: "GROUP"') && !source.includes('awardGroup: "BIS"'), "Group/BIS awards remain outside GCH credit loading");
assert.ok(!source.includes("dogGrandChampionCredit.deleteMany"), "GCH processing does not delete historical credits");
assert.ok(!source.includes("updateMany({"), "GCH processing does not add a historical bulk-rewrite route");
assert.ok(titleSource.includes("credit.judgeId ?? credit.showAward?.judgeId ?? null"), "legacy title qualification reads immutable source-award judge identity without backfill");
assert.ok(titleSource.includes("qualifyingChampionOpponentCount !== null && !credit.judgeId"), "corrected credit missing judgeId is a data-integrity error");

console.log("Grand Champion completed-history regression checks passed.");
