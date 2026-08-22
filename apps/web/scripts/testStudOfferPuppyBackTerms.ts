import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const worksheet = readFileSync(
  join(repoRoot, "apps/web/components/stud-contract/StudOfferWorksheet.tsx"),
  "utf8"
);
const rules = readFileSync(
  join(repoRoot, "packages/rules/src/studContractTerms.ts"),
  "utf8"
);

assert.ok(worksheet.includes('currentStep.id === "puppy-back"'));
assert.ok(worksheet.includes("hasPuppyBack(terms.compensationType)"));
for (const value of ["FIRST", "SECOND"]) {
  assert.ok(worksheet.includes(`value: "${value}"`), `has ${value} pick`);
}
for (const value of ["EITHER", "MALE", "FEMALE"]) {
  assert.ok(worksheet.includes(`value: "${value}"`), `has ${value} sex`);
}
assert.equal(worksheet.includes("THIRD"), false);
assert.equal(worksheet.includes("preference"), true, "copy says sex is not a preference");
assert.ok(worksheet.includes("getAllowedMinimumLitterSizes("));
assert.ok(worksheet.includes("MINIMUM_LITTER_OPTIONS = [1, 2, 3]"));
assert.ok(worksheet.includes("disabled={!isAllowed}"));
assert.ok(worksheet.includes("Second Pick requires at least 2 puppies born alive at whelping"));
assert.ok(worksheet.includes("validateStudOfferPuppyBackTermsStep"));
assert.ok(worksheet.includes('currentStep.id === "puppy-back" && !puppyBackValidation.valid'));
assert.ok(worksheet.includes('name="puppyPickPosition"'));
assert.ok(worksheet.includes('name="puppySex"'));
assert.ok(worksheet.includes('name="minimumLitterSize"'));
assert.ok(worksheet.includes("Selection begins after litter creation"));
assert.ok(worksheet.includes("fixed birth+48 deadline never moves"));
assert.ok(worksheet.includes("The game will never automatically select a puppy"));
assert.ok(worksheet.includes("forfeits that selection right"));
assert.ok(worksheet.includes("does not substitute another sex"));
assert.ok(worksheet.includes("automatic cash substitute"));
assert.ok(worksheet.includes("If a selected puppy dies before Day 56"));
assert.ok(worksheet.includes("that Puppy Back outcome does not create Return Service"));
assert.ok(worksheet.includes("aria-describedby"));
assert.ok(rules.includes("validateStudOfferPuppyBackTermsStep"));
assert.ok(rules.includes("SECOND_PICK_REQUIRES_MINIMUM_TWO"));
assert.equal(worksheet.includes("StudOffer.create"), false);
assert.equal(worksheet.includes("StudContract.create"), false);

console.log("Stud offer puppy-back term checks passed.");
