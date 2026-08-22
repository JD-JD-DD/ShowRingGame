import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const noticesPage = read("apps/web/app/notices/page.tsx");
const requests = read("apps/web/server/services/studContractRequest.service.ts");
const lifecycle = read("apps/web/server/services/studContractLifecycle.service.ts");
const puppySelection = read("apps/web/server/services/studContractPuppySelection.service.ts");

assert.ok(noticesPage.includes('"/stud-contracts?action=manual-approval"'));
assert.ok(noticesPage.includes('"/stud-contracts?action=return-service"'));
assert.ok(noticesPage.includes('`/litters#stud-contract-selection-${notice.linkedLitterId}`'));
assert.ok(noticesPage.includes('`/stud-contracts/${studContractId}`'));
assert.ok(noticesPage.includes('`/dogs/${notice.linkedDogId}`'));
assert.ok(noticesPage.includes('!sourceKey.includes("SECOND_PICK_INFO")'));
assert.ok(noticesPage.includes('!sourceKey.includes("DAM_INFO")'));
assert.equal(noticesPage.includes("/stud-contracts/requests"), false);
assert.equal(noticesPage.includes(" as any"), false);

for (const source of [requests, lifecycle, puppySelection]) {
  assert.ok(source.includes("metadataJson: { studContractId:"));
}

for (const sourceKey of [
  "STUD_MANUAL_REQUEST_OWNER",
  "STUD_MANUAL_REQUEST_DAM",
  "STUD_MANUAL_EXPIRED",
  "STUD_PUPPY_SELECTION_OPEN",
  "STUD_PUPPY_SELECTION_REOPENED",
  "STUD_PUPPY_SELECTION_DAM_PICK",
  "STUD_PUPPY_SELECTION_DAM_FORFEITED",
  "STUD_PUPPY_SELECTION_STUD_FORFEITED",
  "STUD_PUPPY_SELECTION_UNFULFILLABLE_DEATH",
  "STUD_PUPPY_TRANSFER",
]) {
  assert.ok(`${requests}\n${lifecycle}\n${puppySelection}`.includes(sourceKey));
}

console.log("Stud Contract notice routing checks passed.");
