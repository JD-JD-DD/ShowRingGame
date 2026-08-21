import assert from "node:assert/strict";

import {
  MAX_STUD_CONTRACT_CASH_AMOUNT,
  normalizeStudOfferTermsAfterChange,
  type EditableStudOfferTerms,
  validateStudContractCashAmount,
  validateStudOfferCompensationStep,
  validateStudOfferPuppyBackTermsStep,
  validateStudOfferTerms,
} from "../src/index";

function terms(
  overrides: Partial<EditableStudOfferTerms> = {}
): EditableStudOfferTerms {
  return {
    compensationType: "CASH",
    cashAmount: 1,
    puppyPickPosition: null,
    puppySex: null,
    minimumLitterSize: null,
    noLitterReturnService: false,
    smallLitterReturnThreshold: null,
    brucellosisNegativeRequired: false,
    titleRequirement: "NONE",
    approvalMode: "AUTOMATIC",
    healthRequirements: [],
    ...overrides,
  };
}

function assertValid(candidate: EditableStudOfferTerms, label: string) {
  const result = validateStudOfferTerms(candidate);
  assert.equal(result.valid, true, `${label}: ${JSON.stringify(result.errors)}`);
}

function assertError(
  candidate: EditableStudOfferTerms,
  code: string,
  label: string
) {
  const result = validateStudOfferTerms(candidate);
  assert.equal(result.valid, false, `${label}: should be invalid`);
  assert.ok(result.errors.some((error) => error.code === code), `${label}: expected ${code}, got ${JSON.stringify(result.errors)}`);
}

const puppyBackTerms = (overrides: Partial<EditableStudOfferTerms> = {}) =>
  terms({
    compensationType: "PUPPY_BACK",
    cashAmount: null,
    puppyPickPosition: "FIRST",
    puppySex: "EITHER",
    minimumLitterSize: 1,
    ...overrides,
  });

assertValid(terms(), "valid CASH");
assertError(terms({ cashAmount: null }), "CASH_AMOUNT_REQUIRED", "CASH requires cash");
assertError(terms({ puppyPickPosition: "FIRST" }), "PUPPY_PICK_NOT_ALLOWED", "CASH rejects puppy fields");

assertValid(puppyBackTerms(), "valid PUPPY_BACK");
assertError(puppyBackTerms({ cashAmount: 1 }), "CASH_AMOUNT_NOT_ALLOWED", "PUPPY_BACK rejects cash");
assertError(puppyBackTerms({ puppyPickPosition: null }), "PUPPY_PICK_REQUIRED", "PUPPY_BACK requires pick");
assertError(puppyBackTerms({ puppySex: null }), "PUPPY_SEX_REQUIRED", "PUPPY_BACK requires sex");
assertError(puppyBackTerms({ minimumLitterSize: null }), "MINIMUM_LITTER_REQUIRED", "PUPPY_BACK requires litter size");

const combinedTerms = puppyBackTerms({
  compensationType: "CASH_AND_PUPPY_BACK",
  cashAmount: 1,
});
assertValid(combinedTerms, "valid CASH_AND_PUPPY_BACK");
assertError({ ...combinedTerms, cashAmount: null }, "CASH_AMOUNT_REQUIRED", "combined requires cash");
assertError({ ...combinedTerms, puppySex: null }, "PUPPY_SEX_REQUIRED", "combined requires puppy fields");

assertValid(puppyBackTerms({ puppyPickPosition: "FIRST", minimumLitterSize: 1 }), "FIRST supports 1");
assertValid(puppyBackTerms({ puppyPickPosition: "FIRST", minimumLitterSize: 2 }), "FIRST supports 2");
assertValid(puppyBackTerms({ puppyPickPosition: "FIRST", minimumLitterSize: 3 }), "FIRST supports 3");
assertError(puppyBackTerms({ puppyPickPosition: "SECOND", minimumLitterSize: 1 }), "SECOND_PICK_REQUIRES_MINIMUM_TWO", "SECOND rejects 1");
assertValid(puppyBackTerms({ puppyPickPosition: "SECOND", minimumLitterSize: 2 }), "SECOND supports 2");
assertValid(puppyBackTerms({ puppyPickPosition: "SECOND", minimumLitterSize: 3 }), "SECOND supports 3");
assertError(puppyBackTerms({ puppyPickPosition: "THIRD" as never }), "INVALID_PUPPY_PICK", "custom pick rejected");

for (const puppySex of ["EITHER", "MALE", "FEMALE"] as const) {
  assertValid(puppyBackTerms({ puppySex }), `${puppySex} is valid`);
}

for (const smallLitterReturnThreshold of [null, 1, 2, 3]) {
  assertValid(terms({ smallLitterReturnThreshold, noLitterReturnService: true }), `return threshold ${String(smallLitterReturnThreshold)} is valid`);
}
assertError(terms({ smallLitterReturnThreshold: 4 }), "INVALID_SMALL_LITTER_RETURN_THRESHOLD", "invalid return threshold rejected");

for (const requirementLevel of ["NONE", "GREEN_OR_YELLOW", "GREEN_ONLY"] as const) {
  assertValid(terms({ healthRequirements: [{ healthTestCode: "FUTURE_TEST", requirementLevel }] }), `${requirementLevel} health level is valid`);
}
assertError(terms({ healthRequirements: [
  { healthTestCode: "FUTURE_TEST", requirementLevel: "NONE" },
  { healthTestCode: "FUTURE_TEST", requirementLevel: "GREEN_ONLY" },
] }), "DUPLICATE_HEALTH_TEST_REQUIREMENT", "duplicate health test rejected");
for (const titleRequirement of ["NONE", "CH_OR_HIGHER", "GCH"] as const) {
  assertValid(terms({ titleRequirement }), `${titleRequirement} is valid`);
}
assertValid(terms({ approvalMode: "MANUAL" }), "MANUAL is valid");

