import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const breeding = source("apps/web/server/services/breeding.service.ts");
const route = source("apps/web/app/api/stud-contracts/automatic/route.ts");
const page = source("apps/web/app/stud-contract/page.tsx");
const confirmation = source("apps/web/components/stud-contract/AutomaticStudContractConfirmation.tsx");

for (const fragment of [
  "createAutomaticStudContractBreedingForKennel",
  "resolvePublicStudForSire",
  "automaticStudContract: true",
  'status: "PUBLISHED"',
  'approvalMode !== "AUTOMATIC"',
  "assertDamMeetsStudContractRequirements",
  "FOR UPDATE",
  "freshDamConflict",
  "studFeeAmount =",
  'automaticOffer.compensationType === "PUPPY_BACK"',
  "tx.studContract.create",
  'status: "ACCEPTED"',
  "sourceOfferVersion: automaticOffer.version",
  "breedingAttemptId: createdAttempt.id",
  "healthRequirements: {",
]) {
  assert.ok(breeding.includes(fragment), `automatic transaction includes ${fragment}`);
}
assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("getKennelForUser"));
assert.ok(route.includes("createAutomaticStudContractBreedingForKennel"));
assert.equal(route.includes("LEGACY_PLAYER_STUD"), false);
assert.equal(route.includes("studListingId"), false);
assert.equal(route.includes("cashAmount"), false, "client cannot submit a cash amount");
assert.equal(route.includes("approvalMode"), false, "client cannot submit approval mode");
assert.ok(page.includes("AutomaticStudContractConfirmation"));
assert.equal(page.includes('LEGACY_PLAYER_STUD'), false);
assert.equal(confirmation.includes('source:'), false);
assert.ok(confirmation.includes("Accept Terms and Breed"));
assert.ok(confirmation.includes("aria-busy={pending}"));
assert.equal(confirmation.includes("StudContract.create"), false);

console.log("Stud Contract automatic acceptance checks passed.");
