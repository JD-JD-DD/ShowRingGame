import assert from "node:assert/strict";
import {
  classifyStudContractOutcome,
  type StudContractOutcomeInput,
} from "./studContractTerms";

const baseInput: StudContractOutcomeInput = {
  compensationType: "PUPPY_BACK",
  noLitterReturnService: true,
  smallLitterReturnThreshold: 2,
  minimumLitterSize: 3,
  breedingAttemptStatus: "PREGNANT",
  hasLinkedLitter: false,
  whelpQualificationAt: null,
  liveBornPuppyCount: null,
  puppyBackMinimumMet: null,
  smallLitterReturnServiceMet: null,
};

const unresolved = classifyStudContractOutcome(baseInput);
assert.equal(unresolved.outcomeReady, false);
assert.equal(unresolved.litterOutcome, "PENDING");

const preQualificationLitter = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
});
assert.equal(preQualificationLitter.outcomeReady, false);

const incompleteWhelpFacts = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  whelpQualificationAt: new Date(),
  liveBornPuppyCount: 3,
});
assert.equal(incompleteWhelpFacts.outcomeReady, false);

const noLitter = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "CHECKED_NOT_PREGNANT",
  noLitterReturnService: true,
});
assert.deepEqual(noLitter, {
  outcomeReady: true,
  litterOutcome: "NO_LITTER",
  noLitterReturnServiceTriggered: true,
  smallLitterReturnServiceTriggered: false,
  returnServiceConditionTriggered: true,
  puppyBackApplicable: true,
  puppyBackLitterSizeOutcome: "NO_QUALIFYING_LITTER",
});
const failed = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "FAILED",
  noLitterReturnService: false,
});
assert.equal(failed.litterOutcome, "NO_LITTER");
assert.equal(failed.returnServiceConditionTriggered, false);

const cancelled = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "CANCELLED",
});
assert.equal(cancelled.outcomeReady, false);
assert.equal(cancelled.litterOutcome, "PENDING");

const qualified = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  whelpQualificationAt: new Date(),
  liveBornPuppyCount: 2,
  puppyBackMinimumMet: false,
  smallLitterReturnServiceMet: true,
});
assert.equal(qualified.outcomeReady, true);
assert.equal(qualified.litterOutcome, "QUALIFIED_LITTER");
assert.equal(qualified.puppyBackLitterSizeOutcome, "NOT_FULFILLABLE_LITTER_SIZE");
assert.equal(qualified.smallLitterReturnServiceTriggered, true);
assert.equal(qualified.returnServiceConditionTriggered, true);

const neonatalDeathsDoNotChangeQualification = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  whelpQualificationAt: new Date(),
  liveBornPuppyCount: 2,
  puppyBackMinimumMet: false,
  smallLitterReturnServiceMet: true,
});
assert.equal(neonatalDeathsDoNotChangeQualification.puppyBackLitterSizeOutcome, "NOT_FULFILLABLE_LITTER_SIZE");
assert.equal(neonatalDeathsDoNotChangeQualification.returnServiceConditionTriggered, true);

const potentiallyFulfillable = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  whelpQualificationAt: new Date(),
  liveBornPuppyCount: 3,
  puppyBackMinimumMet: true,
  smallLitterReturnServiceMet: null,
});
assert.equal(potentiallyFulfillable.puppyBackLitterSizeOutcome, "POTENTIALLY_FULFILLABLE");
assert.equal(potentiallyFulfillable.smallLitterReturnServiceTriggered, false);

const cash = classifyStudContractOutcome({
  ...baseInput,
  compensationType: "CASH",
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  whelpQualificationAt: new Date(),
  liveBornPuppyCount: 2,
  puppyBackMinimumMet: null,
  smallLitterReturnServiceMet: false,
});
assert.equal(cash.puppyBackApplicable, false);
assert.equal(cash.puppyBackLitterSizeOutcome, "NOT_APPLICABLE");
assert.equal(cash.returnServiceConditionTriggered, false);

console.log("Stud Contract outcome classification checks passed.");
