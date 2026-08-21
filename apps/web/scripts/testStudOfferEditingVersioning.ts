import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const page = source("apps/web/app/dogs/[dogId]/stud-contract/page.tsx");
const worksheet = source("apps/web/components/stud-contract/StudOfferWorksheet.tsx");
const service = source("apps/web/server/services/studOffer.service.ts");
const rules = source("packages/rules/src/studContractTerms.ts");
const route = source("apps/web/app/api/dogs/[dogId]/stud-offer/route.ts");

assert.ok(page.includes("getCurrentPublishedStudOfferForOwnedDog"));
assert.ok(page.includes("initialOffer={"));
assert.ok(page.includes("healthRequirements: currentOffer.healthRequirements.map"));
assert.ok(worksheet.includes("termsForCurrentHealthTests"));
assert.ok(worksheet.includes("noLitterReturnServiceAnswered: Boolean(initialOffer)"));
assert.ok(worksheet.includes("brucellosisNegativeRequiredAnswered: Boolean(initialOffer)"));
assert.ok(worksheet.includes("Editing Stud Offer"));
assert.ok(worksheet.includes("Publish Updated Terms"));
assert.ok(worksheet.includes("No changes to publish."));
assert.ok(worksheet.includes("baseVersion: initialOffer?.version ?? null"));
assert.ok(worksheet.includes("areStudOfferTermsEqual(terms, loadedTerms)"));

for (const fragment of [
  "getCurrentPublishedStudOfferForOwnedDog",
  "FOR UPDATE",
  "STALE_EDIT",
  "NO_CHANGES",
  "publishedOffer.version !== args.baseVersion",
  'data: { status: "RETIRED" }',
  'status: "PUBLISHED"',
  "healthRequirements: {",
]) assert.ok(service.includes(fragment), `service includes ${fragment}`);
assert.ok(route.includes("baseVersion"));
assert.ok(rules.includes("areStudOfferTermsEqual"));
for (const forbidden of ["StudContract.create", "DogListing.create", "breedingAttempt", "ledger"]) {
  assert.equal(service.includes(forbidden), false, `service excludes ${forbidden}`);
}

console.log("Stud offer editing/versioning checks passed.");
