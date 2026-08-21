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

for (const value of ["CASH", "PUPPY_BACK", "CASH_AND_PUPPY_BACK"]) {
  assert.ok(worksheet.includes(`value: "${value}"`), `has ${value} choice`);
}
for (const label of ["Cash", "Puppy Back", "Cash + Puppy Back"]) {
  assert.ok(worksheet.includes(`label: "${label}"`), `has ${label} label`);
}
assert.equal(worksheet.includes("Deposit"), false);
assert.equal(worksheet.includes("Custom"), false);
assert.ok(worksheet.includes('type="radio"'));
assert.ok(worksheet.includes('name="compensationType"'));
assert.ok(worksheet.includes("requiresCash(terms.compensationType)"));
assert.ok(worksheet.includes("MAX_STUD_CONTRACT_CASH_AMOUNT"));
assert.ok(worksheet.includes("validateStudContractCashAmount"));
assert.ok(worksheet.includes("validateStudOfferCompensationStep"));
assert.ok(worksheet.includes('id="stud-contract-cash-amount"'));
assert.ok(worksheet.includes('htmlFor="stud-contract-cash-amount"'));
assert.ok(worksheet.includes("aria-invalid={cashError ? true : undefined}"));
assert.ok(worksheet.includes('aria-describedby='));
assert.ok(worksheet.includes("new Intl.NumberFormat"));
assert.ok(worksheet.includes("handleCashAmountChange"));
assert.ok(worksheet.includes("/^\\d+$/.test(rawValue)"));
assert.ok(worksheet.includes('updateTerm("compensationType", option.value)'));
assert.ok(worksheet.includes('updateTerm("cashAmount", amount)'));
assert.ok(worksheet.includes('currentStep.id === "compensation" && !compensationValidation.valid'));
assert.ok(rules.includes("MAX_STUD_CONTRACT_CASH_AMOUNT = 1_000_000"));
assert.ok(rules.includes("CASH_AMOUNT_TOO_HIGH"));
assert.ok(rules.includes("validateStudOfferCompensationStep"));
assert.equal(worksheet.includes("StudOffer.create"), false);

console.log("Stud offer compensation checks passed.");
