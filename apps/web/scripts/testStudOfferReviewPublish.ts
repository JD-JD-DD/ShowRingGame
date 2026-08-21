import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(repoRoot, path), "utf8");
const worksheet = source("apps/web/components/stud-contract/StudOfferWorksheet.tsx");
const service = source("apps/web/server/services/studOffer.service.ts");
const route = source("apps/web/app/api/dogs/[dogId]/stud-offer/route.ts");

assert.ok(worksheet.includes('currentStep.id === "review"'));
assert.ok(worksheet.includes("Review Stud Offer"));
assert.ok(worksheet.includes("sireIdentity.breedName"));
assert.ok(worksheet.includes("currencyFormatter.format"));
assert.ok(worksheet.includes("Minimum qualifying litter"));
assert.ok(worksheet.includes("No-litter return service"));
assert.ok(worksheet.includes("Small-litter return service"));
assert.ok(worksheet.includes("Brucellosis"));
assert.ok(worksheet.includes("Health Tests"));
assert.ok(worksheet.includes("Title requirement"));
assert.ok(worksheet.includes("24 real hours"));
assert.ok(worksheet.includes("validateStudOfferTerms(terms)"));
assert.ok(worksheet.includes("const canPublish"));
assert.ok(worksheet.includes("Publish Stud Offer"));
assert.ok(worksheet.includes("isPublishing"));
assert.ok(worksheet.includes("Stud Offer published."));
assert.ok(worksheet.includes("fetch(`/api/dogs/${sireIdentity.dogId}/stud-offer`"));

assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("getKennelForUser"));
assert.ok(route.includes("publishStudOffer"));
assert.ok(route.includes("ownerKennelId: kennel.id"), "route supplies server-resolved ownership");

for (const fragment of [
  "FOR UPDATE",
  "validateStudOfferTerms(args.terms)",
  "getRequiredHealthTestsForBreed",
  "validateStudOfferDamRequirementsStep",
  "status: \"PUBLISHED\"",
  "latestOffer?.version ?? 0",
  "healthRequirements: {",
  "ALREADY_PUBLISHED",
]) {
  assert.ok(service.includes(fragment), `publication service includes ${fragment}`);
}
for (const forbidden of ["StudContract.create", "breedingAttempt", "ledger", "DogListing.create"]) {
  assert.equal(service.includes(forbidden), false, `service does not include ${forbidden}`);
}

console.log("Stud offer Review & Publish checks passed.");
