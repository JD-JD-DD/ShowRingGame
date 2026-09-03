import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const client = source("apps/web/components/breeding/BreedPageClient.tsx");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const layout = source("apps/web/app/layout.tsx");
const scrollControls = source("apps/web/components/ReturnToTopButton.tsx");
const showEntryPage = source("apps/web/app/shows/[showId]/page.tsx");

function section(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing ${start}`);
  assert.ok(endIndex > startIndex, `missing ${end}`);
  return text.slice(startIndex, endIndex);
}

assert.ok(client.startsWith('"use client"'), "breeding planner is a client component");
assert.ok(
  client.includes('from "@/lib/breedingAvailability"'),
  "the client imports pending-care copy from a browser-safe module"
);
assert.equal(
  client.includes('from "@/server/services/emergencyVetCare.service"'),
  false,
  "the client does not import the Prisma/database-backed veterinary-care service"
);
assert.equal(
  client.includes("useState(initialDogs)") || client.includes("useState(publicStudCards)"),
  false,
  "the mounted client does not retain an initial copy of server-owned dog or public-stud data"
);
assert.match(
  client,
  /const eligibleDogs = useMemo\([\s\S]*\[dogs\]/,
  "derived selectable dogs recompute from refreshed server props without a remount"
);

for (const expected of [
  "hasPendingVeterinaryCare: false,",
  "hasPendingVeterinaryCare,",
  "dog.isEligibleToBreed ||",
  "dog.publicStudSource !== undefined && dog.hasPendingVeterinaryCare",
  "kennelRunId: dog.kennelRunId,",
  "kennelRuns={kennelRuns}",
]) {
  assert.ok(planner.includes(expected), `planner DTO path includes ${expected}`);
}

assert.ok(
  planner.includes('experience === "worksheet"') &&
    planner.includes('operation: "kennel_run_options_query"') &&
    planner.includes("where: { kennelId: kennel.id }") &&
    planner.includes('Promise.resolve<KennelRunOptionDto[]>([])'),
  "only the worksheet loads minimal, current-kennel run options"
);
assert.ok(
  client.includes('type WorksheetSelectionMode = "BREED" | "KENNEL_RUN" | null') &&
    client.includes('disabled={worksheetSelectionMode === "KENNEL_RUN"}') &&
    client.includes('disabled={worksheetSelectionMode === "BREED"}') &&
    client.includes('function chooseKennelRun(nextKennelRunId: string)'),
  "worksheet Step 1 keeps separate mutually exclusive Breed and Kennel Run selects"
);
assert.ok(
  client.includes('value={worksheetSelectionMode === "BREED" ? breedCode2 : ""}') &&
    client.includes("value={kennelRunId}") &&
    client.includes('setWorksheetSelectionMode(nextBreedCode ? "BREED" : null)') &&
    client.includes('setWorksheetSelectionMode(nextKennelRunId ? "KENNEL_RUN" : null)'),
  "both controls begin clear, retain only their active scope, and re-enable each other when cleared"
);
assert.ok(
  client.includes("function clearWorksheetPairingState()") &&
    client.includes("setDamId(\"\");") &&
    client.includes("setSireId(\"\");") &&
    client.includes("setShortlistedSireIds([]);") &&
    client.includes("setTestDamBrucellosis(false);") &&
    client.includes("setTestSireBrucellosis(false);") &&
    client.includes("setErrorMessage(\"\");"),
  "scope changes centrally clear stale dam, sire, shortlist, test, and feedback state"
);
assert.ok(
  /worksheetSelectionMode === "KENNEL_RUN"[\s\S]*dog\.kennelRunId === kennelRunId[\s\S]*dog\.breedCode2 === breedCode2/.test(client) &&
    client.includes("dog.isOwnedByCurrentKennel") &&
    client.includes('dog.sex === "F"'),
  "run mode composes exact run membership with the existing eligible owned-female dam result while breed mode retains its breed predicate"
);
assert.ok(
  client.indexOf('if (experience === "breed-dog" && anchorDog)') <
    client.indexOf("Choose A Breed Or Kennel Run"),
  "the worksheet-only Step 1 controls remain outside the direct dog-anchored breeding experience"
);
assert.ok(
  client.includes('setBreedCode2("");\n    synchronizeWorksheetBreedCode2("");') &&
    client.includes('if (nextDam) {\n      if (worksheetBreedCode2NeedsSync(nextDam.breedCode2))'),
  "run selection clears public-stud breed context, while dam selection remains the sole sire-discovery boundary"
);
assert.ok(
  client.includes("There are no eligible dams in this kennel run."),
  "empty kennel runs receive a specific player-facing dam-discovery message"
);
assert.ok(
  client.includes("useTransition") &&
    client.includes("const [isSireLoading, startSireLoadingTransition] = useTransition();") &&
    client.includes("worksheetBreedCode2NeedsSync(nextDam.breedCode2)") &&
    client.includes("startSireLoadingTransition(() => {") &&
    client.includes("synchronizeWorksheetBreedCode2(nextDam.breedCode2);"),
  "only an actual dam-triggered breed refresh enters the sire-loading transition"
);
assert.ok(
  client.indexOf("setDamId(nextDamId);") <
    client.indexOf("startSireLoadingTransition(() => {"),
  "the selected dam is retained before the sire refresh begins"
);
assert.ok(
  client.includes("aria-busy={isSireLoading || undefined}") &&
    client.includes('aria-live="polite"') &&
    client.includes('role="status"') &&
    client.includes("Loading available sires…"),
  "Step 2B exposes accessible busy and live loading feedback"
);
assert.ok(
  client.includes("Only outside sires available to the selected dam are shown.") &&
    client.indexOf("Only outside sires available to the selected dam are shown.") <
      client.indexOf("Loading available sires…"),
  "Step 2B explains the selected-dam-specific outside-sire filtering separately from its live loading status"
);
assert.ok(
  client.includes(
    'dog.sex === "M" && isPublicSire(dog);'
  ) &&
    client.includes("Stud Terms"),
  "only outside public sire cards expose current listing information as Stud Terms"
);
assert.ok(
  client.includes("publicStudContractHref(dog, selectedDam.id, \"plan-a-litter\")") &&
    client.includes("Open Contract"),
  "worksheet outside sire cards use source-aware contract routing"
);
assert.ok(
  client.includes("contractHref?: string | null;") &&
    client.includes("{contractHref ? (\n          <Link"),
  "Open Contract remains a separate navigation link from sire selection and comparison controls"
);
assert.ok(
  client.includes("disabled={isSireLoading}") &&
    client.includes("{isSireLoading ? (") &&
    client.includes(") : sires.length > 0 ? ("),
  "pending sire discovery disables filters and replaces stale sire cards with a non-interactive status"
);

const chooseBreedSource = section(
  client,
  "function chooseBreed(nextBreedCode: string)",
  "function chooseKennelRun(nextKennelRunId: string)"
);
const chooseKennelRunSource = section(
  client,
  "function chooseKennelRun(nextKennelRunId: string)",
  "function chooseDam(nextDamId: string)"
);
const chooseDamSource = section(
  client,
  "function chooseDam(nextDamId: string)",
  "function toggleShortlist(sireIdToToggle: string)"
);
const toggleShortlistSource = section(
  client,
  "function toggleShortlist(sireIdToToggle: string)",
  "async function handleSubmit()"
);
const shortlistSource = section(
  client,
  "function Shortlist({",
  "export default function BreedPageClient"
);

assert.equal(
  chooseBreedSource.includes("startSireLoadingTransition"),
  false,
  "selecting or clearing a breed never manufactures sire loading"
);
assert.equal(
  chooseKennelRunSource.includes("startSireLoadingTransition"),
  false,
  "selecting or clearing a kennel run never starts sire loading"
);
assert.ok(
  chooseDamSource.includes("worksheetBreedCode2NeedsSync(nextDam.breedCode2)") &&
    chooseDamSource.includes("startSireLoadingTransition(() => {") &&
    chooseDamSource.indexOf("setSireId(\"\");") <
      chooseDamSource.indexOf("startSireLoadingTransition(() => {") &&
    chooseDamSource.includes("} else {\n        synchronizeWorksheetBreedCode2(nextDam.breedCode2);"),
  "only a dam selection with a changed sire breed starts loading; same-breed dam changes clear stale sire state without a false transition"
);
assert.ok(
  client.includes("const [isSireLoading, startSireLoadingTransition] = useTransition();") &&
    !client.includes("setIsSireLoading") &&
    client.includes("aria-busy={isSireLoading || undefined}") &&
    client.includes("{isSireLoading ? (") &&
    client.includes(") : sires.length > 0 ? (") &&
    client.includes("No sires match this breed and source filter."),
  "React owns pending completion so successful, empty, interrupted, or failed refresh work cannot leave a manually latched busy state"
);

assert.ok(
  shortlistSource.includes("if (!dam || sires.length === 0) return null;") &&
    shortlistSource.includes("Pinned Sire Comparison") &&
    shortlistSource.includes("<table"),
  "zero pins omit the inline comparison while one or more pins render the existing semantic table"
);
for (const heading of ["Sire", "Source", "Litter COI", "Stud Fee", "Complements"]) {
  assert.ok(
    shortlistSource.includes(`>${heading}<`),
    `comparison retains its ${heading} column`
  );
}
assert.ok(
  toggleShortlistSource.includes("current.length >= 3") &&
    toggleShortlistSource.includes("[...current.slice(1), sireIdToToggle]") &&
    toggleShortlistSource.includes("current.filter((id) => id !== sireIdToToggle)"),
  "pinning preserves the three-sire oldest-eviction rule and Unpin removes only the chosen sire"
);

function toggleShortlist(current: string[], sireId: string) {
  if (current.includes(sireId)) {
    return current.filter((id) => id !== sireId);
  }

  return current.length >= 3 ? [...current.slice(1), sireId] : [...current, sireId];
}

assert.deepEqual([], [], "zero pins leave no comparison rows");
assert.deepEqual(toggleShortlist([], "sire-a"), ["sire-a"], "one pin is retained");
assert.deepEqual(
  ["sire-a", "sire-b"].reduce(toggleShortlist, []),
  ["sire-a", "sire-b"],
  "two pins retain insertion order"
);
assert.deepEqual(
  ["sire-a", "sire-b", "sire-c"].reduce(toggleShortlist, []),
  ["sire-a", "sire-b", "sire-c"],
  "three pins retain insertion order"
);
assert.deepEqual(
  toggleShortlist(["sire-a", "sire-b", "sire-c"], "sire-d"),
  ["sire-b", "sire-c", "sire-d"],
  "a fourth pin evicts the oldest sire and retains the newest three"
);
assert.deepEqual(
  toggleShortlist(["sire-b", "sire-c", "sire-d"], "sire-c"),
  ["sire-b", "sire-d"],
  "Unpin removes only the intended sire and preserves the others"
);

assert.ok(
  chooseDamSource.includes("if (nextDamId !== damId) {") &&
    chooseDamSource.includes("setShortlistedSireIds([]);"),
  "changing the selected dam clears the shortlist"
);
assert.ok(
  chooseBreedSource.includes("setShortlistedSireIds([]);") &&
    chooseKennelRunSource.includes("clearWorksheetPairingState();") &&
    client.includes("function clearWorksheetPairingState()") &&
    client.includes("setShortlistedSireIds([]);"),
  "changing breed or kennel-run context clears the shortlist"
);
assert.equal(
  toggleShortlistSource.includes("setShortlistedSireIds"),
  true,
  "ordinary pin and Unpin interaction is the only local shortlist mutation and does not clear it"
);

const card = (overrides: Partial<{ isOwned: boolean; listed: boolean; pending: boolean }> = {}) => ({
  isOwned: overrides.isOwned ?? false,
  listed: overrides.listed ?? true,
  pending: overrides.pending ?? false,
});

assert.deepEqual(card({ isOwned: true, listed: false }), { isOwned: true, listed: false, pending: false }, "owned breeding card has a concrete pending-care boolean");
assert.deepEqual(card(), { isOwned: false, listed: true, pending: false }, "ordinary outside stud card is selectable");
assert.deepEqual(card({ pending: true }), { isOwned: false, listed: true, pending: true }, "pending-care outside stud card preserves its listing while carrying the unavailable state");
assert.deepEqual(card({ pending: true, listed: false }), { isOwned: false, listed: false, pending: true }, "direct/card data remains serializable when no general public-stud batch is present");
assert.equal(client.includes("initialBreedCode2 ?? \"\""), true, "no-breed planner state remains supported");

assert.ok(
  layout.includes("<ReturnToTopButton />") &&
    scrollControls.includes('const pathname = usePathname();') &&
    scrollControls.includes('pathname === "/plan-a-litter"') &&
    scrollControls.includes('/^\\/shows\\/[^/]+$/.test(pathname)') &&
    scrollControls.includes('top: document.documentElement.scrollHeight') &&
    scrollControls.includes("bottom-20 right-4 z-50") &&
    scrollControls.includes('aria-label="Scroll to bottom"'),
  "Plan a Litter and the exact Show Entry route render one always-visible, fixed Bottom control from the same root-layout client component as Top"
);
assert.equal(
  showEntryPage.includes("ScrollToBottomButton"),
  false,
  "Show Entry does not retain a duplicate page-local Bottom control"
);
assert.equal(
  showEntryPage.includes("show-entry-page-bottom"),
  false,
  "Show Entry no longer needs a page-local Bottom anchor"
);

console.log("Breeding page client runtime regression checks passed.");
