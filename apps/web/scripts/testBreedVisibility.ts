import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CURRENT_BREED_RELEASE } from "@showring/rules";

type BreedCsvRow = {
  lineNumber: number;
  breed_name: string;
  code2: string;
  group: string;
  playable: string;
  release_version: string;
};

const CANONICAL_ACTIVE_CODES = new Map([
  ["BC", "Border Collie"],
  ["VC", "Bearded Collie"],
  ["OL", "Collie"],
  ["QK", "Cocker Spaniel"],
  ["EG", "English Cocker Spaniel"],
]);

const INACTIVE_DUPLICATE_CODES = new Map([
  ["SO", "Smooth Collie"],
  ["RC", "Rough Collie"],
  ["QE", "American Cocker"],
  ["QM", "English Cocker"],
]);

function rootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
}

function source(path: string): string {
  return readFileSync(join(rootDir(), path), "utf8");
}

function parseBreedCsv(): BreedCsvRow[] {
  const lines = source("apps/web/prisma/data/breeds.csv")
    .split(/\r?\n/)
    .filter(Boolean);
  const header = lines.shift()?.replace(/^\uFEFF/, "");
  assert.equal(
    header,
    "breed_name,code2,group,playable,release_version",
    "breed CSV header stays aligned with seed.ts"
  );

  return lines.map((line, index) => {
    const [breed_name, code2, group, playable, release_version] = line.split(",");

    return {
      lineNumber: index + 2,
      breed_name,
      code2,
      group,
      playable,
      release_version,
    };
  });
}

function byCode(rows: BreedCsvRow[], code2: string): BreedCsvRow {
  const row = rows.find((candidate) => candidate.code2 === code2);
  assert.ok(row, `expected CSV row for ${code2}`);
  return row;
}

function assertIncludes(sourceText: string, needle: string, label: string) {
  assert.ok(sourceText.includes(needle), label);
}

async function main() {
  const rows = parseBreedCsv();

  for (const [code2, expectedName] of CANONICAL_ACTIVE_CODES) {
    const row = byCode(rows, code2);
    assert.equal(row.breed_name, expectedName, `${code2} keeps canonical name`);
    assert.ok(
      Number(row.release_version) <= CURRENT_BREED_RELEASE,
      `${code2} remains active in the current breed release`
    );
  }

  for (const [code2, expectedName] of INACTIVE_DUPLICATE_CODES) {
    const row = byCode(rows, code2);
    assert.equal(row.breed_name, expectedName, `${code2} legacy name is preserved`);
    assert.ok(
      Number(row.release_version) > CURRENT_BREED_RELEASE,
      `${code2} is inactive for new player-facing selection`
    );
  }

  const activeCatalogNames = rows
    .filter((row) => Number(row.release_version) <= CURRENT_BREED_RELEASE)
    .map((row) => row.breed_name);

  for (const name of CANONICAL_ACTIVE_CODES.values()) {
    assert.ok(activeCatalogNames.includes(name), `/api/breeds/catalog includes ${name}`);
  }

  for (const name of INACTIVE_DUPLICATE_CODES.values()) {
    assert.equal(
      activeCatalogNames.includes(name),
      false,
      `/api/breeds/catalog excludes ${name}`
    );
  }

  const catalogRoute = source("apps/web/app/api/breeds/catalog/route.ts");
  assertIncludes(catalogRoute, "isActive: true", "breed catalog filters active breeds");

  const breedService = source("apps/web/server/services/breed.service.ts");
  assertIncludes(
    breedService,
    "isActive: true",
    "released foundation breed source filters active breeds"
  );

  const foundationService = source("apps/web/server/services/foundationDog.service.ts");
  assertIncludes(
    foundationService,
    "isActiveReleasedBreedCode",
    "single-breed foundation generation checks active release status"
  );
  assertIncludes(
    foundationService,
    "isActive: true",
    "foundation generation does not include inactive breed codes"
  );

  const cleanupScript = source(
    "apps/web/scripts/cleanupInactiveBreedFoundationListings.ts"
  );
  for (const code2 of INACTIVE_DUPLICATE_CODES.keys()) {
    assertIncludes(
      cleanupScript,
      `"${code2}"`,
      `inactive foundation cleanup targets ${code2}`
    );
  }
  assertIncludes(cleanupScript, "process.argv.includes(\"--apply\")", "cleanup mutates only with --apply");
  assertIncludes(cleanupScript, "status: \"EXPIRED\"", "cleanup expires listings instead of deleting them");
  assertIncludes(cleanupScript, "ownerKennelId: null", "cleanup only targets unowned inventory");
  assertIncludes(cleanupScript, "isFoundation: true", "cleanup only targets foundation dogs");

  const studsPage = source("apps/web/app/studs/page.tsx");
  assertIncludes(studsPage, "isActive: true", "stud breed selector filters active breeds");

  const kennelTopTenPage = source("apps/web/app/kennels/top-ten/page.tsx");
  assertIncludes(
    kennelTopTenPage,
    "isActive: true",
    "kennel top-ten breed selector filters active breeds"
  );

  const seedSource = source("apps/web/prisma/seed.ts");
  assertIncludes(seedSource, "const name = row.breed_name.trim();", "seed maps breed_name to Breed.name");
  assertIncludes(seedSource, "groupName: row.group.trim()", "seed maps group to Breed.groupName");
  assertIncludes(
    seedSource,
    "releaseVersion !== null && releaseVersion <= CURRENT_BREED_RELEASE",
    "seed controls isActive from release_version"
  );

  const dogService = source("apps/web/server/services/dog.service.ts");
  assert.match(
    dogService,
    /breed:\s*\{\s*select:\s*\{\s*name:\s*true\s*\},\s*\},/,
    "dog profile display still reads breed name through existing breedCode2"
  );

  console.log("Breed visibility checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
