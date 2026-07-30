import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const closureSource = source("server/services/accountClosure.service.ts");
const resultsIndexSource = source("app/shows/[showId]/results/page.tsx");
const breedResultsSource = source("app/shows/[showId]/results/[breedCode2]/page.tsx");
const showHistorySource = source("app/shows/history/page.tsx");
const invitationalsSource = source("app/shows/invitationals/page.tsx");

assert.match(closureSource, /const replacementName = "Closed Kennel"/);
assert.match(closureSource, /const replacementSlug = `closed-kennel-\$\{kennel\.id\}`/);
assert.match(closureSource, /action: "KENNEL_IDENTITY_MASKED"/);
assert.match(closureSource, /originalKennelName: kennel\.name/);
assert.match(closureSource, /originalKennelSlug: kennel\.slug/);
assert.match(closureSource, /if \(!alreadyMasked\)/);
assert.match(closureSource, /ownerKennelId: kennel\.id/);
assert.match(closureSource, /lifecycleState: "RETIRED"/);
assert.match(closureSource, /action: "CLOSED_KENNEL_DOGS_RETIRED"/);
assert.match(closureSource, /entryStatus: "INELIGIBLE"/);
assert.match(resultsIndexSource, /entry\.kennel\.moderationStatus === "CLOSED"/);
assert.match(breedResultsSource, /entry\.kennel\.moderationStatus === "CLOSED"/);
assert.match(showHistorySource, /winner\.showEntry\.kennel\.moderationStatus === "CLOSED"/);
assert.match(invitationalsSource, /winner\.showEntry\.kennel\.moderationStatus === "CLOSED"/);

console.log("Closed kennel masking checks passed.");
