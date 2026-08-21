import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const formatter = source("apps/web/lib/studOfferPresentation.ts");
const service = source("apps/web/server/services/studOffer.service.ts");
const publicStuds = source("apps/web/app/studs/page.tsx");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const cards = source("apps/web/components/breeding/BreedPageClient.tsx");

assert.ok(formatter.includes("formatCompactStudOfferSummary"));
assert.ok(formatter.includes("new Intl.NumberFormat"));
assert.ok(formatter.includes("Puppy Back"));
assert.ok(formatter.includes("Green only"));
assert.ok(formatter.includes("Green/Yellow"));
assert.ok(formatter.includes("Brucellosis negative"));
assert.ok(formatter.includes("Automatic Approval"));
assert.ok(formatter.includes("Manual Approval"));
assert.ok(formatter.includes("PHENOTYPE_HEALTH_TESTS"));
assert.equal(formatter.includes("HIP_DYSPLASIA"), false, "formatter does not hard-code health tests");

assert.ok(service.includes("getCurrentPublishedStudOffersForSires"));
assert.ok(service.includes('status: "PUBLISHED"'));
assert.ok(publicStuds.includes("getCurrentPublishedStudOffersForSires(dogIds)"));
assert.ok(planner.includes("getCurrentPublishedStudOffersForSires("));
assert.ok(publicStuds.includes("Stud contract terms not yet published."));
assert.ok(cards.includes("Stud contract terms not yet published."));
assert.ok(cards.includes("Contract Compensation"));
assert.ok(cards.includes("Puppy Terms"));
assert.ok(cards.includes("Dam Requirements"));
assert.ok(cards.includes("Stud Fee"));

for (const forbidden of ["StudOffer.create", "StudContract.create", "DogListing.create", "fetch("]) {
  assert.equal(formatter.includes(forbidden), false, `formatter excludes ${forbidden}`);
}

console.log("Stud contract presentation checks passed.");
