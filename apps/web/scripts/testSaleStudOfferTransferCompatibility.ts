import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const market = source("apps/web/server/services/market.service.ts");
const offers = source("apps/web/server/services/studOffer.service.ts");
const publicStuds = source("apps/web/server/services/publicStud.service.ts");

assert.match(offers, /retirePublishedStudOffersForTransferredDog/);
assert.match(offers, /sireDogId: args\.dogId/);
assert.match(offers, /ownerKennelId: args\.formerOwnerKennelId/);
assert.match(offers, /status: "PUBLISHED"/);
assert.match(offers, /data: \{ status: "RETIRED" \}/);

const transferCleanup = market.lastIndexOf("retirePublishedStudOffersForTransferredDog");
const ownershipUpdate = market.indexOf("ownerKennelId: buyer.id");
const soldListingUpdate = market.indexOf('status: "SOLD"');
assert.ok(transferCleanup > ownershipUpdate, "offer retirement follows ownership transfer in the same purchase transaction");
assert.ok(transferCleanup < soldListingUpdate, "offer retirement occurs before the transaction marks the sale sold");
assert.match(market, /formerOwnerKennelId: seller\.id/);

assert.match(market, /export async function listDogForSale/);
assert.match(market, /export async function bulkListDogsForSale/);
assert.doesNotMatch(market, /studOffer\.update|retirePublishedStudOffersForTransferredDog\([\s\S]{0,180}listDogForSale/);
assert.match(publicStuds, /status: "PUBLISHED"/);
assert.match(publicStuds, /adaptPublishedStudOfferToPublicStud/);
assert.doesNotMatch(publicStuds, /PLAYER_STUD/);

console.log("Sale and StudOffer transfer compatibility checks passed.");
