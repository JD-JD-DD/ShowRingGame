import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const page = readFileSync(join(repoRoot, "apps/web/app/studs/page.tsx"), "utf8");

assert.ok(
  page.includes('import { resolvePublicStudInventory } from "@/server/services/publicStud.service"'),
  "/studs uses the shared inventory authority"
);
assert.ok(
  page.includes("const resolvedPublicStuds = await resolvePublicStudInventory(dogIds)"),
  "/studs resolves its filtered candidate dogs through the shared inventory resolver"
);
assert.ok(
  page.includes('studOffersAsSire: { some: { status: "PUBLISHED" } }'),
  "published StudOffer-only sires are candidate dogs"
);
assert.ok(
  page.includes('listingType: "PLAYER_STUD"') && page.includes('status: "ACTIVE"'),
  "active legacy PLAYER_STUD rows remain candidate fallback sources"
);
assert.ok(
  page.includes('publicStud.source === "STUD_OFFER"'),
  "StudOffer card terms use discriminated source narrowing"
);
assert.ok(
  page.includes('publicStud.source === "LEGACY_PLAYER_STUD"'),
  "legacy contract routing uses discriminated source narrowing"
);
assert.ok(
  page.includes("Stud Contract action coming soon"),
  "StudOffer cards avoid a broken legacy listing action before dam-route activation"
);
assert.equal(
  page.includes("getCurrentPublishedStudOffersForSires"),
  false,
  "/studs no longer independently loads StudOffers"
);
assert.equal(
  page.includes("adaptLegacyPublicStudListing"),
  false,
  "/studs no longer independently adapts legacy listings"
);

console.log("Public Stud /studs dual-source activation checks passed.");
