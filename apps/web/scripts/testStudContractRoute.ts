import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = readFileSync(
  join(repoRoot, "apps/web/app/stud-contract/page.tsx"),
  "utf8"
);
const publicStudPage = readFileSync(
  join(repoRoot, "apps/web/app/studs/page.tsx"),
  "utf8"
);
const plannerClient = readFileSync(
  join(repoRoot, "apps/web/components/breeding/BreedPageClient.tsx"),
  "utf8"
);

assert.ok(source.includes('redirect("/login")'));
assert.ok(source.includes('redirect("/onboarding")'));
assert.ok(source.includes("getKennelForUser(userId)"));
assert.ok(source.includes("db.dogListing.findFirst"));
assert.ok(source.includes("id: listingId, dogId: sireId"));
assert.ok(source.includes("listingType: PLAYER_STUD_LISTING_TYPE"));
assert.ok(source.includes('status: "ACTIVE"'));
assert.ok(source.includes("getCurrentPublishedStudOffersForSires([sireId])"));
assert.ok(source.includes("id: damId, ownerKennelId: kennel.id"));
assert.ok(source.includes("if (damId && !dam) notFound()"));
assert.ok(source.includes("evaluateCurrentDamAgainstStudContractRequirements"));
assert.ok(source.includes('first(q.source) === "plan-a-litter" ? "/plan-a-litter"'));
assert.ok(source.includes('first(q.source) === "breed-dog" ? "/breed" : "/studs"'));
assert.ok(source.includes("Go Back"));
assert.ok(!source.includes("returnTo"));
assert.ok(!source.includes("fetch("));
for (const mutation of [
  "StudContract.create",
  "breedingAttempt.create",
  "db.breedingAttempt.create",
  "db.studOffer.create",
  "fetch(",
]) {
  assert.equal(source.includes(mutation), false, `route remains read-only: ${mutation}`);
}

for (const parameter of [
  "studListingId?: string | string[]",
  "sireDogId?: string | string[]",
  "damDogId?: string | string[]",
  "source?: string | string[]",
]) {
  assert.ok(source.includes(parameter), `route accepts canonical ${parameter}`);
}
assert.ok(
  publicStudPage.includes(
    "`/stud-contract?studListingId=${listing.id}&sireDogId=${dog.id}&source=public-stud`"
  ),
  "Public Stud uses the canonical listing, sire, and public-stud source context"
);
assert.equal(
  publicStudPage.includes("damDogId"),
  false,
  "Public Stud intentionally omits dam context while browsing"
);
assert.ok(
  plannerClient.includes(
    "`/stud-contract?studListingId=${dog.studListingId}&sireDogId=${dog.id}&damDogId=${selectedDam.id}&source=breed-dog`"
  ),
  "direct Breed Dog uses the active listing, outside sire, selected dam, and breed-dog source context"
);
assert.ok(
  plannerClient.includes(
    "`/stud-contract?studListingId=${dog.studListingId}&sireDogId=${dog.id}&damDogId=${selectedDam.id}&source=plan-a-litter`"
  ),
  "Plan a Litter uses the active listing, outside sire, selected dam, and plan-a-litter source context"
);
for (const alias of [
  "listing=",
  "listingId=",
  "studId=",
  "studDogId=",
  "dog=",
  "dogId=",
  "femaleId=",
  "dam=",
  "origin=",
  "originPage=",
  "returnUrl=",
]) {
  assert.equal(
    `${publicStudPage}\n${plannerClient}`.includes(`/stud-contract?${alias}`) ||
      `${publicStudPage}\n${plannerClient}`.includes(`&${alias}`),
    false,
    `stud-contract generators do not use the ${alias} alias`
  );
}

console.log("Stud contract route checks passed.");
