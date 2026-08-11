import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = readFileSync(
  join(repoRoot, "apps/web/components/breeding/BreedingPlannerPage.tsx"),
  "utf8"
);
const plannerClientSource = readFileSync(
  join(repoRoot, "apps/web/components/breeding/BreedPageClient.tsx"),
  "utf8"
);

function section(start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing ${start}`);
  assert.ok(endIndex > startIndex, `missing ${end}`);
  return source.slice(startIndex, endIndex);
}

const publicStudQuery = section(
  "const loadPublicStudListings = async () =>",
  "const [dogs, publicStudListings]"
);

type FixtureListing = {
  id: string;
  sellerKennelId: string;
  sellerType: "PLAYER" | "NPC";
  listingType: "PLAYER_STUD" | "PLAYER_SALE";
  status: "ACTIVE" | "CANCELLED";
  breedCode2: string;
  sex: "M" | "F";
  lifecycleState: "ALIVE" | "DECEASED";
};

const discoveryLimit = 200;
const fixtureDiscover = (listings: FixtureListing[], kennelId: string, breedCode2: string) =>
  listings
    .filter(
      (listing) =>
        listing.sellerType === "PLAYER" &&
        listing.listingType === "PLAYER_STUD" &&
        listing.status === "ACTIVE" &&
        listing.sellerKennelId !== kennelId &&
        listing.sex === "M" &&
        listing.lifecycleState === "ALIVE" &&
        listing.breedCode2 === breedCode2
    )
    .slice(0, discoveryLimit);

const unrelatedListings: FixtureListing[] = Array.from(
  { length: 220 },
  (_, index) => ({
    id: `unrelated-${index}`,
    sellerKennelId: "other-kennel",
    sellerType: "PLAYER",
    listingType: "PLAYER_STUD",
    status: "ACTIVE",
    breedCode2: "AA",
    sex: "M",
    lifecycleState: "ALIVE",
  })
);
const targetStud: FixtureListing = {
  id: "target-stud",
  sellerKennelId: "other-kennel",
  sellerType: "PLAYER",
  listingType: "PLAYER_STUD",
  status: "ACTIVE",
  breedCode2: "XX",
  sex: "M",
  lifecycleState: "ALIVE",
};
const fixtureListings = [
  ...unrelatedListings,
  targetStud,
  { ...targetStud, id: "own-stud", sellerKennelId: "viewer" },
  { ...targetStud, id: "cancelled-stud", status: "CANCELLED" as const },
];

assert.deepEqual(
  fixtureDiscover(fixtureListings, "viewer", "XX").map((listing) => listing.id),
  ["target-stud"],
  "more than 200 unrelated listings do not hide the selected breed's stud"
);
assert.equal(
  fixtureDiscover(fixtureListings, "viewer", "AA").length,
  discoveryLimit,
  "the breed-aware discovery query retains its bounded maximum"
);
assert.equal(
  fixtureListings.find((listing) => listing.id === "target-stud")?.id,
  "target-stud",
  "direct listing resolution is independent of the discovery batch"
);

assert.match(
  publicStudQuery,
  /breedCode2: publicStudBreedCode2,[\s\S]*take: isDirectStudSelection \? 1 : 200/,
  "the breed predicate is applied before the bounded public-stud result limit"
);
assert.match(
  publicStudQuery,
  /sellerKennelId: \{\s*not: kennel\.id,\s*\}/,
  "outside discovery excludes the current kennel"
);
assert.match(
  publicStudQuery,
  /status: "ACTIVE"/,
  "inactive listings remain excluded"
);
assert.match(
  publicStudQuery,
  /isDirectStudSelection\s*\? \{ id: directRouteContext!\.selectedStudListingId! \}/,
  "a direct stud link queries its exact listing independently of the general batch"
);
assert.match(
  source,
  /id: initialStudListingId,[\s\S]*status: "ACTIVE",[\s\S]*dog: \{\s*lifecycleState: "ALIVE",\s*sex: "M"/,
  "direct listing resolution requires an active, living male stud"
);
assert.match(
  source,
  /reason: "breed_context_required"/,
  "the worksheet does not fall back to an unbounded public-stud load without breed context"
);

function synchronizeDamBreed(url: string, breedCode2: string) {
  const nextUrl = new URL(url);
  if (nextUrl.searchParams.get("breedCode2") !== breedCode2) {
    nextUrl.searchParams.set("breedCode2", breedCode2);
  }
  return nextUrl.toString();
}

const noBreedUrl = "https://example.test/plan-a-litter?plannerView=outside";
assert.equal(
  synchronizeDamBreed(noBreedUrl, "NL"),
  "https://example.test/plan-a-litter?plannerView=outside&breedCode2=NL",
  "selecting an NL dam from the no-breed route supplies the server discovery context"
);
assert.equal(
  synchronizeDamBreed("https://example.test/plan-a-litter?breedCode2=NL", "NL"),
  "https://example.test/plan-a-litter?breedCode2=NL",
  "selecting a dam matching the URL breed does not churn the route"
);
assert.equal(
  synchronizeDamBreed("https://example.test/plan-a-litter?breedCode2=AA", "NL"),
  "https://example.test/plan-a-litter?breedCode2=NL",
  "changing dam breeds replaces the active public-stud result context"
);
assert.match(
  plannerClientSource,
  /function chooseDam\(nextDamId: string\)[\s\S]*synchronizeWorksheetBreedCode2\(nextDam\.breedCode2\)/,
  "dam selection synchronizes its canonical breed into the existing route mechanism"
);
assert.match(
  plannerClientSource,
  /new URLSearchParams\(window\.location\.search\)/,
  "breed synchronization preserves unrelated planner query parameters"
);
assert.match(
  plannerClientSource,
  /router\.replace\(`\$\{pathname\}\?\$\{searchParams\.toString\(\)\}`\);\s*router\.refresh\(\);/,
  "a changed breed context forces the mounted worksheet to receive refreshed server public studs"
);

console.log("Public stud discovery regression checks passed.");
