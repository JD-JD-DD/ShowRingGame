import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const page = readFileSync(join(repoRoot, "apps/web/app/stud-contract/page.tsx"), "utf8");

assert.ok(page.includes("resolvePublicStudForSire"));
assert.ok(page.includes("sireDogId: sireId"));
assert.equal(page.includes("legacyListingId"), false);
assert.equal(page.includes('LEGACY_PLAYER_STUD'), false);
assert.equal(
  page.includes("if (!listingId || !sireId) notFound()"),
  false,
  "StudOffer routes require sire identity but not a legacy listing ID"
);
assert.equal(
  page.includes("This Stud Contract is available to review, but submission is not yet available from this offer."),
  false,
  "StudOffer contract actions are active after automatic/manual activation"
);

console.log("StudOffer-only dam-route activation checks passed.");
