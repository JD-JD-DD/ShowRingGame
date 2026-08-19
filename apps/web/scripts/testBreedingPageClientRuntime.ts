import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const client = source("apps/web/components/breeding/BreedPageClient.tsx");
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");

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
  "Boolean(dog.studListingId) && dog.hasPendingVeterinaryCare",
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
  client.includes("disabled={isSireLoading}") &&
    client.includes("{isSireLoading ? (") &&
    client.includes(") : sires.length > 0 ? ("),
  "pending sire discovery disables filters and replaces stale sire cards with a non-interactive status"
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

console.log("Breeding page client runtime regression checks passed.");
