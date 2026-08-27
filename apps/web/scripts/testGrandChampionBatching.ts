import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(process.cwd(), "apps/web/server/services/grandChampion.service.ts"),
  "utf8"
);

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing ${start}`);
  return source.slice(startIndex, endIndex);
}

const reconciliation = section(
  "async function recalculateGrandChampionProgressForDogs",
  "async function processGrandChampionCreditsForShowDayWithClient"
);
const processing = section(
  "async function processGrandChampionCreditsForShowDayWithClient",
  "export async function processGrandChampionCreditsForShowDay"
);

// Candidate calculation and award eligibility remain in the established path.
assert.match(processing, /calculateGrandChampionCompetitionCounts/);
assert.match(processing, /calculateGrandChampionPointsFromCompetition/);
assert.match(processing, /calculateLegacyGrandChampionPointsFromCompetition/);
assert.match(processing, /GRAND_CHAMPION_CREDIT_RULES_VERSION/);

// Reads are bounded: all affected credit histories and title progress rows are
// loaded by dogId IN (...) rather than one history/progress read per dog.
assert.match(reconciliation, /dogGrandChampionCredit\.findMany\(\{\s*where: \{ dogId: \{ in: dogIds \} \}/);
assert.match(reconciliation, /dogTitleProgress\.findMany\(\{\s*where: \{ dogId: \{ in: dogIds \} \}/);
assert.doesNotMatch(reconciliation, /for \(const dogId of dogIds\) \{\s*const credits = await/);
assert.match(reconciliation, /creditsByDogId/);
assert.match(reconciliation, /createMany\(\{\s*data: progressCreates,\s*skipDuplicates: true,/);
assert.match(reconciliation, /runBounded\(progressUpdates/);

// New credits take one canonical bulk insert; existing rows still use their
// original unique-key upsert correction path for retry parity.
assert.match(processing, /dogGrandChampionCredit\.createMany/);
assert.match(processing, /skipDuplicates: true/);
assert.match(processing, /dogId_showDayId_awardCode/);
assert.match(processing, /dogGrandChampionCredit\.upsert/);

console.log("Grand Champion batching regression checks passed.");
