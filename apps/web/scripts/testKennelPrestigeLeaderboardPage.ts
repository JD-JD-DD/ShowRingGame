import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { dateToEpoch, epochToDate } from "../lib/gameClock";
import { formatShowCalendarLabel } from "../lib/showCalendarLabels";

const pageSource = readFileSync(
  resolve(process.cwd(), "app/kennels/top-ten/page.tsx"),
  "utf8"
);

assert.equal(
  dateToEpoch(epochToDate(12_345)),
  12_345,
  "operational timestamps convert through the canonical game clock"
);
assert.equal(
  formatShowCalendarLabel(0),
  "Monday — Week 1, Year 1",
  "persisted game epochs use the established show-calendar formatter"
);
assert.match(pageSource, /getCurrentKennelPrestigeLeaderboardState\(\)/);
assert.match(
  pageSource,
  /listCurrentKennelPrestigeLeaderboardEntries\(\{ scope: "OVERALL" \}\)/
);
assert.match(pageSource, /publishedSnapshotReadMs/);
assert.match(pageSource, /breedPublishedSnapshotReadMs/);
assert.match(pageSource, /getReleasedBreedsGroupedByCanonicalShowGroup/);
assert.match(pageSource, /getCurrentPublishedBreedKennelPrestigeLeaderboardState/);
assert.match(pageSource, /listCurrentPublishedBreedKennelPrestigeLeaderboardEntries\(\{ breedCode2: selectedBreed\.code2 \}\)/);
assert.match(pageSource, /publishedSnapshotExists/);
assert.doesNotMatch(
  pageSource,
  /getKennelPrestigeLeaderboard|buildKennelPrestigeSummaries|showAward|championDogsAndHealthTestsMs/
);
assert.doesNotMatch(pageSource, /temporarily unavailable/);
assert.match(pageSource, /<form action="\/kennels\/top-ten" method="get"/);
assert.match(pageSource, /dateToEpoch\(breedState\.publishedAt\)/);
assert.match(pageSource, /dateToEpoch\(breedState\.nextRefreshAt\)/);
assert.match(pageSource, /Next update: Pending/);
assert.match(pageSource, /Rankings are being prepared\. Please check back after the next update\./);
assert.match(pageSource, /No kennel prestige has been earned here yet\./);
assert.match(pageSource, /refreshClaimToken \? <div>Updating rankings in the background\.<\/div>/);
assert.match(pageSource, /href=\{`\/kennels\/\$\{row\.kennelSlug\}`\}/);
assert.match(pageSource, /key=\{row\.kennelId\}/);
assert.match(pageSource, /#\{row\.rank\}/);
assert.match(pageSource, /row\.prestigeScore\.toLocaleString\(\)/);
assert.match(pageSource, /row\.tierLabel/);
assert.match(pageSource, /row\.championsBred} bred CH/);
assert.match(pageSource, /row\.bestInShowWins} BIS/);

console.log("Kennel prestige leaderboard page checks passed.");
