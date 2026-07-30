import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertNotIncludes(
  haystack: string,
  needle: string,
  label: string
): void {
  assert.equal(haystack.includes(needle), false, label);
}

const myResultsPage = source("apps/web/app/my-results/page.tsx");
const schema = source("apps/web/prisma/schema.prisma");

assertIncludes(
  schema,
  "groupJudgeAssignments         ShowDayGroupJudgeAssignment[]",
  "schema exposes persisted ShowDay group-judge assignments"
);
assertIncludes(
  schema,
  "judge   Judge       @relation(fields: [judgeId], references: [id])",
  "schema keeps ShowDay judge as a separate persisted relation"
);

assertIncludes(
  myResultsPage,
  "groupJudgeAssignments",
  "My Results fetches the batched ShowDay group-judge assignments"
);
assertIncludes(
  myResultsPage,
  "resolveBreedGroupNameToCanonicalShowGroupCode",
  "My Results resolves breeds through the canonical group mapping"
);
assertIncludes(
  myResultsPage,
  "const showGroups = new Map",
  "My Results groups rows by show before rendering"
);
assertIncludes(
  myResultsPage,
  "breedEntriesByCode: new Map()",
  "My Results nests breeds inside each show group"
);
assertIncludes(
  myResultsPage,
  "breedSections: [...showGroup.breedSections].sort((a, b) =>",
  "breed subsections are alphabetized by breed name"
);
assertIncludes(
  myResultsPage,
  "breedSection.rows.push(entry)",
  "rows remain grouped under each breed subsection"
);
assertIncludes(
  myResultsPage,
  "Group Judge:",
  "breed subsection metadata shows the group judge label"
);
assertIncludes(
  myResultsPage,
  "BIS Judge:",
  "breed subsection metadata shows the BIS judge label"
);
assertIncludes(
  myResultsPage,
  "Judge unavailable",
  "missing historical judge assignments fall back explicitly"
);
assertIncludes(
  myResultsPage,
  "entry.showDay.judge?.name ?? null",
  "BIS judge attribution comes from the persisted ShowDay judge relation"
);
assertIncludes(
  myResultsPage,
  "candidate.groupCode === groupCode",
  "group judge attribution matches the breed's canonical group assignment"
);
assertNotIncludes(
  myResultsPage,
  "entry.showDay.judgeId === groupCode",
  "group judge is never inferred from the ShowDay BIS judge id"
);
assertNotIncludes(
  myResultsPage,
  "Group Judge: {entry.showDay.judge",
  "group judge is never rendered directly from ShowDay.judge"
);

console.log("My Results breed-grouping checks passed.");
