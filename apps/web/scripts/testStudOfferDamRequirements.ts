import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");
const route = source("apps/web/app/dogs/[dogId]/stud-contract/page.tsx");
const worksheet = source("apps/web/components/stud-contract/StudOfferWorksheet.tsx");
const rules = source("packages/rules/src/studContractTerms.ts");

assert.ok(route.includes("getRequiredHealthTestsForBreed(dog.breedCode2)"));
assert.ok(route.includes("PHENOTYPE_HEALTH_TESTS[code].label"));
assert.ok(route.includes("applicableHealthTests={applicableHealthTests}"));
assert.equal(worksheet.includes("HIP_DYSPLASIA"), false, "worksheet does not hard-code health tests");
assert.equal(worksheet.includes("ELBOW_DYSPLASIA"), false, "worksheet does not hard-code health tests");

assert.ok(worksheet.includes('currentStep.id === "dam-requirements"'));
assert.ok(worksheet.includes("validateStudOfferDamRequirementsStep"));
assert.ok(worksheet.includes("brucellosisNegativeRequiredAnswered"));
assert.ok(worksheet.includes("titleRequirementAnswered"));
assert.ok(worksheet.includes("healthRequirementAnsweredCodes"));
assert.ok(worksheet.includes("function updateHealthRequirement("));
assert.ok(worksheet.includes("healthTestCode === healthTestCode"), "health updates use canonical code matching");
assert.ok(worksheet.includes("healthTestCode === test.code"), "health controls key by canonical code");
assert.ok(worksheet.includes("No breed-specific health tests are currently configured for this breed."));

for (const value of ["NONE", "GREEN_OR_YELLOW", "GREEN_ONLY"]) {
  assert.ok(worksheet.includes(`value: "${value}"`), `health requirement includes ${value}`);
}
for (const value of ["NONE", "CH_OR_HIGHER", "GCH"]) {
  assert.ok(worksheet.includes(`value: "${value}"`), `title requirement includes ${value}`);
}
assert.ok(worksheet.includes('name="brucellosisNegativeRequired"'));
assert.ok(worksheet.includes('name="titleRequirement"'));
assert.ok(worksheet.includes("name={`damHealthRequirement-${test.code}`}"));
assert.ok(worksheet.includes("<fieldset"));
assert.ok(worksheet.includes("aria-describedby"));
assert.ok(worksheet.includes("focus-within:outline"));
assert.ok(worksheet.includes("This step records the requirement only. Dam eligibility is evaluated later."));

assert.ok(rules.includes("validateStudOfferDamRequirementsStep"));
for (const code of [
  "BRUCELLOSIS_REQUIREMENT_REQUIRED",
  "TITLE_REQUIREMENT_REQUIRED",
  "HEALTH_REQUIREMENT_REQUIRED",
  "DUPLICATE_HEALTH_TEST_REQUIREMENT",
  "UNEXPECTED_HEALTH_TEST_REQUIREMENT",
]) {
  assert.ok(rules.includes(code), `rules include ${code}`);
}

for (const forbidden of ["fetch(", "StudOffer.create", "StudContract.create", "DogListing"]) {
  assert.equal(worksheet.includes(forbidden), false, `worksheet does not include ${forbidden}`);
}

console.log("Stud offer Dam Requirements checks passed.");
