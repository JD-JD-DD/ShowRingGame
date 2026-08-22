import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const resolver = source("apps/web/server/services/publicStud.service.ts");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const client = source("apps/web/components/breeding/BreedPageClient.tsx");
const studsPage = source("apps/web/app/studs/page.tsx");

assert.ok(resolver.includes('status: "PUBLISHED"'));
assert.ok(resolver.includes("resolvePublicStudInventory"));
assert.equal(resolver.includes("LEGACY_PLAYER_STUD"), false);
assert.equal(resolver.includes("DogListing"), false);

const publicStudQueryStart = planner.indexOf(
  "const loadPublicStudListings = async () =>"
);
const publicStudQueryEnd = planner.indexOf(
  "const [dogs, publicStudListings, kennelRuns]",
  publicStudQueryStart
);
assert.ok(publicStudQueryStart >= 0);
assert.ok(publicStudQueryEnd > publicStudQueryStart);
const publicStudQuery = planner.slice(publicStudQueryStart, publicStudQueryEnd);

assert.ok(publicStudQuery.includes("resolvePublicStudInventory"));
assert.ok(publicStudQuery.includes("breedCode2: publicStudBreedCode2"));
assert.ok(publicStudQuery.includes("take: 200"));
assert.equal(publicStudQuery.includes("studListingId"), false);
assert.equal(publicStudQuery.includes("PLAYER_STUD"), false);
assert.ok(publicStudQuery.includes('reason: "breed_context_required"'));

assert.ok(client.includes("publicStudContractHref"));
assert.ok(client.includes('sireDogId: sire.id'));
assert.ok(client.includes("damDogId"));
assert.equal(client.includes("studListingId"), false);
assert.equal(client.includes("LEGACY_PLAYER_STUD"), false);

assert.ok(studsPage.includes('studOffersAsSire: { some: { status: "PUBLISHED" } }'));
assert.ok(studsPage.includes("Review Stud Contract"));
assert.equal(studsPage.includes("PLAYER_STUD"), false);
assert.equal(studsPage.includes("legacyListingId"), false);

console.log("StudOffer-only public discovery regression checks passed.");
