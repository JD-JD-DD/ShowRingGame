import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatBulkHealthTestCompletion } from "../components/kennel/bulkHealthTestFeedback";

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

const kennelPanel = source("apps/web/components/kennel/KennelDogsPanel.tsx");
const kennelRunFiltering = source(
  "apps/web/components/kennel/kennelDogFiltering.ts"
);
const kennelDogSearch = source("apps/web/components/kennel/kennelDogSearch.ts");
const bulkHealthTestFeedback = source(
  "apps/web/components/kennel/bulkHealthTestFeedback.ts"
);
const mineDogsRoute = source("apps/web/app/api/dogs/mine/route.ts");
const bulkCallNameEditor = source("apps/web/components/kennel/BulkCallNameEditor.tsx");
const closeActiveBulkWorkspaceSection = kennelPanel.slice(
  kennelPanel.indexOf("function closeActiveBulkWorkspace()"),
  kennelPanel.indexOf("\n  function hasColumn")
);
const bulkHealthTestExecutionSection = kennelPanel.slice(
  kennelPanel.indexOf("async function runBulkHealthTests()"),
  kennelPanel.indexOf("async function moveSelectedDogs()")
);
const bulkHealthTestFailureSection = bulkHealthTestExecutionSection.slice(
  bulkHealthTestExecutionSection.indexOf("} catch (executionError)"),
  bulkHealthTestExecutionSection.indexOf("} finally")
);

assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/runs"',
  "kennel roster loads Kennel Runs from the runs API"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/dogs/mine"',
  "kennel roster loads one canonical full-roster dog collection"
);
assertIncludes(
  kennelPanel,
  'const [searchText, setSearchText] = useState("");',
  "kennel roster tracks local search text"
);
assertIncludes(
  kennelPanel,
  "const normalizedQuery = searchText.trim().toLowerCase();",
  "kennel roster normalizes search text once per visible-dog derivation"
);
assertIncludes(
  kennelPanel,
  "matchesKennelDogSearch(dog, normalizedQuery)",
  "search is part of the existing visible-dog filter pipeline"
);
assertIncludes(
  kennelDogSearch,
  "dog.callName, dog.registeredName, dog.regNumber",
  "search uses only the approved dog identity fields"
);
assertIncludes(
  kennelPanel,
  "Search dogs",
  "kennel roster renders a semantic search label"
);
assertIncludes(
  kennelPanel,
  '<label className="grid gap-1.5">\n              <span className="theme-label text-[0.7rem] uppercase tracking-wide">\n                Search dogs',
  "Search dogs has a programmatically associated wrapping label"
);
assertIncludes(
  kennelPanel,
  'type="text"',
  "search uses a keyboard-semantic text input"
);
assertIncludes(
  kennelPanel,
  'className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"',
  "search uses the existing themed control focus treatment and full available width"
);
assertIncludes(
  kennelPanel,
  "Call name, registered name, or registration number",
  "kennel roster explains searchable identity fields"
);
assertBefore(
  kennelPanel,
  "Search dogs",
  "All Breeds",
  "search renders above Breed in the Filters panel"
);
assertIncludes(
  kennelPanel,
  "setSearchText(\"\");",
  "Clear All Filters clears local search text"
);
assertIncludes(
  kennelPanel,
  "Boolean(searchText.trim()) ||",
  "search counts as an active filter for empty-state behavior"
);
assertIncludes(
  kennelPanel,
  "searchMatch &&\n        breedMatch &&",
  "search remains conjunctive with existing roster filters"
);
for (const existingFilter of [
  "sexMatch &&",
  "breedableMatch &&",
  "forSaleMatch &&",
  "atStudMatch &&",
  "groomingMatch",
]) {
  assertIncludes(
    kennelPanel,
    existingFilter,
    `search remains conjunctive with ${existingFilter.replace(" &&", "")}`
  );
}
assertBefore(
  kennelPanel,
  "const searchMatch = matchesKennelDogSearch(dog, normalizedQuery);",
  "list.sort((a, b) => {",
  "search membership is decided before existing sorting"
);
assertIncludes(
  kennelPanel,
  "searchText,\n    breedFilter",
  "displayed-dog memo depends on search text"
);
assertExcludes(
  kennelPanel,
  "fetch(\"/api/dogs/mine?",
  "search does not add roster query parameters or per-keystroke requests"
);
assertExcludes(
  kennelPanel,
  "setTimeout(",
  "search does not add debounce or timer behavior"
);
for (const rosterPredicate of [
  "ownerKennelId: kennel.id",
  'lifecycleState: "ALIVE"',
  "isPlayerVisible: true",
]) {
  assertIncludes(
    mineDogsRoute,
    rosterPredicate,
    `canonical active roster retains ${rosterPredicate}`
  );
}
assertIncludes(
  kennelRunFiltering,
  "filterDogsBySelectedRuns",
  "kennel roster has a single run-membership filter"
);
assertIncludes(
  kennelPanel,
  "filterDogsBySelectedRuns(allDogs, runs, selectedRunIds)",
  "run membership is derived from the full roster before display filters"
);
assertExcludes(
  kennelPanel,
  'url.searchParams.set("runId"',
  "run selection does not launch a request that can race with another run"
);
assertIncludes(
  kennelPanel,
  "Kennel Runs",
  "kennel roster labels the selector as Kennel Runs"
);
assertIncludes(
  kennelPanel,
  "selectedRunIds.length !== 1",
  "Bulk Naming closes when selection is not exactly one run"
);
assertIncludes(
  kennelPanel,
  "{selectedRun ? (",
  "Bulk Naming is available only for exactly one selected run"
);
assertIncludes(kennelPanel, "Bulk Naming", "kennel roster exposes Bulk Naming");
assertIncludes(
  kennelPanel,
  "dogs={runFilteredDogs}",
  "Bulk Naming uses selected-run dogs before search and roster filters"
);
assertIncludes(
  kennelPanel,
  "loadDogs({ preserveLoadingState: true })",
  "Bulk Naming preserves local roster state while refreshing dogs"
);
assertIncludes(bulkCallNameEditor, "regNumber", "Bulk Naming displays registration numbers");
assertIncludes(bulkCallNameEditor, "&middot; {dog.sex}", "Bulk Naming displays the stored sex inline after registration");
assertIncludes(bulkCallNameEditor, "dog.registeredName ?", "existing registered names stay read-only");
assertIncludes(bulkCallNameEditor, 'placeholder="Registered name"', "blank registered names expose an editor");
assertIncludes(bulkCallNameEditor, "maxLength={MAX_CALL_NAME_LENGTH}", "Bulk Naming uses the canonical call-name limit");
assertIncludes(bulkCallNameEditor, "callName: callNames[dog.dogId]", "Bulk Naming submits only editable call names");
assertIncludes(bulkCallNameEditor, "Confirm permanent registered names.", "registered-name assignments require confirmation");
assertIncludes(bulkCallNameEditor, "hasNewRegisteredNames && !confirmingRegisteredNames", "call-name-only saves skip permanence confirmation");
assertIncludes(
  kennelPanel,
  "Uncategorized",
  "kennel roster defaults back to the system Uncategorized run"
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
  "const visibleIdSet = new Set(displayedDogIds);",
  "Select All Visible is based on currently filtered dog IDs"
);
assertIncludes(
  kennelPanel,
  "Array.from(new Set([...current, ...displayedDogIds]))",
  "Select All Visible selects only filtered dog IDs"
);
assertIncludes(
  kennelPanel,
  "current.filter((dogId) => displayedDogIds.includes(dogId))",
  "selection is pruned when filters or selected runs hide dogs"
);
assertIncludes(
  kennelPanel,
  "Move selected dogs",
  "kennel roster renders the move-selected panel"
);
assertIncludes(
  kennelPanel,
  'type ConfigurableBulkWorkspace = "move-dogs";',
  "kennel roster has one explicit configurable bulk workspace state"
);
assertIncludes(
  kennelPanel,
  'const [activeBulkWorkspace, setActiveBulkWorkspace] =',
  "kennel roster tracks the active configurable workspace locally"
);
assertIncludes(
  kennelPanel,
  '<option value="move-dogs">Move Dogs</option>',
  "Move Dogs opens from the normal bulk action controls"
);
assertIncludes(
  kennelPanel,
  'activeBulkWorkspace === "move-dogs"',
  "only the active Move Dogs workspace renders"
);
assertIncludes(
  kennelPanel,
  "function closeActiveBulkWorkspace()",
  "Move Dogs has a narrowly scoped workspace close helper"
);
assertIncludes(
  kennelPanel,
  "onClick={closeActiveBulkWorkspace}",
  "Move Dogs Cancel closes the workspace without clearing dog selection"
);
assertExcludes(
  closeActiveBulkWorkspaceSection,
  "setSelectedDogIds",
  "Move Dogs Cancel preserves the current dog selection"
);
assertIncludes(
  kennelPanel,
  "setSelectedMoveRunId(\"\");",
  "closing the Move Dogs workspace resets its target run"
);
assertIncludes(
  kennelPanel,
  "setActiveBulkWorkspace(null);",
  "clearing selection and empty-selection state close stale workspaces"
);
assertIncludes(
  kennelPanel,
  'type ConfigurableBulkWorkspace = "move-dogs" | "health-tests" | "brucellosis";',
  "Health Tests is part of the single active workspace state"
);
assertIncludes(
  kennelPanel,
  '<option value="health-tests">Health Tests...</option>',
  "Health Tests appears in the existing bulk action selector"
);
assertIncludes(
  kennelPanel,
  '<option value="brucellosis">Brucellosis Test</option>',
  "Brucellosis Test appears separately in the bulk action selector"
);
assertIncludes(
  kennelPanel,
  'setActiveBulkWorkspace("brucellosis");',
  "Brucellosis opens as the active inline workspace"
);
assertIncludes(
  kennelPanel,
  'activeBulkWorkspace === "brucellosis"',
  "Brucellosis renders only as the active workspace"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/dogs/brucellosis/preview",',
  "Brucellosis posts only to its preview route"
);
assertIncludes(
  kennelPanel,
  'body: JSON.stringify({ dogIds: selectedDogIds })',
  "Brucellosis preview sends only the current selected dogs"
);
assertIncludes(
  kennelPanel,
  "brucellosisPreviewRequestSequence",
  "Brucellosis preview protects against stale responses"
);
assertIncludes(
  kennelPanel,
  "Calculating brucellosis screening estimate...",
  "Brucellosis has a local loading state"
);
assertIncludes(
  kennelPanel,
  "Unable to calculate the brucellosis screening estimate.",
  "Brucellosis has a safe local error fallback"
);
assertIncludes(
  kennelPanel,
  "will be tested",
  "Brucellosis preview summarizes screenable dogs"
);
assertIncludes(
  kennelPanel,
  "bulk-brucellosis-preview-details",
  "Brucellosis details use a controlled semantic disclosure region"
);
assertIncludes(
  kennelPanel,
  'label: "Not currently eligible"',
  "Brucellosis lifecycle skips have player-facing copy"
);
assertIncludes(
  kennelPanel,
  'label: "No longer available"',
  "Brucellosis ownership skips have player-facing copy"
);
const brucellosisWorkspaceSection = kennelPanel.slice(
  kennelPanel.indexOf('activeBulkWorkspace === "brucellosis"'),
  kennelPanel.indexOf('{bulkAction === "rehome"')
);
assertIncludes(
  brucellosisWorkspaceSection,
  "Run Brucellosis Tests",
  "Brucellosis has a functional execution action"
);
assertIncludes(
  kennelPanel,
  "onClick={runBulkBrucellosisTests}",
  "Brucellosis execution control invokes its bulk handler"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/dogs/brucellosis",',
  "Brucellosis execution posts to the bulk execution route"
);
assertIncludes(
  kennelPanel,
  "disabled={!canRunBrucellosisTests}",
  "Brucellosis execution requires a current screenable preview"
);
assertIncludes(
  kennelPanel,
  "brucellosisPreviewDogIdsKey === selectedDogIds.join(\",\")",
  "Brucellosis execution rejects stale previews"
);
assertIncludes(
  kennelPanel,
  "Running brucellosis screenings...",
  "Brucellosis execution has local progress feedback"
);
assertIncludes(
  kennelPanel,
  "No brucellosis screenings were run.",
  "zero-execution Brucellosis feedback is useful"
);
const bulkBrucellosisExecutionSection = kennelPanel.slice(
  kennelPanel.indexOf("async function runBulkBrucellosisTests()"),
  kennelPanel.indexOf("async function moveSelectedDogs()")
);
assertExcludes(
  bulkBrucellosisExecutionSection,
  "clearSelection();",
  "successful Brucellosis execution preserves selected dogs"
);
for (const stateSetter of [
  "setSelectedRunIds(",
  "setSearchText(",
  "setBreedFilter(",
  "setSortKey(",
  "setSortDirection(",
  "window.location",
  "router.",
]) {
  assertExcludes(
    bulkBrucellosisExecutionSection,
    stateSetter,
    `Brucellosis execution preserves roster context without ${stateSetter}`
  );
}
assertIncludes(
  bulkBrucellosisExecutionSection,
  "setActiveBulkWorkspace(null);",
  "successful Brucellosis execution closes its workspace"
);
assertIncludes(
  bulkBrucellosisExecutionSection,
  "setBrucellosisExecutionError(",
  "failed Brucellosis execution keeps feedback local"
);
assertExcludes(
  bulkBrucellosisExecutionSection,
  "estimatedTotalCost",
  "Brucellosis execution does not submit preview pricing as authority"
);
assertExcludes(
  brucellosisWorkspaceSection,
  "clearSelection();",
  "Brucellosis Cancel preserves selected dogs"
);
assertIncludes(
  kennelPanel,
  'setActiveBulkWorkspace("health-tests");',
  "Health Tests opens as the active inline workspace"
);
assertIncludes(
  kennelPanel,
  'activeBulkWorkspace === "health-tests"',
  "Health Tests renders only as the active workspace"
);
assertIncludes(
  kennelPanel,
  "resetHealthTestingWorkspaceState();",
  "workspace switches and cancellation reset local health preview state"
);
assertIncludes(
  kennelPanel,
  'useState(true)',
  "Health Tests defaults to All applicable"
);
for (const code of [
  "HIP_DYSPLASIA",
  "ELBOW_DYSPLASIA",
  "CARDIAC",
  "THYROID",
  "CAER_EYE",
]) {
  assertIncludes(
    kennelPanel,
    `code: "${code}"`,
    `Health Tests maps the ${code} checkbox to its canonical code`
  );
}
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/dogs/health-tests/preview"',
  "Health Tests posts only to the read-only preview route"
);
assertIncludes(
  kennelPanel,
  "dogIds: selectedDogIds",
  "health previews use the current selected dog IDs"
);
assertIncludes(
  kennelPanel,
  '{ mode: "all-applicable" }',
  "All applicable uses the preview route's canonical request shape"
);
assertIncludes(
  kennelPanel,
  '{ mode: "explicit", testTypeCodes: selectedHealthTestCodes }',
  "explicit Health Tests uses the preview route's canonical request shape"
);
assertIncludes(
  kennelPanel,
  "selectedHealthTestCodes.length === 0",
  "zero explicit test selections do not send invalid preview requests"
);
assertIncludes(
  kennelPanel,
  "healthTestPreviewRequestSequence",
  "health previews use request sequencing to reject stale responses"
);
assertIncludes(
  kennelPanel,
  "Calculating health-test estimate...",
  "Health Tests has an inline loading state"
);
assertIncludes(
  kennelPanel,
  "healthTestPreviewError",
  "Health Tests keeps preview errors local to its workspace"
);
for (const field of [
  "eligibleDogCount",
  "runnableTestCount",
  "estimatedTotalCost",
]) {
  assertIncludes(
    kennelPanel,
    `healthTestPreview.${field}`,
    `Health Tests summary uses ${field}`
  );
}
assertIncludes(
  kennelPanel,
  'aria-expanded={healthTestDetailsExpanded}',
  "Health Test details disclosure has semantic expanded state"
);
assertIncludes(
  kennelPanel,
  'aria-controls="bulk-health-test-preview-details"',
  "Health Test details disclosure controls its associated region"
);
assertIncludes(
  kennelPanel,
  "Run Health Tests",
  "Health Tests has a functional execution control"
);
assertIncludes(
  kennelPanel,
  "onClick={runBulkHealthTests}",
  "Health Tests execution button invokes the bulk execution handler"
);
assertIncludes(
  kennelPanel,
  'fetch("/api/kennel/dogs/health-tests",',
  "Health Tests posts to the bulk execution route"
);
assertIncludes(
  kennelPanel,
  "disabled={!canRunHealthTests}",
  "Health Tests execution is disabled without a current runnable quote"
);
assertIncludes(
  kennelPanel,
  "healthTestExecutionLoading",
  "Health Tests blocks duplicate execution while a request is running"
);
assertIncludes(
  kennelPanel,
  "healthTestPreviewConfigurationKey === currentHealthTestConfigurationKey",
  "Health Tests execution requires a preview for the current cohort and configuration"
);
assertIncludes(
  kennelPanel,
  "await loadDogs({ preserveLoadingState: true });",
  "successful Health Tests execution refreshes roster data without resetting the page"
);
assertExcludes(
  bulkHealthTestExecutionSection,
  "clearSelection();",
  "successful Health Tests execution preserves selected dogs"
);
assertIncludes(
  bulkHealthTestExecutionSection,
  "setMessage(formatBulkHealthTestCompletion(data.result));",
  "Health Tests completion feedback uses the authoritative execution response"
);
for (const responseField of [
  "testedDogCount",
  "executedTestCount",
  "totalCharged",
  "skippedByReason",
]) {
  assertIncludes(
    bulkHealthTestFeedback,
    `result.${responseField}`,
    `Health Tests completion feedback uses execution ${responseField}`
  );
}
assertIncludes(
  bulkHealthTestFeedback,
  "completed tests were skipped",
  "Health Tests completion feedback explains completed-test skips"
);
assertIncludes(
  bulkHealthTestFeedback,
  "tests were skipped because dogs are too young",
  "Health Tests completion feedback explains maturity skips"
);
assertIncludes(
  bulkHealthTestFeedback,
  "tests were skipped because they do not apply to the breed",
  "Health Tests completion feedback explains breed-applicability skips"
);
assertIncludes(
  bulkHealthTestFeedback,
  "tests were skipped because dogs are not currently eligible",
  "Health Tests completion feedback explains lifecycle skips"
);
assertIncludes(
  bulkHealthTestFeedback,
  "tests were skipped because dogs are no longer available",
  "Health Tests completion feedback explains ownership skips"
);
assertIncludes(
  bulkHealthTestFeedback,
  "No health tests were run.",
  "zero-execution Health Tests completion has useful feedback"
);
const noSkips = {
  ALREADY_COMPLETED: 0,
  TOO_YOUNG: 0,
  NOT_APPLICABLE_TO_BREED: 0,
  NOT_ALIVE: 0,
  NOT_OWNED_OR_NOT_FOUND: 0,
};
assert.equal(
  formatBulkHealthTestCompletion({
    testedDogCount: 1,
    executedTestCount: 1,
    totalCharged: 500,
    skippedByReason: noSkips,
  }),
  "Health testing complete: 1 test run on 1 dog. Total charged: $500.",
  "one-test completion feedback is grammatically correct"
);
assert.equal(
  formatBulkHealthTestCompletion({
    testedDogCount: 3,
    executedTestCount: 6,
    totalCharged: 3000,
    skippedByReason: { ...noSkips, ALREADY_COMPLETED: 2 },
  }),
  "Health testing complete: 6 tests run on 3 dogs. Total charged: $3,000. 2 completed tests were skipped",
  "plural completion feedback includes completed-test skips"
);
assert.equal(
  formatBulkHealthTestCompletion({
    testedDogCount: 4,
    executedTestCount: 4,
    totalCharged: 2000,
    skippedByReason: {
      ...noSkips,
      TOO_YOUNG: 2,
      NOT_APPLICABLE_TO_BREED: 3,
    },
  }),
  "Health testing complete: 4 tests run on 4 dogs. Total charged: $2,000. 2 tests were skipped because dogs are too young; 3 tests were skipped because they do not apply to the breed",
  "completion feedback explains several skip categories"
);
assert.equal(
  formatBulkHealthTestCompletion({
    testedDogCount: 0,
    executedTestCount: 0,
    totalCharged: 0,
    skippedByReason: { ...noSkips, ALREADY_COMPLETED: 1 },
  }),
  "No health tests were run. 1 completed test was skipped",
  "zero-execution feedback explains what was skipped"
);
assertIncludes(
  bulkHealthTestExecutionSection,
  "setActiveBulkWorkspace(null);",
  "successful Health Tests execution closes only its workspace"
);
assertIncludes(
  bulkHealthTestExecutionSection,
  "resetHealthTestingWorkspaceState();",
  "successful Health Tests execution resets health workspace state"
);
for (const stateSetter of [
  "setSelectedRunIds(",
  "setSearchText(",
  "setBreedFilter(",
  "setSexFilter(",
  "setOnlyBreedable(",
  "setOnlyForSale(",
  "setOnlyAtStud(",
  "setGroomingStateFilter(",
  "setSortKey(",
  "setSortDirection(",
  "window.location",
  "router.",
]) {
  assertExcludes(
    bulkHealthTestExecutionSection,
    stateSetter,
    `successful Health Tests execution does not reset or navigate via ${stateSetter}`
  );
}
assertIncludes(
  bulkHealthTestExecutionSection,
  "setHealthTestExecutionError(formatHealthTestExecutionError(executionError));",
  "Health Tests execution errors remain local to the workspace"
);
for (const resetCall of [
  "clearSelection();",
  "setActiveBulkWorkspace(null);",
  "resetHealthTestingWorkspaceState();",
]) {
  assertExcludes(
    bulkHealthTestFailureSection,
    resetCall,
    `failed Health Tests execution preserves its workspace and selection without ${resetCall}`
  );
}
assertIncludes(
  kennelPanel,
  'role="status"',
  "Health Tests completion feedback remains in an accessible roster status area"
);
assertIncludes(
  kennelPanel,
  'aria-live="polite"',
  "Health Tests completion feedback is announced politely"
);
for (const label of [
  "Already completed",
  "Too young",
  "Not applicable to breed",
  "Not currently eligible",
  "No longer available",
]) {
  assertIncludes(
    kennelPanel,
    `label: "${label}"`,
    `Health Test details maps skip reasons to ${label}`
  );
}
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
  "await loadDogs({ preserveLoadingState: true });",
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
  'label: "Current Run"',
  "multi-run view can show each dog's current run after movement"
);
assertIncludes(
  kennelPanel,
  "View Options",
  "view options control renders"
);
assertIncludes(
  kennelPanel,
  "Visible Traits",
  "view options panel labels visible traits"
);
assertIncludes(
  kennelPanel,
  "Select which details appear in the roster.",
  "view options panel explains visible trait toggles"
);
assertIncludes(
  kennelPanel,
  'const VISIBLE_COLUMNS_STORAGE_KEY = "showring.kennelRoster.visibleColumns";',
  "visible column preferences use the canonical localStorage key"
);
assertIncludes(
  kennelPanel,
  'window.localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY)',
  "visible column preferences load from localStorage"
);
assertIncludes(
  kennelPanel,
  'window.localStorage.setItem(',
  "visible column preferences persist to localStorage"
);
assertIncludes(
  kennelPanel,
  'const DEFAULT_VISIBLE_COLUMNS: OptionalColumnId[] = [',
  "default optional columns are declared"
);
for (const defaultColumn of [
  '"dog"',
  '"breed"',
  '"sex"',
  '"age"',
  '"typeExpression"',
  '"structureBalance"',
  '"movement"',
]) {
  assertIncludes(
    kennelPanel,
    defaultColumn,
    `default optional column ${defaultColumn} is configured`
  );
}
assertIncludes(
  kennelPanel,
  "Reset View",
  "view options can reset to default columns"
);
assertIncludes(
  kennelPanel,
  "toggleVisibleColumn(column.id)",
  "column chooser toggles optional columns"
);
assertIncludes(
  kennelPanel,
  "visibleColumnDefinitions.map((column)",
  "table renders only selected optional columns"
);
assertIncludes(
  kennelPanel,
  "colSpan={rosterColumnCount}",
  "expanded rows span the dynamic visible column count"
);
assertIncludes(
  kennelPanel,
  'target="_blank"',
  "open dog action opens in a new tab"
);
assertIncludes(
  kennelPanel,
  'rel="noopener noreferrer"',
  "open dog action uses safe new-tab rel attributes"
);
assertBefore(
  kennelPanel,
  '<th className="w-10 px-2 py-2">',
  "visibleColumnDefinitions.map((column)",
  "required selection column renders before optional columns"
);
assertBefore(
  kennelPanel,
  '<th className="w-[58px] px-2 py-2 text-center">Open</th>',
  "visibleColumnDefinitions.map((column)",
  "required open action column renders before optional columns"
);
assertBefore(
  kennelPanel,
  'target="_blank"',
  "visibleColumnDefinitions.map((column) => {",
  "open dog action remains outside optional dog/name rendering"
);
assertIncludes(
  kennelPanel,
  "Move selected dogs",
  "bulk move UI still renders with customizable columns"
);
assertIncludes(
  kennelPanel,
  "Filters",
  "filters still render with customizable columns"
);
assertIncludes(
  kennelPanel,
  "+ Run",
  "Kennel Runs sidebar renders a compact create run control"
);
assertBefore(
  kennelPanel,
  "Kennel Runs",
  "+ Run",
  "+ Run is associated with the Kennel Runs heading"
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
  "Manage Runs",
  "Kennel Runs sidebar exposes manage mode"
);
assertIncludes(
  kennelPanel,
  "Done Managing",
  "Kennel Runs sidebar can exit manage mode"
);
assertIncludes(
  kennelPanel,
  'managingRuns && run.kind !== "UNCATEGORIZED"',
  "rename/delete controls render only for non-system runs in manage mode"
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
  "Move Up",
  "non-system runs expose a move-up control"
);
assertIncludes(
  kennelPanel,
  "Move Down",
  "non-system runs expose a move-down control"
);
assertIncludes(
  kennelPanel,
  "aria-label={`Move ${run.name} up`}",
  "move-up has an accessible run-specific label"
);
assertIncludes(
  kennelPanel,
  "disabled={movableRunIndex <= 0 || movingRunId !== null}",
  "first movable run has a true disabled move-up button"
);
assertIncludes(
  kennelPanel,
  "movableRunIndex === movableRuns.length - 1",
  "last movable run has a true disabled move-down button"
);
assertIncludes(
  kennelPanel,
  'method: "POST"',
  "reorder uses a server-side mutation"
);
assertIncludes(
  kennelPanel,
  "Run deleted. Any dogs remaining in the kennel run were transferred to Uncategorized.",
  "delete success explains the reassignment outcome"
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
  "disabled={deleteRunLoading}",
  "delete is disabled while the request is pending"
);

assertExcludes(kennelPanel, "confirmingDeleteRunId", "run deletion has no confirmation state");
assertExcludes(kennelPanel, "Delete Run?", "run deletion has no confirmation panel");

assertExcludes(
  kennelPanel,
  "Kennel Areas",
  "legacy area selector label is not shown on the kennel roster"
);
assertExcludes(
  kennelPanel,
  "Select All Runs",
  "normal run sidebar no longer shows the broad select-all shortcut"
);
assertExcludes(
  kennelPanel,
  "selectUncategorizedRun",
  "normal run sidebar no longer shows the Uncategorized shortcut handler"
);
assertExcludes(
  kennelPanel,
  "Reset Columns",
  "old column reset copy was replaced by Reset View"
);
assertExcludes(
  kennelPanel,
  "Clear Optional",
  "view options footer no longer shows Clear Optional"
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
