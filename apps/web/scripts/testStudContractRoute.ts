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

assert.ok(source.includes('args.source === "public-stud") return "/studs"'));
assert.ok(source.includes('args.source === "plan-a-litter") return "/plan-a-litter"'));
assert.ok(source.includes('return `/breed?studListingId=${encodeURIComponent(args.studListingId)}`'));
assert.ok(source.includes('return `/breed?dogId=${encodeURIComponent(args.damDogId)}`'));
assert.ok(source.includes('return "/breed"'));
assert.ok(source.includes('return "/studs"'));
assert.ok(source.includes('redirect("/login")'));
assert.ok(source.includes("Stud contract details will be available here."));
assert.ok(source.includes("Go Back"));
assert.ok(!source.includes("returnTo"));
assert.ok(!source.includes("db."));
assert.ok(!source.includes("fetch("));

for (const parameter of [
  "studListingId?: string | string[];",
  "sireDogId?: string | string[];",
  "damDogId?: string | string[];",
  "source?: string | string[];",
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
