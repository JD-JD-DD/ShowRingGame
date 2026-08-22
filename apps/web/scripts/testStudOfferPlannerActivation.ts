import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const client = source("apps/web/components/breeding/BreedPageClient.tsx");

assert.ok(planner.includes("resolvePublicStudInventory"));
assert.equal(planner.includes("adaptLegacyPublicStudListing"), false);
assert.equal(planner.includes("getCurrentPublishedStudOffersForSires"), false);
assert.ok(planner.includes('publicStud.source === "STUD_OFFER"'));
assert.ok(planner.includes('publicStud.source === "LEGACY_PLAYER_STUD"'));
assert.ok(client.includes("publicStudContractHref"));
assert.ok(client.includes('selectedSire.publicStudSource === "STUD_OFFER"'));
assert.ok(client.includes('sire.publicStudSource === "LEGACY_PLAYER_STUD" && sire.studListingId'));
assert.ok(client.includes('stud.publicStudSource === "STUD_OFFER" && stud.studOfferSummary'));
assert.equal(client.includes("selectedSire.studOfferId as"), false);

console.log("StudOffer planner activation checks passed.");
