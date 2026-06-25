import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertBefore(
  haystack: string,
  first: string,
  second: string,
  label: string
): void {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);

  assert.ok(firstIndex >= 0, `${label}: missing first marker`);
  assert.ok(secondIndex >= 0, `${label}: missing second marker`);
  assert.ok(firstIndex < secondIndex, label);
}

const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const dogService = source("apps/web/server/services/dog.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");

assertIncludes(
  dogMapper,
  "export type DogProfileAreaNavigationDto",
  "dog profile DTO exposes a scoped area navigation field"
);
assertIncludes(
  dogMapper,
  "areaNavigation: DogProfileAreaNavigationDto;",
  "dog profile DTO includes area navigation on the top-level profile"
);
assertIncludes(
  dogMapper,
  "previousDog: DogProfileDogLinkDto | null;",
  "area navigation carries a display-safe previous dog link"
);
assertIncludes(
  dogMapper,
  "nextDog: DogProfileDogLinkDto | null;",
  "area navigation carries a display-safe next dog link"
);

assertIncludes(
  dogPage,
  "const areaId = firstQueryValue(resolvedSearchParams.areaId);",
  "dog page reads areaId from query params before loading the profile"
);
assertBefore(
  dogPage,
  "const areaId = firstQueryValue(resolvedSearchParams.areaId);",
  "const profile = await getDogProfile({",
  "dog page computes areaId before getDogProfile"
);
assertIncludes(
  dogPage,
  "areaId,",
  "dog page passes areaId into dog profile loading"
);
assertIncludes(
  dogPage,
  "← Previous Dog",
  "dog page renders Previous Dog navigation text"
);
assertIncludes(
  dogPage,
  "Next Dog →",
  "dog page renders Next Dog navigation text"
);
assertIncludes(
  dogPage,
  "areaNavigation.previousDog.profileUrl",
  "previous dog navigation uses the display-safe DTO URL"
);
assertIncludes(
  dogPage,
  "areaNavigation.nextDog.profileUrl",
  "next dog navigation uses the display-safe DTO URL"
);

assertIncludes(
  dogService,
  "async function buildAreaNavigation",
  "dog profile service builds area navigation server-side"
);
assertIncludes(
  dogService,
  "!areaId || !args.viewerKennelId || !args.isOwnedByCurrentKennel",
  "area navigation requires valid areaId and managing kennel context"
);
assertIncludes(
  dogService,
  "kennelId: args.viewerKennelId",
  "area navigation validates the area belongs to the viewer kennel"
);
assertIncludes(
  dogService,
  "ownerKennelId: args.viewerKennelId",
  "area navigation limits dogs to the viewer kennel"
);
assertIncludes(
  dogService,
  "lifecycleState: DogLifecycleState.ALIVE",
  "area navigation keeps the old alive-dog filter"
);
assertIncludes(
  dogService,
  "isPlayerVisible: true",
  "area navigation limits dogs to player-visible dogs"
);
assertIncludes(
  dogService,
  "kennelAreaMemberships",
  "area navigation limits dogs to the selected kennel area"
);
assertBefore(
  dogService,
  '{ breed: { name: "asc" } }',
  '{ birthEpoch: "desc" }',
  "area navigation orders by breed name before birth epoch"
);
assertBefore(
  dogService,
  '{ birthEpoch: "desc" }',
  '{ regNumber: "asc" }',
  "area navigation orders by birth epoch before registration number"
);
assertIncludes(
  dogService,
  "?areaId=${encodeURIComponent(kennelAreaId)}",
  "area navigation preserves areaId in dog profile URLs"
);
assertIncludes(
  dogService,
  "areaNavigation,",
  "dog profile service returns area navigation through the mapper"
);

console.log("Dog profile area navigation checks passed.");
