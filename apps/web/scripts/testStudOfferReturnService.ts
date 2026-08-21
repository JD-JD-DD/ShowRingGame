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

assert.ok(worksheet.includes('currentStep.id === "return-service"'));
assert.ok(worksheet.includes("No-Litter Return Service"));
assert.ok(worksheet.includes("Small-Litter Return Service"));
assert.ok(worksheet.includes('value: true,'));
assert.ok(worksheet.includes('value: false,'));
assert.ok(worksheet.includes('none: "None"'));
for (const label of ["1 or fewer", "2 or fewer", "3 or fewer"]) {
  assert.ok(worksheet.includes(`label: "${label}"`), `has ${label} threshold`);
}
assert.ok(worksheet.includes("noLitterReturnServiceAnswered"));
assert.ok(worksheet.includes("smallLitterReturnThresholdAnswered"));
assert.ok(worksheet.includes("isValidSmallLitterReturnThreshold"));
assert.ok(worksheet.includes("validateStudOfferReturnServiceStep"));
assert.ok(worksheet.includes('currentStep.id === "return-service" && !returnServiceValidation.valid'));
assert.ok(worksheet.includes('name="noLitterReturnService"'));
assert.ok(worksheet.includes('name="smallLitterReturnThreshold"'));
assert.ok(worksheet.includes("surviving puppies at the contract's qualifying litter checkpoint"));
assert.ok(worksheet.includes("unavailable required sex does not create return service"));
assert.ok(worksheet.includes("this alone does not create return service"));
assert.ok(worksheet.includes("no return service is created solely for that missed selection"));
assert.ok(worksheet.includes("separately selected surviving-litter threshold itself is satisfied"));
assert.ok(worksheet.includes("no automatic alternate-sex or cash substitution"));
assert.ok(worksheet.includes("aria-describedby"));
assert.ok(rules.includes("validateStudOfferReturnServiceStep"));
assert.ok(rules.includes("NO_LITTER_RETURN_SERVICE_REQUIRED"));
assert.ok(rules.includes("SMALL_LITTER_RETURN_SERVICE_REQUIRED"));
assert.equal(worksheet.includes("returnCredit"), false);
assert.equal(worksheet.includes("StudOffer.create"), false);
assert.equal(worksheet.includes("StudContract.create"), false);

console.log("Stud offer return service checks passed.");
