import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const careService = source("apps/web/server/services/emergencyVetCare.service.ts");
const studsPage = source("apps/web/app/studs/page.tsx");
const plannerPage = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const plannerClient = source("apps/web/components/breeding/BreedPageClient.tsx");
const breedingService = source("apps/web/server/services/breeding.service.ts");

const message =
  "This dog has pending veterinary care and cannot be used for breeding.";

assert.ok(
  careService.includes(`PENDING_VETERINARY_CARE_BREEDING_MESSAGE =\n  "${message}"`),
  "pending-care copy is shared with the canonical veterinary-care service"
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