assertValid(terms({ cashAmount: MAX_STUD_CONTRACT_CASH_AMOUNT }), "maximum cash is valid");
assertError(terms({ cashAmount: MAX_STUD_CONTRACT_CASH_AMOUNT + 1 }), "CASH_AMOUNT_TOO_HIGH", "cash above maximum rejected");
assertError(terms({ cashAmount: Number.MAX_VALUE }), "INVALID_CASH_AMOUNT", "extremely large cash rejected safely");
assertError(terms({ cashAmount: Number.POSITIVE_INFINITY }), "INVALID_CASH_AMOUNT", "non-finite cash rejected safely");

assert.equal(validateStudContractCashAmount(1).valid, true, "cash helper accepts minimum");
assert.equal(validateStudContractCashAmount(MAX_STUD_CONTRACT_CASH_AMOUNT).valid, true, "cash helper accepts maximum");
assert.equal(validateStudContractCashAmount(MAX_STUD_CONTRACT_CASH_AMOUNT + 1).error?.code, "CASH_AMOUNT_TOO_HIGH", "cash helper rejects above maximum");
assert.equal(validateStudContractCashAmount(Number.MAX_VALUE).valid, false, "cash helper rejects unsafe values");
assert.equal(validateStudOfferCompensationStep(terms()).valid, true, "CASH compensation step accepts valid cash");
assert.equal(validateStudOfferCompensationStep(terms({ cashAmount: null })).errors[0]?.code, "CASH_AMOUNT_REQUIRED", "CASH compensation step requires cash");
assert.equal(validateStudOfferCompensationStep(puppyBackTerms()).valid, true, "PUPPY_BACK compensation step defers puppy fields to its later step");
assert.equal(validateStudOfferCompensationStep(combinedTerms).valid, true, "combined compensation step accepts valid cash");
assert.equal(validateStudOfferPuppyBackTermsStep(puppyBackTerms()).valid, true, "Puppy-Back step accepts FIRST plus valid terms");
assert.equal(validateStudOfferPuppyBackTermsStep(puppyBackTerms({ puppyPickPosition: null })).errors[0]?.code, "PUPPY_PICK_REQUIRED", "Puppy-Back step requires pick");
assert.equal(validateStudOfferPuppyBackTermsStep(puppyBackTerms({ puppySex: null })).errors[0]?.code, "PUPPY_SEX_REQUIRED", "Puppy-Back step requires sex");
assert.equal(validateStudOfferPuppyBackTermsStep(puppyBackTerms({ minimumLitterSize: null })).errors[0]?.code, "MINIMUM_LITTER_REQUIRED", "Puppy-Back step requires minimum");
assert.equal(validateStudOfferPuppyBackTermsStep(puppyBackTerms({ puppyPickPosition: "SECOND", minimumLitterSize: 1 })).errors[0]?.code, "SECOND_PICK_REQUIRES_MINIMUM_TWO", "Puppy-Back step rejects SECOND plus 1");

const upstreamTerms = puppyBackTerms({
  cashAmount: 50,
  noLitterReturnService: true,
  smallLitterReturnThreshold: 3,
  brucellosisNegativeRequired: true,
  titleRequirement: "GCH",
  approvalMode: "MANUAL",
});
const cashNormalized = normalizeStudOfferTermsAfterChange(upstreamTerms, "compensationType", "CASH");
assert.deepEqual(
  [cashNormalized.puppyPickPosition, cashNormalized.puppySex, cashNormalized.minimumLitterSize],
  [null, null, null],
  "switching to CASH clears puppy fields"
);
assert.equal(cashNormalized.noLitterReturnService, true, "CASH retains unrelated return setting");
assert.equal(cashNormalized.brucellosisNegativeRequired, true, "CASH retains brucellosis setting");
assert.equal(cashNormalized.approvalMode, "MANUAL", "CASH retains approval mode");

const puppyNormalized = normalizeStudOfferTermsAfterChange(terms({ cashAmount: 99 }), "compensationType", "PUPPY_BACK");
assert.equal(puppyNormalized.cashAmount, null, "switching to PUPPY_BACK clears cash");
assert.equal(puppyNormalized.puppyPickPosition, null, "normalization does not invent pick defaults");

const secondPickFromOne = normalizeStudOfferTermsAfterChange(puppyBackTerms({ minimumLitterSize: 1 }), "puppyPickPosition", "SECOND");
assert.equal(secondPickFromOne.minimumLitterSize, null, "FIRST to SECOND clears 1");
for (const minimumLitterSize of [2, 3]) {
  const secondPick = normalizeStudOfferTermsAfterChange(puppyBackTerms({ minimumLitterSize }), "puppyPickPosition", "SECOND");
  assert.equal(secondPick.minimumLitterSize, minimumLitterSize, `FIRST to SECOND preserves ${minimumLitterSize}`);
  const firstPick = normalizeStudOfferTermsAfterChange(secondPick, "puppyPickPosition", "FIRST");
  assert.equal(firstPick.minimumLitterSize, minimumLitterSize, `SECOND to FIRST preserves ${minimumLitterSize}`);
}
assert.equal(upstreamTerms.puppyPickPosition, "FIRST", "normalization does not mutate input");

console.log("Stud contract term rule checks passed.");
