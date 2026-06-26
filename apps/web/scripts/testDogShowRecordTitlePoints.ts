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

function assertDoesNotInclude(
  haystack: string,
  needle: string,
  label: string
): void {
  assert.equal(haystack.includes(needle), false, label);
}

const dogService = source("apps/web/server/services/dog.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");
const dogProfileDashboard = source(
  "apps/web/components/dogs/DogProfileDashboard.tsx"
);
const dogShowRecordTable = source(
  "apps/web/components/dogs/DogShowRecordTable.tsx"
);
const myResultsPage = source("apps/web/app/my-results/page.tsx");
const titlePoints = source("apps/web/lib/titlePoints.ts");

assertIncludes(
  titlePoints,
  "export function buildTitlePointsDisplay",
  "shared helper builds title-aware points display objects"
);
assertIncludes(
  titlePoints,
  'track: "CH" | "GCH" | null;',
  "title-aware points display distinguishes CH, GCH, and zero-point rows"
);
assertIncludes(
  titlePoints,
  'label: "GCH pts"',
  "GCH credit rows display a GCH points label"
);
assertIncludes(
  titlePoints,
  'label: "CH pts"',
  "CH point rows display a CH points label"
);
assertIncludes(
  titlePoints,
  'label: "pts"',
  "zero-title-point rows keep a neutral points label"
);
assertIncludes(
  titlePoints,
  'display.isMajor ? " major" : ""',
  "shared formatter includes major text when the displayed title track is major"
);
assertIncludes(
  dogMapper,
  "titlePointsDisplay",
  "dog show result DTO exposes a title-aware points display"
);
assertIncludes(
  dogService,
  "grandChampionCredit",
  "dog show record service reads per-award GCH credits"
);
assertIncludes(
  dogService,
  "buildTitlePointsDisplay",
  "dog show record service uses the shared title-aware points helper"
);
assertIncludes(
  dogProfileDashboard,
  "result.titlePointsDisplay.value",
  "recent show record renders the title-aware points value"
);
assertIncludes(
  dogProfileDashboard,
  "result.titlePointsDisplay.label",
  "recent show record renders the title-aware points label"
);
assertDoesNotInclude(
  dogProfileDashboard,
  "result.pointsAwarded} pt",
  "recent show record no longer renders raw CH-only points"
);
assertIncludes(
  dogShowRecordTable,
  "result.titlePointsDisplay.value",
  "full show record renders the title-aware points value"
);
assertIncludes(
  dogShowRecordTable,
  "result.titlePointsDisplay.label",
  "full show record renders the title-aware points label"
);
assertIncludes(
  dogShowRecordTable,
  "result.titlePointsDisplay.isMajor",
  "full show record major badge follows the displayed title point track"
);
assertDoesNotInclude(
  dogShowRecordTable,
  "{result.pointsAwarded}",
  "full show record no longer renders raw CH-only points"
);
assertIncludes(
  myResultsPage,
  "Title Points",
  "my results labels the column as title points"
);
assertIncludes(
  myResultsPage,
  "grandChampionCredit",
  "my results reads per-award GCH credits"
);
assertIncludes(
  myResultsPage,
  "buildTitlePointsDisplay",
  "my results uses the shared title-aware points helper"
);
assertIncludes(
  myResultsPage,
  "formatTitlePointsDisplay",
  "my results uses the shared title-aware points formatter"
);
assertIncludes(
  myResultsPage,
  "&mdash;",
  "my results displays a dash for rows without title points"
);
assertDoesNotInclude(
  myResultsPage,
  "CH Points",
  "my results no longer has a CH-only points column"
);

console.log("Dog show record title-point display checks passed.");
