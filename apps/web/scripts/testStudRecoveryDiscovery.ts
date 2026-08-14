import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const plannerPage = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
assert.ok(
  plannerPage.includes('operation: "latest_sire_attempt_query"') &&
    plannerPage.includes("where: { sireId: { in: plannerDogIds } }") &&
    plannerPage.includes("latestSireAttemptCreatedEpoch"),
  "breeding planner batch-loads latest sire attempts and delegates recovery to shared eligibility"
);
assert.ok(
  plannerPage.includes("else if (!requestedStud.isEligibleToBreed)"),
  "direct public-stud routes surface an ineligible stud instead of treating its ACTIVE listing as selectable"
);

const plannerClient = source("apps/web/components/breeding/BreedPageClient.tsx");
assert.ok(
  plannerClient.includes(
    "dog.studListingId === initialStudListingId && dog.isEligibleToBreed"
  ),
  "recovering direct-route public studs cannot become the initial planner selection"
);

const publicStudsPage = source("apps/web/app/studs/page.tsx");
assert.ok(
  publicStudsPage.includes("const latestSireAttempts = dogIds.length") &&
    publicStudsPage.includes("where: { sireId: { in: dogIds } }") &&
    publicStudsPage.includes("latestSireAttemptCreatedEpoch"),
  "public stud discovery batch-loads sire recovery inputs"
);
assert.ok(
  publicStudsPage.includes("Availability") &&
    publicStudsPage.includes('"Recovery"') &&
    publicStudsPage.includes("Stud in Recovery") &&
    publicStudsPage.includes("aria-disabled=\"true\""),
  "recovering public studs remain visible with accessible recovery availability"
);
assert.ok(
  !publicStudsPage.includes('data: { status: "CANCELLED" }'),
  "stud discovery does not mutate an ACTIVE listing for recovery"
);

const programPlanner = source("apps/web/server/services/programPlanner.service.ts");
assert.ok(
  programPlanner.includes("const [healthConditionTruthsByDogId, latestSireAttempts]") &&
    programPlanner.includes("latestSireAttemptCreatedEpoch") &&
    programPlanner.includes('? "Recovery"'),
  "Program Planner uses the shared eligibility input for stud recovery"
);

console.log("Stud recovery discovery checks passed.");
