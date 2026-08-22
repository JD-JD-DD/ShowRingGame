import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const service = read("apps/web/server/services/studContractHistory.service.ts");
const list = read("apps/web/app/stud-contracts/page.tsx");
const detail = read("apps/web/app/stud-contracts/[contractId]/page.tsx");
const client = read("apps/web/components/stud-contract/StudContractHistoryClient.tsx");
const route = read("apps/web/app/api/stud-contracts/page/route.ts");
const nav = read("apps/web/components/layout/GameHeaderNav.tsx");

for (const fragment of [
  'OR: [{ sireKennelId: args.kennelId }, { damKennelId: args.kennelId }]',
  "const PAGE_SIZE = 10",
  "take: PAGE_SIZE + 1",
  "cursor: { id: args.cursor }",
  "healthRequirements",
  "returnBreedingAttempt",
  "puppySelection",
  "completedAt",
  "SIRE_OWNERSHIP_CHANGED",
  "Permanently ended — sire died",
  "currentActor",
  "currentDeadline",
  "approvalDeadlineAt: contract.approvalDeadlineAt?.toISOString() ?? null",
  "declinedAt: contract.declinedAt?.toISOString() ?? null",
  "expiredAt: contract.expiredAt?.toISOString() ?? null",
  "damFirstPickForfeitedAt",
  "studSelectionForfeitedAt",
  "puppySelectionLabel",
  "getStudContractCurrentState",
  "secondaryStates",
  "returnServiceCurrentState",
  "puppySelectionCurrentState",
  "Awaiting dam's protected pick",
  "Awaiting stud owner's puppy selection",
  "Puppy Back unfulfilled",
  "Return Service no longer available",
  "No litter — Return Service available",
  "No litter — contract complete",
  "MANUAL_APPROVAL",
  "PUPPY_SELECTION",
  "RETURN_SERVICE",
  "Approval required",
  "Awaiting stud-owner decision",
  "parseStudContractHistoryFilters",
  "completeContractWhere",
  "actionWhere",
  "needs-action",
  'status: "STUD_PICK"',
  'currentActor: "DAM_OWNER"',
  'returnService: { is: { status: "AVAILABLE", expiresAt: { gt: now } } }',
  "sortOrder === \"newest\" ? \"desc\" : \"asc\"",
  "contractBreedingAvailability",
  "isBreedingActive",
  "hasPendingVeterinaryCareFromRecords",
  "evaluateDamAgainstStudContractRequirements",
  "BRUCELLOSIS_DISEASE_CODE",
  "canApprove",
  "StudContractHubAction",
  "const actions: StudContractHubAction[] = []",
  'actions.push("MANUAL_APPROVAL")',
  'actions.push("PUPPY_SELECTION")',
  'actions.push("RETURN_SERVICE")',
  "actions, manualApproval",
  "litterId: true",
]) assert.ok(service.includes(fragment), fragment);
assert.ok(list.includes("StudContractHistoryClient"));
assert.ok(detail.includes("getStudContractHistoryDetail"));
assert.ok(detail.includes("Puppies born alive at whelping"));
assert.ok(detail.includes("Important dates"));
assert.ok(detail.includes("Approval deadline"));
assert.ok(detail.includes("Puppy transfer completed"));
assert.ok(detail.includes("Return Service expires"));
assert.ok(client.includes("Load More"));
assert.ok(client.includes(">Open<span"));
assert.ok(client.includes("Current state"));
assert.ok(client.includes("Additional contract states"));
assert.ok(client.includes("item.secondaryStates"));
assert.ok(client.includes("Status:"));
assert.ok(client.includes("Needs Action"));
assert.ok(client.includes("Approve Request"));
assert.ok(client.includes("Pick Puppy"));
assert.ok(client.includes("Newest first"));
assert.ok(client.includes("No contracts match these filters"));
assert.ok(client.includes("PendingStudRequestActions"));
assert.ok(client.includes('item.actions.includes("MANUAL_APPROVAL")'));
assert.ok(client.includes("item.actions.length === 0"));
assert.ok(client.includes('item.actions.includes("PUPPY_SELECTION")'));
assert.ok(client.includes("stud-contract-selection-${item.puppySelection.litterId}"));
assert.ok(client.includes('item.actions.includes("RETURN_SERVICE")'));
assert.ok(client.includes("StudContractReturnServiceAction"));
assert.ok(client.includes("canAttempt={item.returnService.canAttempt}"));
assert.equal(client.includes("Attempt Return Service"), false);
assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("parseStudContractHistoryFilters"));
assert.ok(route.includes("status: typeof body.status"));
assert.ok(nav.includes('label: "Stud Contracts", href: "/stud-contracts"'));
assert.equal(nav.includes('href: "/stud-contracts/requests"'), false);
console.log("Stud Contract history read-model checks passed.");
