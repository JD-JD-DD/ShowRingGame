import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hasValidPublishedStudOffer } from "@/server/services/studOfferPresentation.service";

const root = resolve(__dirname, "..", "..", "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const offerPresentation = source(
  "apps/web/server/services/studOfferPresentation.service.ts"
);
const dogService = source("apps/web/server/services/dog.service.ts");
const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const mineRoute = source("apps/web/app/api/dogs/mine/route.ts");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const showEntry = source("apps/web/server/services/showEntry.service.ts");
const programPlanner = source("apps/web/server/services/programPlanner.service.ts");
const badges = source("apps/web/components/dogs/DogStatusBadges.tsx");

assert.ok(
  offerPresentation.includes("export function hasValidPublishedStudOffer") &&
    offerPresentation.includes("offer.ownerKennelId === args.ownerKennelId"),
  "published-offer indicator semantics require the current owner to match"
);
assert.equal(
  hasValidPublishedStudOffer({
    ownerKennelId: "current-owner",
    publishedStudOffers: [{ ownerKennelId: "current-owner" }],
  }),
  true,
  "a current-owner published offer shows the indicator"
);
assert.equal(
  hasValidPublishedStudOffer({
    ownerKennelId: "current-owner",
    publishedStudOffers: [],
  }),
  false,
  "no published offer hides the indicator"
);
assert.equal(
  hasValidPublishedStudOffer({
    ownerKennelId: "current-owner",
    publishedStudOffers: [{ ownerKennelId: "former-owner" }],
  }),
  false,
  "a stale prior-owner offer hides the indicator"
);
assert.equal(
  offerPresentation.includes("isBreedingActive"),
  false,
  "offer-existence presentation does not conflate breeding availability"
);
assert.equal(
  offerPresentation.includes("PLAYER_STUD"),
  false,
  "historical PLAYER_STUD rows cannot drive the indicator"
);

for (const [name, text] of [
  ["dog profile", dogService],
  ["kennel dogs API", mineRoute],
  ["owned breeding planner", planner],
  ["show entry", showEntry],
  ["program planner", programPlanner],
] as const) {
  assert.ok(
    text.includes('where: { status: "PUBLISHED" }') &&
      text.includes("select: { id: true, ownerKennelId: true }") &&
      text.includes("hasValidPublishedStudOffer"),
    `${name} derives At Stud from a minimal ownership-valid published-offer selection`
  );
}

assert.ok(
  dogPage.includes("isListedAtStud={profile.snapshot.isListedAtStud}"),
  "dog profile DNA uses the published-offer presentation boolean"
);
assert.ok(
  dogService.includes("if (isListedAtStud)") &&
    dogService.includes('label: "At Stud", tone: "blue"'),
  "dog profile At Stud header chip uses the same published-offer boolean"
);
assert.ok(
  programPlanner.includes("if (dog.marketSummary.isListedAtStud) tags.add(\"At Stud\")") &&
    programPlanner.includes("atStudDogs: dogs.filter((dog) => dog.marketSummary.isListedAtStud)"),
  "Program Planner filter, tag, and count retain the shared presentation boolean"
);
assert.ok(
  badges.includes('const AT_STUD_STATUS_INDICATOR = "\\u{1F9EC}"') &&
    badges.includes('aria-label="Dog is listed at stud"') &&
    badges.includes("theme-status-info"),
  "blue DNA presentation and accessible label remain unchanged"
);

console.log("Published StudOffer indicator regression checks passed.");
