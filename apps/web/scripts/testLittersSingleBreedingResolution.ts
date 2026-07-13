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

function assertExcludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), label);
}

const litterService = source("apps/web/server/services/litter.service.ts");
const breedingService = source("apps/web/server/services/breeding.service.ts");
const litterListSection = litterService.slice(
  litterService.indexOf("export async function listLittersForKennel"),
  litterService.indexOf("export async function getLitterForKennel")
);

assertIncludes(
  breedingService,
  "export async function listBreedingsForKennelAfterProgressResolved(",
  "breeding service exposes a narrow post-resolution breeding summary helper"
);
assertIncludes(
  breedingService,
  "export async function resolveDueBreedingProgressForKennel(",
  "breeding service exposes the narrow due-breeding-only resolver"
);
assertIncludes(
  breedingService,
  "return resolveDueBreedingProgress({",
  "the narrow due-breeding resolver reuses the shared due-progress implementation"
);
assertIncludes(
  breedingService,
  "const pregnancyOutcome = await resolvePregnancyCheckAttempt({",
  "shared due-breeding progress still performs pregnancy checks"
);
assertIncludes(
  breedingService,
  "const whelpOutcome = await resolveWhelpingAttempt({",
  "shared due-breeding progress still performs due whelping resolution"
);
assertIncludes(
  breedingService,
  "return listBreedingsForKennelSummaries(args);",
  "both breeding summary entry points reuse the shared summary query implementation"
);
assertIncludes(
  breedingService,
  "await resolveBreedingProgressForKennel({ kennelId, currentEpoch });",
  "default breeding summary loads still preserve canonical progress resolution for unrelated callers"
);

assertIncludes(
  litterListSection,
  "await resolveDueBreedingProgressForKennel({ kennelId, currentEpoch });",
  "litter list resolves due breeding progress before loading page data"
);
assertIncludes(
  litterListSection,
  "listBreedingsForKennelAfterProgressResolved({ kennelId, currentEpoch })",
  "litter list uses the narrow post-resolution breeding summary helper"
);
assertExcludes(
  litterListSection,
  "await resolveBreedingProgressForKennel({ kennelId, currentEpoch });",
  "litter list no longer runs the broad breeding resolver that includes dog-death maintenance"
);
assertExcludes(
  litterListSection,
  "resolveDogDeaths({ kennelId, currentEpoch })",
  "litter list does not invoke kennel-wide dog-death resolution on the initial list path"
);
assertExcludes(
  litterListSection,
  "listBreedingsForKennel({ kennelId, currentEpoch })",
  "litter list no longer calls the default breeding summary path that re-resolves progress"
);

console.log("Litter single breeding resolution source checks passed.");
