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
  page.includes('studOffersAsSire: { some: { status: "PUBLISHED" } }'),
  "published StudOffer rows are the only public candidate authority"
);
assert.ok(
  page.includes("Review Stud Contract"),
  "StudOffer card terms retain the public contract action"
);
assert.equal(page.includes('LEGACY_PLAYER_STUD'), false);
assert.ok(
  page.includes("Review Stud Contract") &&
    page.includes("`/stud-contract?sireDogId=${dog.id}&source=public-stud`"),
  "StudOffer cards open the contract route by sire identity without a listing ID"
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

console.log("Public Stud /studs StudOffer-only activation checks passed.");
