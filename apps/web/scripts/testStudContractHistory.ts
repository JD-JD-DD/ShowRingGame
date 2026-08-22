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
  'orderBy: [{ requestedAt: "desc" }, { id: "desc" }]',
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
  'returnService: { is: { status: "AVAILABLE" } }',
  "sortOrder === \"newest\" ? \"desc\" : \"asc\"",
  "approvalAvailability",
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
assert.ok(detail.includes("Completed:"));
assert.ok(client.includes("Load More"));
assert.ok(client.includes(">Open<span"));
assert.ok(client.includes("Current state"));
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
assert.equal(client.includes("Attempt Return Service"), false);
assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("parseStudContractHistoryFilters"));
assert.ok(route.includes("status: typeof body.status"));
assert.ok(nav.includes('label: "My Stud Contracts"'));
console.log("Stud Contract history read-model checks passed.");
