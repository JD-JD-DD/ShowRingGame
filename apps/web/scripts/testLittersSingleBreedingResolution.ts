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

assertIncludes(
  breedingService,
  "export async function listBreedingsForKennelAfterProgressResolved(",
  "breeding service exposes a narrow post-resolution breeding summary helper"
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
  litterService,
  "await resolveBreedingProgressForKennel({ kennelId, currentEpoch });",
  "litter list performs one canonical breeding-progress resolution before loading page data"
);
assertIncludes(
  litterService,
  "listBreedingsForKennelAfterProgressResolved({ kennelId, currentEpoch })",
  "litter list uses the narrow post-resolution breeding summary helper"
);
assertExcludes(
  litterService,
  "listBreedingsForKennel({ kennelId, currentEpoch })",
  "litter list no longer calls the default breeding summary path that re-resolves progress"
);

console.log("Litter single breeding resolution source checks passed.");
