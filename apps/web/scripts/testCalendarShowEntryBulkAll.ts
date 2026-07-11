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

function assertNotIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(!haystack.includes(needle), label);
}

const planner = source("apps/web/app/shows/[showId]/ShowEntryPlanner.tsx");
const showPage = source("apps/web/app/shows/[showId]/page.tsx");
const showEntryService = source("apps/web/server/services/showEntry.service.ts");
const showEntryRoute = source("apps/web/app/api/shows/[showId]/enter/route.ts");
const dogFirstPlanner = source(
  "apps/web/app/dogs/[dogId]/show-entry/DogShowEntryPlannerClient.tsx"
);

assertIncludes(
  planner,
  "Enter All Eligible Dogs",
  "calendar planner renders the new bulk-entry trigger"
);
assertIncludes(
  planner,
  "Confirm All Entries",
  "calendar planner requires a final explicit bulk confirmation action"
);
assertIncludes(
  planner,
  'name="entryMode" value="ALL_ELIGIBLE"',
  "bulk calendar submit marks the all-eligible mode"
);
assertIncludes(
  planner,
  "bulkEligibleSelections.length",
  "bulk calendar summary counts total entries from canonical eligible selections"
);
assertIncludes(
  planner,
  "bulkSkippedSelectionCount",
  "bulk calendar summary reports skipped combinations"
);
assertIncludes(
  planner,
  "Copy to Manual Selection",
  "bulk calendar flow preserves the manual selection workflow"
);

assertIncludes(
  showPage,
  "bulkEligibleSelections={planner.bulkEligibleSelections}",
  "show page passes breed-scoped bulk selections into the planner"
);
assertIncludes(
  showPage,
  "bulkSkippedSelectionCount={planner.bulkSkippedSelectionCount}",
  "show page passes the precomputed skipped count into the planner"
);

assertIncludes(
  showEntryService,
  "bulkEligibleSelections: BulkShowEntrySelection[];",
  "show entry planner DTO exposes breed-scoped bulk selections"
);
assertIncludes(
  showEntryService,
  'mode?: "SELECTED" | "ALL_ELIGIBLE";',
  "show entry service supports a distinct all-eligible submission mode"
);
assertIncludes(
  showEntryService,
  'mode === "ALL_ELIGIBLE"',
  "show entry service skips stale or conflicting combinations during bulk submission"
);
assertIncludes(
  showEntryService,
  "skippedSelections",
  "show entry service returns skipped combination counts"
);
assertIncludes(
  showEntryService,
  "bulkSkippedSelectionCount += 1;",
  "show entry planner counts ineligible or already-entered combinations"
);

assertIncludes(
  showEntryRoute,
  'String(formData.get("entryMode") ?? "").trim() === "ALL_ELIGIBLE"',
  "show entry route recognizes the bulk all-eligible submission mode"
);
assertIncludes(
  showEntryRoute,
  "result.skippedSelections",
  "show entry route reports skipped combinations after bulk submission"
);

assertNotIncludes(
  dogFirstPlanner,
  "Confirm All Entries",
  "dog-first planner remains unchanged by the calendar bulk-entry confirmation UI"
);
assertNotIncludes(
  dogFirstPlanner,
  "entryMode",
  "dog-first planner does not adopt the calendar bulk-entry mode"
);

console.log("Calendar bulk show-entry checks passed.");
