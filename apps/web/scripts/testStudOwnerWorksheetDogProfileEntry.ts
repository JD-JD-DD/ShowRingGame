import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const marketService = source("apps/web/server/services/market.service.ts");

assert.ok(dogPage.includes("const canConfigureStudOffer"));
assert.ok(dogPage.includes('href={`/dogs/${header.dogId}/stud-contract`}'));
assert.ok(dogPage.includes("Stud Worksheet"));
assert.equal(dogPage.includes("OfferDogAtStudForm"), false);
assert.equal(dogPage.includes("ManageDogStudListingForm"), false);
assert.equal(dogPage.includes("list-at-stud"), false);
assert.equal(marketService.includes("export async function listDogAtStud"), false);
assert.equal(
  existsSync(join(root, "apps/web/app/api/dogs/[dogId]/list-at-stud/route.ts")),
  false
);

console.log("Stud Owner Worksheet dog-profile entry checks passed.");
