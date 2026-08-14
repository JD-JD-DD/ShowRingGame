import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import { MIN_BREED_AGE_HOURS, STUD_RECOVERY_HOURS } from "@showring/rules";

import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "../server/services/breedingEligibility.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const latestSireAttemptCreatedEpoch = 100;
const adultBirthEpoch = latestSireAttemptCreatedEpoch - MIN_BREED_AGE_HOURS - 12;

assert.equal(STUD_RECOVERY_HOURS, 2, "stud recovery remains two game hours");

const recoveringStud = getIndividualBreedingEligibility({
  currentEpoch: 101,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "M",
  latestSireAttemptCreatedEpoch,
});
assert.equal(recoveringStud.isEligible, false, "stud is ineligible inside recovery");
assert.equal(recoveringStud.reasonCode, "STUD_RECOVERY", "stud has recovery reason");
assert.equal(recoveringStud.isInStudRecovery, true, "stud recovery state is exposed");
assert.equal(recoveringStud.studRecoveryUntilEpoch, 102, "recovery end is derived from attempt creation");
assert.equal(recoveringStud.remainingHours, 1, "recovery reports remaining hours");
assert.equal(
  getBreedingEligibilityMessage(recoveringStud),
  "Stud recovery. May breed again in 1 hour.",
  "stud recovery uses the shared duration formatter"
);

const availableStud = getIndividualBreedingEligibility({
  currentEpoch: 102,
  birthEpoch: adultBirthEpoch,
  lifecycleState: "ALIVE",
  sex: "M",
  latestSireAttemptCreatedEpoch,
});
assert.equal(availableStud.isEligible, true, "stud is eligible at the exact recovery boundary");
assert.equal(availableStud.isInStudRecovery, false, "recovery clears at the exact boundary");

const source = readFileSync(
  path.join(repoRoot, "apps/web/server/services/breeding.service.ts"),
  "utf8"
);
assert.ok(source.includes("FOR UPDATE"), "breeding creation locks the sire row");
assert.ok(
  source.includes("where: { sireId: sire.id }") &&
    source.includes("latestSireAttemptCreatedEpoch"),
  "breeding creation derives sire recovery from the latest persisted attempt"
);
assert.ok(
  !source.includes("status: { in: [\"INITIATED\", \"CHECKED_NOT_PREGNANT\"") ,
  "sire recovery does not filter persisted attempts by successful outcome"
);
assert.ok(
  MIN_BREED_AGE_HOURS > 0,
  "shared breeding-age constant remains available to the eligibility model"
);

console.log("Stud recovery checks passed.");
