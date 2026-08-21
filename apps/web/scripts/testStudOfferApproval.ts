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

assert.ok(worksheet.includes('currentStep.id === "approval"'));
assert.ok(worksheet.includes("Automatic Approval"));
assert.ok(worksheet.includes("Manual Approval"));
assert.ok(worksheet.includes('value: "AUTOMATIC"'));
assert.ok(worksheet.includes('value: "MANUAL"'));
assert.equal(worksheet.includes('value: "PREFERRED"'), false);
assert.ok(worksheet.includes('name="approvalMode"'));
assert.ok(worksheet.includes("terms.approvalMode === option.value"));
assert.ok(worksheet.includes('updateTerm("approvalMode", option.value)'));
assert.ok(worksheet.includes("validateStudOfferApprovalStep"));
assert.ok(worksheet.includes('currentStep.id === "approval" && !approvalValidation.valid'));

assert.ok(worksheet.includes("Qualifying breedings do not require individual approval from the stud owner."));
assert.ok(worksheet.includes("normal breeding eligibility and Stud Recovery still apply"));
assert.ok(worksheet.includes("Manual Approval requires you to approve each breeding request."));
assert.ok(worksheet.includes("24 real hours"));
assert.ok(worksheet.includes("A pending request does not reserve the sire"));
assert.ok(worksheet.includes("Approval is only available while the sire is currently eligible to breed"));
assert.ok(worksheet.includes("a request may expire while the sire is in Stud Recovery"));
assert.ok(worksheet.includes("aria-describedby"));
assert.ok(worksheet.includes("focus-within:outline"));

assert.ok(rules.includes("validateStudOfferApprovalStep"));
assert.ok(rules.includes("APPROVAL_MODE_REQUIRED"));
assert.ok(rules.includes("INVALID_APPROVAL_MODE"));

for (const forbidden of [
  "StudOffer.create",
  "StudContract.create",
  "approvalDeadlineAt",
  "/approve",
  "/decline",
]) {
  assert.equal(worksheet.includes(forbidden), false, `worksheet does not include ${forbidden}`);
}

console.log("Stud offer Approval checks passed.");
