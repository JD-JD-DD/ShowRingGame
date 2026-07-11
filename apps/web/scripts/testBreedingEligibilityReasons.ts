import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";

import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "../server/services/breedingEligibility.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const currentEpoch = 10_000;
const adultBirthEpoch = currentEpoch - MIN_BREED_AGE_HOURS - 12;
const lastWhelpedEpoch = currentEpoch - WHELPING_COOLDOWN_HOURS + 5;
const cooldownEligibleAtEpoch = lastWhelpedEpoch + WHELPING_COOLDOWN_HOURS;

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const coolingDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  lastWhelpedEpoch,
});

assert.equal(coolingDam.eligible, false, "cooldown result returns eligible false");
assert.equal(
  coolingDam.reasonCode,
  "POST_WHELP_COOLDOWN",
  "cooldown result uses POST_WHELP_COOLDOWN"
);
assert.equal(
  coolingDam.eligibleAtEpoch,
  cooldownEligibleAtEpoch,
  "cooldown result exposes the canonical eligibleAtEpoch"
);
assert.equal(
  coolingDam.remainingHours,
  cooldownEligibleAtEpoch - currentEpoch,
  "cooldown result exposes the canonical positive remainingHours"
);
assert.equal(
  getBreedingEligibilityMessage(coolingDam),
  "This bitch is resting after a litter. Available to breed in 5 days.",
  "cooldown message uses the shared duration wording"
);

const cooldownBoundary = getIndividualBreedingEligibility({
  currentEpoch: cooldownEligibleAtEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  lastWhelpedEpoch,
});

assert.equal(cooldownBoundary.eligible, true, "cooldown boundary becomes eligible");
assert.equal(
  cooldownBoundary.reasonCode,
  "ELIGIBLE",
  "cooldown reason clears at the exact boundary"
);
assert.equal(
  cooldownBoundary.remainingHours,
  0,
  "cooldown boundary exposes zero remaining time"
);

const initiatedDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "INITIATED",
});

assert.equal(
  initiatedDam.reasonCode,
  "PENDING_PREGNANCY_CONFIRMATION",
  "INITIATED returns the pending confirmation reason"
);

const pregnantDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "PREGNANT",
});

assert.equal(
  pregnantDam.reasonCode,
  "PREGNANT",
  "PREGNANT returns the pregnancy reason"
);

const underageDog = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: currentEpoch - MIN_BREED_AGE_HOURS + 1,
  lifecycleState: "ALIVE",
  sex: "F",
});

assert.equal(
  underageDog.reasonCode,
  "UNDER_MINIMUM_AGE",
  "underage dogs return the underage reason"
);

const overageDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: currentEpoch - DAM_MAX_BREED_AGE_HOURS - 1,
  lifecycleState: "ALIVE",
  sex: "F",
});

assert.equal(
  overageDam.reasonCode,
  "OVER_MAXIMUM_DAM_AGE",
  "overage dams return the over-max-dam-age reason"
);

const overageStud = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: currentEpoch - DAM_MAX_BREED_AGE_HOURS - 1,
  lifecycleState: "ALIVE",
  sex: "M",
});

assert.notEqual(
  overageStud.reasonCode,
  "OVER_MAXIMUM_DAM_AGE",
  "studs do not receive the max-dam-age reason"
);

assert.ok(
  source("apps/web/server/services/dog.service.ts").includes(
    "breedingEligibilityMessage"
  ) &&
    source("apps/web/app/dogs/[dogId]/page.tsx").includes(
      "actions.breedingDisabledReason"
    ),
  "Dog Page consumes the shared breeding reason data"
);

const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
assert.ok(
  mineRoute.includes('label: "Post-Whelp Rest"') &&
    mineRoute.includes("cooldownInHours: breedingEligibility.remainingHours"),
  "kennel snapshot consumes the shared cooldown countdown"
);

const breedingPlannerPage = source(
  "apps/web/components/breeding/BreedingPlannerPage.tsx"
);
const breedingPlannerClient = source(
  "apps/web/components/breeding/BreedPageClient.tsx"
);
assert.ok(
  breedingPlannerPage.includes("breedingEligibilityMessage") &&
    breedingPlannerClient.includes("dog.breedingEligibilityMessage"),
  "breeding planner passes through the specific reason"
);

console.log("Breeding eligibility reason checks passed.");
