import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const resolver = source("apps/web/server/services/publicStud.service.ts");
const planner = source("apps/web/components/breeding/BreedPageClient.tsx");
const contractRoute = source("apps/web/app/stud-contract/page.tsx");
const automaticRoute = source("apps/web/app/api/stud-contracts/automatic/route.ts");
const manualRoute = source("apps/web/app/api/stud-contracts/manual/route.ts");
const breeding = source("apps/web/server/services/breeding.service.ts");
const schema = source("apps/web/prisma/schema.prisma");

assert.equal(dogPage.includes("OfferDogAtStudForm"), false);
assert.equal(dogPage.includes("list-at-stud"), false);
assert.equal(
  existsSync(join(root, "apps/web/app/api/dogs/[dogId]/list-at-stud/route.ts")),
  false
);

for (const sourceFile of [resolver, planner, contractRoute, automaticRoute, manualRoute]) {
  assert.equal(sourceFile.includes("LEGACY_PLAYER_STUD"), false);
  assert.equal(sourceFile.includes("legacyListingId"), false);
}
assert.equal(planner.includes("studListingId"), false);
assert.equal(automaticRoute.includes("studListingId"), false);
assert.equal(manualRoute.includes("studListingId"), false);

for (const field of [
  "requiresBrucellosisNegativeDam",
  "requiresDamHealthTestsCompleted",
  "requiresDamHealthAllGreen",
  "requiresDamHealthGreenOrYellow",
  "requiresDamChampionTitle",
]) {
  assert.equal(breeding.includes(field), false, `${field} is not breeding authority`);
  assert.ok(schema.includes(field), `${field} remains historical schema data`);
}

assert.equal(breeding.includes("assertDamMeetsStudListingRequirements"), false);
assert.equal(breeding.includes("activePublicStudListingWhere"), false);
assert.ok(breeding.includes("assertDamMeetsStudContractRequirements"));

console.log("Stud Contract legacy-authority absence checks passed.");
