import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const breeding = source("apps/web/server/services/breeding.service.ts");
const approve = source("apps/web/app/api/stud-contracts/[contractId]/approve/route.ts");
const decline = source("apps/web/app/api/stud-contracts/[contractId]/decline/route.ts");
const page = source("apps/web/app/stud-contracts/requests/page.tsx");
const actions = source("apps/web/components/stud-contract/PendingStudRequestActions.tsx");
const hub = source("apps/web/components/stud-contract/StudContractHistoryClient.tsx");
const history = source("apps/web/server/services/studContractHistory.service.ts");

for (const fragment of [
  "manualApprovedContractId",
  "freshSire.ownerKennelId !== manualContract.sireKennelId",
  'id: { not: args.manualApprovedContractId }',
  'FROM "StudContract"',
  'status: "PENDING"',
  "approvalDeadlineAt",
  "new Date() >= manualContract.approvalDeadlineAt",
  "assertDamMeetsStudContractRequirements",
  "manualContract.healthRequirements",
  "manualContract.titleRequirement",
  "manualContract.cashAmount",
  'manualContract.compensationType === "PUPPY_BACK"',
  'status: "ACCEPTED"',
  "acceptedAt: new Date()",
  "breedingAttemptId: createdAttempt.id",
  "updateMany",
]) {
  assert.ok(breeding.includes(fragment), `approval transaction contains ${fragment}`);
}
for (const fragment of [
  'sireKennelId: kennel.id',
  'status: "PENDING"',
  "approveManualStudContractForKennel",
]) assert.ok(approve.includes(fragment), `approve route contains ${fragment}`);
assert.equal(approve.includes("PLAYER_STUD_LISTING_TYPE"), false);
assert.equal(approve.includes("dogListing.findFirst"), false);
assert.equal(approve.includes("studOffer"), false);
for (const fragment of [
  'sireKennelId: kennel.id',
  'status: "PENDING"',
  'status: "DECLINED"',
  "declinedAt: new Date()",
  "STUD_MANUAL_DECLINED",
  "createKennelNotice",
]) assert.ok(decline.includes(fragment), `decline route contains ${fragment}`);
assert.equal(decline.includes("breedingAttempt.create"), false);
assert.equal(decline.includes("ledgerTransaction"), false);
assert.ok(page.includes("canApprove={remaining > 0 && availability.isEligible}"));
assert.ok(page.includes('availability.reasonCode === "STUD_RECOVERY"'));
assert.ok(actions.includes('act("approve")'));
assert.ok(actions.includes('act("decline")'));
assert.ok(actions.includes("router.refresh()"));
assert.ok(actions.includes("disabled={pending || !canApprove}"));
assert.ok(actions.includes("approveDisabledReason"));
assert.ok(actions.includes('act("decline")'));
assert.ok(hub.includes("PendingStudRequestActions"));
assert.ok(hub.includes('item.action.kind === "MANUAL_APPROVAL"'));
assert.equal(hub.includes("StudContractPuppySelectionActions"), false);
assert.equal(hub.includes("StudContractReturnServiceAction"), false);
assert.ok(history.includes("approvalAvailability"));
assert.ok(history.includes("hasPendingVeterinaryCareFromRecords"));
assert.ok(history.includes("evaluateDamAgainstStudContractRequirements"));

console.log("Stud Contract Manual Approve/Decline checks passed.");
