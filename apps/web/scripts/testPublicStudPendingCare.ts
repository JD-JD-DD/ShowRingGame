import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const careService = source("apps/web/server/services/emergencyVetCare.service.ts");
const breedingAvailability = source("apps/web/lib/breedingAvailability.ts");
const studsPage = source("apps/web/app/studs/page.tsx");
const plannerPage = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const plannerClient = source("apps/web/components/breeding/BreedPageClient.tsx");
const breedingService = source("apps/web/server/services/breeding.service.ts");

const message =
  "This dog has pending veterinary care and cannot be used for breeding.";

assert.ok(
  breedingAvailability.includes(`PENDING_VETERINARY_CARE_BREEDING_MESSAGE =\n  "${message}"`) &&
    careService.includes('export { PENDING_VETERINARY_CARE_BREEDING_MESSAGE } from "@/lib/breedingAvailability"'),
  "pending-care copy is shared through a client-safe module"
);
for (const [label, page] of [
  ["studs page", studsPage],
  ["breeding planner", plannerPage],
] as const) {
  assert.ok(
    page.includes("emergencyCareEvents: {") &&
      page.includes('where: { status: "PENDING" }') &&
      page.includes("reproductiveEmergencies: {") &&
      page.includes('["PENDING", "TREATMENT_AUTHORIZED"]'),
    `${label} loads pending-care relations in its existing stud query`
  );
  assert.ok(
    page.includes("hasPendingVeterinaryCareFromRecords"),
    `${label} uses the shared pending-care predicate`
  );
}
assert.ok(
  studsPage.includes("Review Availability"),
  "an active listing with pending care remains visible and can be reviewed"
);
assert.ok(
  studsPage.includes("PENDING_VETERINARY_CARE_BREEDING_MESSAGE"),
  "the studs page presents the specific pending-care reason"
);
assert.ok(
  studsPage.includes("Stud Terms"),
  "public stud cards present current listing requirements as Stud Terms"
);
assert.ok(
  studsPage.includes(
    "`/stud-contract?studListingId=${listing.id}&sireDogId=${dog.id}&source=public-stud`"
  ) &&
    studsPage.includes("Contract Terms"),
  "public stud cards link Contract Terms with the active listing and sire context only"
);
assert.ok(
  studsPage.includes("href={`/breed?studListingId=${listing.id}`}") &&
    studsPage.includes("Use At Stud"),
  "Use At Stud retains its current destination and label"
);
assert.ok(
  studsPage.includes("href={`/dogs/${dog.id}`}") && studsPage.includes("View Dog"),
  "View Dog retains its current destination and label"
);
assert.ok(
  plannerClient.includes("hasPendingVeterinaryCare"),
  "the planner carries temporary care state to client selection"
);
assert.ok(
  plannerClient.includes("disabled={Boolean(unavailable)}"),
  "temporarily unavailable studs cannot be selected"
);
assert.ok(
  plannerClient.includes("!sire.hasPendingVeterinaryCare"),
  "directly selected pending-care studs cannot be confirmed"
);
assert.ok(
  breedingService.includes("assertDogHasNoPendingVeterinaryCare(sire.id, tx)"),
  "final transactional enforcement remains in place"
);

console.log("Public stud pending-care regression checks passed.");
