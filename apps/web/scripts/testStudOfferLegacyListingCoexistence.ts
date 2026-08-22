import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const service = readFileSync(
  join(root, "apps/web/server/services/studOffer.service.ts"),
  "utf8"
);

assert.ok(service.includes('import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";'));
assert.ok(
  service.includes('listingType: { not: PLAYER_STUD_LISTING_TYPE },'),
  "active PLAYER_STUD listings do not block StudOffer publication"
);
assert.ok(
  service.includes('status: "ACTIVE",'),
  "other active listing types still block StudOffer publication"
);
assert.equal(service.includes("DogListing.update"), false);
assert.equal(service.includes("DogListing.create"), false);

console.log("StudOffer legacy listing coexistence checks passed.");
