import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const page = readFileSync(join(repoRoot, "apps/web/app/stud-contract/page.tsx"), "utf8");

assert.ok(page.includes("resolvePublicStudForSire"));
assert.ok(page.includes("sireDogId: sireId"));
assert.ok(page.includes("...(listingId ? { legacyListingId: listingId } : {})"));
assert.ok(page.includes('publicStud.source === "STUD_OFFER"'));
assert.ok(page.includes('publicStud.source === "LEGACY_PLAYER_STUD"'));
assert.ok(
  page.includes("!listingId || publicStud.legacyListingId !== listingId"),
  "legacy fallback still requires its real listing identity"
);
assert.equal(
  page.includes("if (!listingId || !sireId) notFound()"),
  false,
  "StudOffer routes require sire identity but not a legacy listing ID"
);
assert.ok(
  page.includes("This Stud Contract is available to review, but submission is not yet available from this offer."),
  "StudOffer submission is not fabricated before automatic/manual activation"
);

console.log("StudOffer dam-route activation checks passed.");
