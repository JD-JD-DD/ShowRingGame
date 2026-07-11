import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";

import { getIndividualBreedingEligibility } from "../server/services/breedingEligibility.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const currentEpoch = 10_000;
const adultBirthEpoch = currentEpoch - MIN_BREED_AGE_HOURS - 12;
const maxAgeDamBirthEpoch = currentEpoch - DAM_MAX_BREED_AGE_HOURS;
const overMaxAgeDamBirthEpoch = currentEpoch - DAM_MAX_BREED_AGE_HOURS - 1;
const lastWhelpedEpoch = currentEpoch - WHELPING_COOLDOWN_HOURS + 1;
const cooldownBoundaryEpoch = lastWhelpedEpoch + WHELPING_COOLDOWN_HOURS;

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

assert.equal(
  coolingDam.isEligible,
  false,
  "dam inside post-whelp cooldown is breeding ineligible"
);
assert.equal(
  coolingDam.isInPostWhelpCooldown,
  true,
  "dam inside post-whelp cooldown reports cooldown state"
);

const boundaryDam = getIndividualBreedingEligibility({
  currentEpoch: cooldownBoundaryEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  lastWhelpedEpoch,
});

assert.equal(
  boundaryDam.isEligible,
  true,
  "dam becomes eligible at the exact cooldown boundary"
);
assert.equal(
  boundaryDam.isInPostWhelpCooldown,
  false,
  "cooldown state clears at the exact cooldown boundary"
);

const initiatedDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "INITIATED",
});

assert.equal(
  initiatedDam.isEligible,
  false,
  "INITIATED breeding attempts remain blocking"
);

const pregnantDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
  activeBreedingAttemptStatus: "PREGNANT",
});

assert.equal(
  pregnantDam.isEligible,
  false,
  "PREGNANT breeding attempts remain blocking"
);

const eligibleDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
});

assert.equal(
  eligibleDam.isEligible,
  true,
  "otherwise eligible adult bitch remains eligible"
);

const maxAgeDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: maxAgeDamBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
});

assert.equal(
  maxAgeDam.isEligible,
  true,
  "dam at the exact maximum breeding age remains eligible"
);

const overMaxAgeDam = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: overMaxAgeDamBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "F",
});

assert.equal(
  overMaxAgeDam.isEligible,
  false,
  "dam past the maximum breeding age is ineligible"
);

const eligibleStud = getIndividualBreedingEligibility({
  currentEpoch,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "M",
});

assert.equal(
  eligibleStud.isEligible,
  true,
  "eligible adult stud remains eligible"
);

for (const relativePath of [
  "apps/web/server/services/dog.service.ts",
  "apps/web/components/breeding/BreedingPlannerPage.tsx",
  "apps/web/app/api/dogs/mine/route.ts",
  "apps/web/server/services/programPlanner.service.ts",
]) {
  assert.ok(
    source(relativePath).includes("getIndividualBreedingEligibility("),
    `${relativePath} uses the shared breeding eligibility helper`
  );
}

console.log("Breeding eligibility consistency checks passed.");
