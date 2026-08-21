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
  qualificationCheckpointAt: null,
  qualifyingSurvivingPuppyCount: null,
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
assert.equal(
  classifyStudContractOutcome({
    ...baseInput,
    breedingAttemptStatus: "FAILED",
    noLitterReturnService: false,
  }).returnServiceConditionTriggered,
  false
);

const qualified = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  qualificationCheckpointAt: new Date(),
  qualifyingSurvivingPuppyCount: 2,
  puppyBackMinimumMet: false,
  smallLitterReturnServiceMet: true,
});
assert.equal(qualified.outcomeReady, true);
assert.equal(qualified.litterOutcome, "QUALIFIED_LITTER");
assert.equal(qualified.puppyBackLitterSizeOutcome, "NOT_FULFILLABLE_LITTER_SIZE");
assert.equal(qualified.smallLitterReturnServiceTriggered, true);
assert.equal(qualified.returnServiceConditionTriggered, true);

const potentiallyFulfillable = classifyStudContractOutcome({
  ...baseInput,
  breedingAttemptStatus: "WHELPED",
  hasLinkedLitter: true,
  qualificationCheckpointAt: new Date(),
  qualifyingSurvivingPuppyCount: 3,
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
  qualificationCheckpointAt: new Date(),
  qualifyingSurvivingPuppyCount: 2,
  puppyBackMinimumMet: null,
  smallLitterReturnServiceMet: false,
});
assert.equal(cash.puppyBackApplicable, false);
assert.equal(cash.puppyBackLitterSizeOutcome, "NOT_APPLICABLE");
assert.equal(cash.returnServiceConditionTriggered, false);

console.log("Stud Contract outcome classification checks passed.");
