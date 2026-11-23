import assert from "node:assert/strict";

import { CURRENT_BREED_RELEASE } from "@showring/rules";

import {
  getReleasedBreedsGroupedByCanonicalShowGroup,
  groupReleasedBreedsByCanonicalShowGroup,
} from "../server/services/breed.service";

const fixtureBreeds = [
  { code2: "ZZ", name: "Zulu Sporting", groupName: "Sporting" },
  { code2: "AA", name: "Alpha Sporting", groupName: "Sporting" },
  { code2: "HH", name: "Hound Fixture", groupName: "Hound" },
];
const catalogFixtures = [
  ...fixtureBreeds.map((breed) => ({
    ...breed,
    isActive: true,
    releaseVersion: CURRENT_BREED_RELEASE,
  })),
  {
    code2: "NEW",
    name: "Newly Released Herding",
    groupName: "Herding",
    isActive: true,
    releaseVersion: CURRENT_BREED_RELEASE,
  },
  {
    code2: "OFF",
    name: "Inactive Sporting",
    groupName: "Sporting",
    isActive: false,
    releaseVersion: CURRENT_BREED_RELEASE,
  },
  {
    code2: "FUT",
    name: "Unreleased Hound",
    groupName: "Hound",
    isActive: true,
    releaseVersion: CURRENT_BREED_RELEASE + 1,
  },
];

function eligibleFixtureRows() {
  return catalogFixtures
    .filter(
      (breed) =>
        breed.isActive && breed.releaseVersion <= CURRENT_BREED_RELEASE
    )
    .map((breed) => ({
      code2: breed.code2,
      name: breed.name,
      groupName: breed.groupName,
    }));
}

async function main() {
  const groups = groupReleasedBreedsByCanonicalShowGroup(fixtureBreeds);

  assert.deepEqual(
    groups.map((group) => group.groupCode),
    ["SPORTING", "HOUND", "WORKING", "TERRIER", "TOY", "NON_SPORTING", "HERDING"],
    "groups use the canonical scheduled-show ordering"
  );
  assert.deepEqual(
    groups.find((group) => group.groupCode === "SPORTING")?.breeds,
    [
      { code2: "AA", name: "Alpha Sporting" },
      { code2: "ZZ", name: "Zulu Sporting" },
    ],
    "breeds are deterministically ordered within their canonical group"
  );
  assert.deepEqual(
    groups.find((group) => group.groupCode === "HOUND")?.breeds,
    [{ code2: "HH", name: "Hound Fixture" }],
    "canonical group assignment comes from the catalog group value"
  );
  assert.deepEqual(
    groups.find((group) => group.groupCode === "WORKING")?.breeds,
    [],
    "empty canonical groups are retained safely"
  );
  assert.deepEqual(
    groupReleasedBreedsByCanonicalShowGroup([]),
    groups.map(({ groupCode }) => ({ groupCode, breeds: [] })),
    "an empty eligible catalog remains a complete empty canonical group set"
  );
  assert.throws(
    () =>
      groupReleasedBreedsByCanonicalShowGroup([
        { code2: "XX", name: "Missing Group", groupName: null },
      ]),
    /Breed group name must be a non-empty supported group label/,
    "missing assignments fail closed instead of inventing a fallback group"
  );
  assert.throws(
    () =>
      groupReleasedBreedsByCanonicalShowGroup([
        { code2: "MX", name: "Legacy Miscellaneous", groupName: "Miscellaneous" },
      ]),
    /non-scheduled group: MISCELLANEOUS/,
    "legacy non-scheduled groups are not silently added to future worker input"
  );
  assert.throws(
    () => groupReleasedBreedsByCanonicalShowGroup([fixtureBreeds[0]!, fixtureBreeds[0]!]),
    /duplicate code: ZZ/,
    "duplicate canonical breed IDs fail closed"
  );

  const queries: unknown[] = [];
  const expectedDiscovered = groupReleasedBreedsByCanonicalShowGroup(
    eligibleFixtureRows()
  );
  const discovered = await getReleasedBreedsGroupedByCanonicalShowGroup({
    breed: {
      findMany: async (query: unknown) => {
        queries.push(query);
        return eligibleFixtureRows();
      },
    },
  } as never);
  assert.deepEqual(discovered, expectedDiscovered, "discovery groups the catalog rows without a breed-code list");
  assert.deepEqual(queries, [
    {
      where: { isActive: true, releaseVersion: { lte: CURRENT_BREED_RELEASE } },
      orderBy: [{ groupName: "asc" }, { name: "asc" }, { code2: "asc" }],
      select: { code2: true, name: true, groupName: true },
    },
  ], "discovery reuses released-breed eligibility and explicit ordering");
  assert.deepEqual(
    discovered.find((group) => group.groupCode === "HERDING")?.breeds,
    [{ code2: "NEW", name: "Newly Released Herding" }],
    "a newly eligible canonical catalog row joins its existing group without mapping changes"
  );
  assert.equal(
    discovered.flatMap((group) => group.breeds).some((breed) => breed.code2 === "OFF"),
    false,
    "inactive catalog rows are excluded by the shared released-breed query"
  );
  assert.equal(
    discovered.flatMap((group) => group.breeds).some((breed) => breed.code2 === "FUT"),
    false,
    "unreleased catalog rows are excluded by the shared released-breed query"
  );

  console.log("Released breed group discovery checks passed.");
}

void main();
