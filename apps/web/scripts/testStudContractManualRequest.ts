import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const service = source("apps/web/server/services/studContractRequest.service.ts");
const route = source("apps/web/app/api/stud-contracts/manual/route.ts");
const page = source("apps/web/app/stud-contract/page.tsx");
const client = source("apps/web/components/stud-contract/ManualStudContractRequest.tsx");

for (const fragment of [
  "resolvePublicStudForSire",
  'status: "PUBLISHED"', 'approvalMode !== "MANUAL"',
  "assertDamMeetsStudContractRequirements", 'status: "PENDING"',
  "approvalDeadlineAt", "MANUAL_APPROVAL_WINDOW_MS",
  "healthRequirements: {", "createKennelNotice",
  "STUD_MANUAL_REQUEST_OWNER", "STUD_MANUAL_REQUEST_DAM",
]) assert.ok(service.includes(fragment), fragment);
assert.equal(service.includes("breedingAttempt.create"), false);
assert.equal(service.includes("ledgerTransaction"), false);
assert.ok(route.includes("createManualStudContractRequest"));
assert.equal(route.includes("LEGACY_PLAYER_STUD"), false);
assert.equal(route.includes("studListingId"), false);
assert.equal(route.includes("cashAmount"), false);
assert.ok(page.includes("pendingManualRequest"));
assert.equal(page.includes('LEGACY_PLAYER_STUD'), false);
assert.equal(client.includes('source:'), false);
assert.ok(client.includes("Request Stud Approval"));
assert.ok(client.includes("24 real hours"));
assert.ok(client.includes("aria-busy={pending}"));
console.log("Stud Contract manual request checks passed.");
