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
  "Filters",
  "kennel roster renders the filter sidebar"
);
assertIncludes(
  kennelPanel,
  "xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)]",
  "kennel roster uses the planned three-column desktop layout"
);
assertIncludes(
  kennelPanel,
  "theme-card order-1 rounded-2xl p-4 xl:order-3",
  "kennel runs render as the right sidebar on desktop and first on mobile"
);
assertIncludes(
  kennelPanel,
  "theme-card order-2 rounded-2xl p-4 xl:order-1",
  "filters render as the left sidebar on desktop and second on mobile"
);
assertIncludes(
  kennelPanel,
  "order-3 min-w-0 xl:order-2",
  "dog roster renders in the center column on desktop and after sidebars on mobile"
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
assertIncludes(
  kennelPanel,
  "Select All Visible",
  "kennel roster offers a visible-only selection control"
);
assertIncludes(
  kennelPanel,
  "Clear Selection",
  "kennel roster can clear selected dogs"
);
assertIncludes(
  kennelPanel,
  "checked={selectedDogIds.includes(dog.dogId)}",
  "kennel roster renders selected-state checkboxes per visible dog"
);
assertIncludes(
  kennelPanel,
  "onChange={() => toggleDogSelection(dog.dogId)}",
  "kennel roster checkboxes toggle dog IDs"
);
assertIncludes(
  kennelPanel,
  "const visibleIdSet = new Set(filteredDogIds);",
  "Select All Visible is based on currently filtered dog IDs"
);
assertIncludes(
  kennelPanel,
  "Array.from(new Set([...current, ...filteredDogIds]))",
  "Select All Visible selects only filtered dog IDs"
);
assertIncludes(
  kennelPanel,
  "current.filter((dogId) => filteredDogIds.includes(dogId))",
  "selection is pruned when filters or selected runs hide dogs"
);
assertIncludes(
  kennelPanel,
  "Move selected dogs",
  "kennel roster renders the move-selected panel"
);
assertIncludes(
  kennelPanel,
  "Choose Kennel Run...",
  "move panel requires a real Kennel Run target"
);
assertIncludes(
  kennelPanel,
  "Move Dogs",
  "move panel renders the move action"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/dogs/run"',
  "move panel calls the existing Kennel Run move API"
);
assertIncludes(
  kennelPanel,
  'method: "PATCH"',
  "move panel uses PATCH for dog movement"
);
assertIncludes(
  kennelPanel,
  "dogIds: dogIdsToMove",
  "move panel sends selected dog IDs"
);
assertIncludes(
  kennelPanel,
  "targetRunId: selectedMoveRunId",
  "move panel sends the selected target run ID"
);
assertIncludes(
  kennelPanel,
  "await loadRuns();",
  "successful movement refreshes run counts"
);
assertIncludes(
  kennelPanel,
  "await loadDogs({ preserveLoadingState: true, runIds: selectedRunIds });",
  "successful movement refreshes the current dog view"
);
assertIncludes(
  kennelPanel,
  "clearSelection();",
  "successful movement clears selection"
);
assertIncludes(
  kennelPanel,
  "Failed to move selected dogs.",
  "failed movement shows an error"
);
assertIncludes(
  kennelPanel,
  "Current Run:",
  "multi-run view can show each dog's current run after movement"
);
assertIncludes(
  kennelPanel,
  "+ Run",
  "Kennel Runs sidebar renders a compact create run control"
);
assertIncludes(
  kennelPanel,
  "Run name",
  "create run form labels the run name field"
);
assertIncludes(
  kennelPanel,
  "Create Run",
  "create run form renders a submit action"
);
assertIncludes(
  kennelPanel,
  "const canCreateRun = newRunName.trim().length > 0 && !creatingRun;",
  "blank run names cannot be submitted"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/runs",',
  "create run calls the Kennel Runs collection API"
);
assertIncludes(
  kennelPanel,
  'method: "POST"',
  "create run uses POST"
);
assertIncludes(
  kennelPanel,
  "setSelectedRunIds([data.run.id]);",
  "newly created run is selected predictably"
);
assertIncludes(
  kennelPanel,
  "!run.isSystem",
  "rename/delete controls render only for non-system runs"
);
assertIncludes(
  kennelPanel,
  "Rename Run",
  "non-system runs expose a rename control"
);
assertIncludes(
  kennelPanel,
  "startRenameRun(run)",
  "rename action opens the inline rename form for that run"
);
assertIncludes(
  kennelPanel,
  'fetch(`/api/kennel/runs/${renamingRunId}`',
  "rename calls the run detail API"
);
assertIncludes(
  kennelPanel,
  'method: "PATCH"',
  "rename uses PATCH"
);
assertIncludes(
  kennelPanel,
  "Delete Run",
  "non-system runs expose a delete control"
);
assertIncludes(
  kennelPanel,
  "Dogs in this run will move to Uncategorized.",
  "delete confirmation explains dog movement"
);
assertIncludes(
  kennelPanel,
  'fetch(`/api/kennel/runs/${run.id}`',
  "delete calls the run detail API"
);
assertIncludes(
  kennelPanel,
  'method: "DELETE"',
  "delete uses DELETE"
);
assertIncludes(
  kennelPanel,
  "nextSelectedRunIds.length > 0",
  "deleting a selected run preserves remaining selected runs"
);
assertIncludes(
  kennelPanel,
  "uncategorizedRun",
  "deleting the last selected run falls back to Uncategorized"
);
assertIncludes(
  kennelPanel,
  "Moved ${",
  "delete success can include moved dog count"
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
