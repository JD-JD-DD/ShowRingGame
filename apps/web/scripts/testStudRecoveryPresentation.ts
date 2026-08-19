import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import { MIN_BREED_AGE_HOURS } from "@showring/rules";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "../server/services/breedingEligibility.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const latestSireAttemptCreatedEpoch = 500;
const adultBirthEpoch = latestSireAttemptCreatedEpoch - MIN_BREED_AGE_HOURS - 12;

const recoveringMale = getIndividualBreedingEligibility({
  currentEpoch: 501,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "M",
  latestSireAttemptCreatedEpoch,
});
assert.equal(recoveringMale.isEligible, false, "recovering male cannot breed");
assert.equal(recoveringMale.reasonCode, "STUD_RECOVERY", "recovering male has canonical reason");
assert.equal(
  getBreedingEligibilityMessage(recoveringMale),
  "Stud recovery. May breed again in 1 hour.",
  "recovering male exposes the canonical explanation"
);

const availableMale = getIndividualBreedingEligibility({
  currentEpoch: 502,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "M",
  latestSireAttemptCreatedEpoch,
});
assert.equal(availableMale.isEligible, true, "male becomes available at the exact boundary");

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const dogService = source("apps/web/server/services/dog.service.ts");
const breedingEligibilityService = source(
  "apps/web/server/services/breedingEligibility.service.ts"
);
const publicStudsPage = source("apps/web/app/studs/page.tsx");
assert.ok(
  dogService.includes("buildReproductiveSnapshotStatus") &&
    dogService.includes('label: "Recovery"') &&
    dogService.includes('label: "Available"') &&
    dogService.includes("dog.breedingAttemptsAsSire[0]?.createdEpoch"),
  "Dog Profile derives male status from its latest loaded sire attempt"
);
assert.ok(
  dogService.includes("dog.sex === Sex.M &&\n        dog.isBreedingActive &&\n        breedingEligible &&"),
  "Dog Profile requires breeding participation and blocks use of an active stud listing while recovery makes breeding ineligible"
);
assert.equal(
  breedingEligibilityService.includes("isBreedingActive"),
  false,
  "Stud Recovery remains independent of owner breeding participation"
);
assert.match(
  publicStudsPage,
  /!dog\.isBreedingActive\s*\?\s*"Breeding Inactive"\s*:\s*breedingEligibility\.isEligible\s*\?\s*"Available"\s*:\s*"Recovery"/,
  "an inactive recovering stud presents Breeding Inactive before its unchanged recovery state"
);

const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
assert.ok(
  mineRoute.includes("latestSireAttempts,") &&
    mineRoute.includes("where: { sireId: { in: dogIds } }") &&
    mineRoute.includes('? "Recovery"') &&
    mineRoute.includes('? "Available"'),
  "My Kennel batch-loads sire use and returns canonical male availability"
);

const kennelPanel = source("apps/web/components/kennel/KennelDogsPanel.tsx");
assert.ok(
  kennelPanel.includes("dog.breedingCardStatus.detail") &&
    kennelPanel.includes('label === "Available"'),
  "My Kennel renders the recovery explanation and available state"
);

const actionWindows = source("apps/web/lib/dogActionWindows.ts");
assert.ok(
  actionWindows.includes("breedingUnavailableReason") &&
    actionWindows.includes("value: input.breedingUnavailableReason"),
  "action windows use the canonical disabled breeding reason without recalculating recovery"
);

console.log("Stud recovery presentation checks passed.");
