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
  "const bulkActionLabel =",
  "calendar planner derives the bulk-entry trigger label from the active scope"
);
assertIncludes(
  planner,
  "Confirm All Entries",
  "calendar planner requires a final explicit bulk confirmation action"
);
assertIncludes(
  planner,
  'name="scopeType" value={scope.type}',
  "calendar planner posts an explicit planner scope"
);
assertIncludes(
  planner,
  "Enter All Eligible Dogs in",
  "calendar planner supports kennel-run bulk-entry copy"
);
assertIncludes(
  planner,
  "dog.breedName",
  "calendar planner preserves breed info in mixed-breed run rows"
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
  showPage,
  "listShowEntryKennelRunOptions",
  "show page loads kennel-run planner options"
);
assertIncludes(
  showPage,
  "<ShowEntryPlannerScopeForm",
  "show page renders the mutually exclusive breed/run scope picker"
);
assertIncludes(
  showPage,
  "scope={planner.scope}",
  "show page passes the canonical planner scope into the planner"
);
assertIncludes(
  showPage,
  "No dogs in this kennel run are currently eligible for an open show day.",
  "show page renders the run-specific empty eligibility message"
);
assertIncludes(
  showPage,
  "There are no dogs in this kennel run.",
  "show page renders the empty run message"
);

assertIncludes(
  showEntryService,
  'type: "KENNEL_RUN";',
  "show entry service supports kennel-run planner scope"
);
assertIncludes(
  showEntryService,
  "listShowEntryKennelRunOptions",
  "show entry service exposes kennel-run planner options"
);
assertIncludes(
  showEntryService,
  "existingDogIdsByBreed: Record<string, string[]>;",
  "show entry planner DTO exposes canonical existing entries across breeds"
);
assertIncludes(
  showEntryService,
  "dog.kennelRunId !== resolvedScope.kennelRunId",
  "show entry submission revalidates current kennel-run membership"
);
assertIncludes(
  showEntryService,
  "breedCode2: dog.breedCode2",
  "show entry submission preserves mixed-breed run entries by dog breed"
);
assertIncludes(
  showEntryService,
  "getSelectionBlockKey(selection.showDayId, dog.breedCode2)",
  "show entry submission creates judging blocks per day and breed in run mode"
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
  'String(formData.get("scopeType") ?? "").trim()',
  "show entry route recognizes the submitted planner scope"
);
assertIncludes(
  showEntryRoute,
  "kennelRunId",
  "show entry route preserves kennel-run planner selection"
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
  planner,
  "Copy to Manual Selection",
  "bulk calendar flow removes the copy-to-manual shortcut"
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
