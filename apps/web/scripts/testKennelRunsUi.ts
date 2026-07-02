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

function assertExcludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), label);
}

const kennelPanel = source("apps/web/components/kennel/KennelDogsPanel.tsx");

assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/runs"',
  "kennel roster loads Kennel Runs from the runs API"
);
assertIncludes(
  kennelPanel,
  'url.searchParams.set("runId"',
  "kennel roster requests dogs for a single selected run"
);
assertIncludes(
  kennelPanel,
  'url.searchParams.set("runIds"',
  "kennel roster requests dogs for multiple selected runs"
);
assertIncludes(
  kennelPanel,
  "Kennel Runs",
  "kennel roster labels the selector as Kennel Runs"
);
assertIncludes(
  kennelPanel,
  "Uncategorized",
  "kennel roster defaults back to the system Uncategorized run"
);
assertIncludes(
  kennelPanel,
  "Select All Runs",
  "kennel roster supports viewing all runs without creating an All Dogs run"
);
assertIncludes(
  kennelPanel,
  "Clear All Filters",
  "kennel roster retains a clear filters control"
);
assertIncludes(
  kennelPanel,
  "This run is empty.",
  "kennel roster distinguishes an empty selected run"
);
assertIncludes(
  kennelPanel,
  "No dogs match the current filters.",
  "kennel roster distinguishes a filtered empty result"
);

assertExcludes(
  kennelPanel,
  "Kennel Areas",
  "legacy area selector label is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Create Area",
  "legacy area creation UI is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "New area name",
  "legacy area naming input is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Add to Area",
  "legacy area bulk add action is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Remove from Area",
  "legacy area bulk remove action is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Choose area",
  "legacy area target picker is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "No custom areas",
  "legacy custom area empty state is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Delete kennel area",
  "legacy area delete UI is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "areaIds",
  "kennel roster no longer filters dogs by legacy area memberships"
);
assertExcludes(
  kennelPanel,
  "/api/kennel/areas",
  "kennel roster no longer calls legacy kennel area routes"
);
assertExcludes(
  kennelPanel,
  "activeAreaId",
  "kennel roster no longer tracks a legacy active area"
);
assertExcludes(
  kennelPanel,
  "?areaId=",
  "kennel roster no longer adds legacy area context to dog profile links"
);

console.log("Kennel Runs UI source checks passed.");
