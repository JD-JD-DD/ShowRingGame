import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const script = readFileSync(
  join(root, "apps/web/scripts/deactivateLegacyPlayerStudListings.ts"),
  "utf8"
);

assert.ok(script.includes("PLAYER_STUD_LISTING_TYPE"));
assert.ok(script.includes('status: "ACTIVE"'));
assert.ok(script.includes("db.dogListing.count({ where: activePlayerStudWhere })"));
assert.ok(script.includes("db.dogListing.updateMany({"));
assert.ok(script.includes('data: { status: "CANCELLED" }'));
assert.ok(script.includes('process.argv.includes("--apply")'));
assert.equal(script.includes("db.dogListing.delete"), false);
assert.equal(script.includes("db.studOffer."), false);
assert.equal(script.includes("db.breedingAttempt."), false);

console.log("Legacy PLAYER_STUD deactivation checks passed.");
