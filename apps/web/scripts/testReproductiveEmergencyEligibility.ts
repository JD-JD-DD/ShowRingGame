import assert from "node:assert/strict";
import { getBreedingEligibilityMessage, getIndividualBreedingEligibility } from "../server/services/breedingEligibility.service";

const base = { birthEpoch: 0, lifecycleState: "ALIVE" as const, sex: "F" as const };
const event = (consequence: "NONE" | "EXTENDED_RECOVERY" | "PERMANENT_BREEDING_RESTRICTION", resolvedEpoch = 1000) => [{ id: "event-1", status: "RESOLVED_TREATED" as const, resolvedEpoch, reproductiveConsequence: consequence }];
assert.equal(getIndividualBreedingEligibility({ ...base, currentEpoch: 1269, resolvedReproductiveEmergencies: event("NONE") }).reasonCode, "REPRODUCTIVE_RECOVERY");
assert.equal(getIndividualBreedingEligibility({ ...base, currentEpoch: 1270, resolvedReproductiveEmergencies: event("NONE") }).isEligible, true);
assert.equal(getIndividualBreedingEligibility({ ...base, currentEpoch: 1364, resolvedReproductiveEmergencies: event("EXTENDED_RECOVERY") }).reasonCode, "REPRODUCTIVE_EXTENDED_RECOVERY");
assert.equal(getIndividualBreedingEligibility({ ...base, currentEpoch: 1365, resolvedReproductiveEmergencies: event("EXTENDED_RECOVERY") }).isEligible, true);
const permanent = getIndividualBreedingEligibility({ ...base, currentEpoch: 999999, resolvedReproductiveEmergencies: [...event("NONE", 2000), ...event("PERMANENT_BREEDING_RESTRICTION", 1000)] });
assert.equal(permanent.reasonCode, "PERMANENT_REPRODUCTIVE_RESTRICTION");
assert.equal(permanent.eligibleAtEpoch, null);
assert.match(getBreedingEligibilityMessage(permanent) ?? "", /may not be bred again/);
console.log("Reproductive emergency eligibility checks passed.");
