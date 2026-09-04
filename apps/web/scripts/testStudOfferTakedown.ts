import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const service = source("apps/web/server/services/studOffer.service.ts");
const route = source("apps/web/app/api/dogs/[dogId]/stud-offer/route.ts");
const worksheet = source("apps/web/components/stud-contract/StudOfferWorksheet.tsx");
const worksheetPage = source("apps/web/app/dogs/[dogId]/stud-contract/page.tsx");
const dogProfile = source("apps/web/app/dogs/[dogId]/page.tsx");
const publicStud = source("apps/web/server/services/publicStud.service.ts");
const manualRequest = source("apps/web/server/services/studContractRequest.service.ts");
const breeding = source("apps/web/server/services/breeding.service.ts");
const market = source("apps/web/server/services/market.service.ts");
const takeDownMutation = service.slice(
  service.indexOf("export async function retirePublishedStudOfferForOwner"),
  service.indexOf("export async function getCurrentPublishedStudOfferForOwnedDog")
);

for (const fragment of [
  "export async function retirePublishedStudOfferForOwner",
  "FOR UPDATE",
  "dog.ownerKennelId !== args.ownerKennelId",
  'status: "PUBLISHED"',
  'data: { status: "RETIRED" }',
  "CURRENT_OFFER_MISSING",
  "return { offerId: publishedOffer.id, version: publishedOffer.version }",
]) {
  assert.ok(service.includes(fragment), `owner takedown service includes ${fragment}`);
}
assert.equal(takeDownMutation.includes("studOffer.delete"), false, "offer history is retained");
assert.equal(takeDownMutation.includes("studOffer.create"), false, "no replacement offer is created");
assert.equal(takeDownMutation.includes("studContract."), false, "contracts are untouched");
assert.equal(takeDownMutation.includes("breedingAttempt."), false, "breeding attempts are untouched");

assert.ok(route.includes("export async function DELETE"));
assert.ok(route.includes("getSessionUserId"));
assert.ok(route.includes("getKennelForUser"));
assert.ok(route.includes("retirePublishedStudOfferForOwner"));
assert.ok(route.includes('error.code === "NOT_OWNER" ? 403 : 409'));

assert.ok(worksheetPage.includes("hasPublishedOffer={currentOffer !== null}"));
assert.ok(worksheet.includes("hasPublishedOffer: boolean"));
assert.ok(worksheet.includes("{hasPublishedOffer ? ("));
assert.ok(worksheet.includes("Take Down Stud Offer"));
assert.ok(worksheet.includes("Existing requests and contracts will not be changed."));
assert.ok(worksheet.includes('method: "DELETE"'));
assert.ok(worksheet.includes("setTakeDownSuccess(true)"));
assert.ok(worksheet.includes("Stud offer taken down."));
assert.ok(worksheet.includes("router.refresh()"));
assert.equal(dogProfile.includes("Take Down Stud Offer"), false, "dog profile has no direct takedown control");

assert.ok(publicStud.includes('status: "PUBLISHED"'));
assert.equal(publicStud.includes("PLAYER_STUD"), false, "public authority has no legacy fallback");
assert.ok(manualRequest.includes('status: "PUBLISHED"'));
assert.ok(breeding.includes('where: { sireDogId: sire.id, status: "PUBLISHED" }'));
assert.ok(market.includes("retirePublishedStudOffersForTransferredDog"));

console.log("Stud Offer takedown checks passed.");
