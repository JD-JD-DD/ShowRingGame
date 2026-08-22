import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(__dirname, "..", "..", "..");
const source = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const breedingService = source("apps/web/server/services/breeding.service.ts");
const breedingEligibility = source(
  "apps/web/server/services/breedingEligibility.service.ts"
);
const planner = source("apps/web/components/breeding/BreedingPlannerPage.tsx");
const studsPage = source("apps/web/app/studs/page.tsx");
const marketService = source("apps/web/server/services/market.service.ts");
const foundationService = source("apps/web/server/services/foundationDog.service.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const control = source("apps/web/components/dogs/BreedingActiveControl.tsx");
const mutationRoute = source("apps/web/app/api/dogs/[dogId]/breeding-active/route.ts");

function section(text: string, start: string, end: string) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing ${start}`);
  assert.ok(endIndex > startIndex, `missing ${end}`);
  return text.slice(startIndex, endIndex);
}

const createBreeding = breedingService.slice(
  breedingService.indexOf("export async function createBreedingAttemptForKennel")
);

assert.ok(
  breedingService.includes("isBreedingActive: true,") &&
    breedingService.includes("function assertBreedingParticipationActive"),
  "breeding creation loads and has a focused participation gate"
);
assert.ok(
  createBreeding.includes("assertBreedingParticipationActive(primaryDog);") &&
    createBreeding.includes("assertBreedingParticipationActive(mateDog);"),
  "inactive primary or mate dogs are rejected regardless of sire/dam argument order"
);
assert.ok(
  createBreeding.indexOf("assertBreedingParticipationActive(primaryDog);") <
    createBreeding.indexOf("if (primaryDog.lifecycleState"),
  "participation rejection happens before normal breeding validation and side effects"
);
assert.ok(
  createBreeding.indexOf("assertBreedingParticipationActive(freshSire);") >
    createBreeding.indexOf("FOR UPDATE") &&
    createBreeding.indexOf("assertBreedingParticipationActive(freshSire);") <
      createBreeding.indexOf("await tx.ledgerTransaction.create"),
  "the locked sire is rechecked before monetary or attempt mutations"
);
assert.ok(
  breedingService.includes(
    "is not currently active for breeding."
  ),
  "participation rejection retains clear player-facing copy"
);
assert.ok(
  breedingService.includes("if (!dog.isBreedingActive)") &&
    createBreeding.includes("getIndividualBreedingEligibility"),
  "Active dogs continue into the existing biological/reproductive validation"
);
assert.equal(
  breedingEligibility.includes("isBreedingActive"),
  false,
  "owner participation is not folded into biological/reproductive eligibility"
);

for (const expected of [
  "id: initialDogId,",
  "id: initialStudListingId,",
  "ownerKennelId: kennel.id,",
  "dog: {\n              lifecycleState: \"ALIVE\",\n              isPlayerVisible: true,\n              isBreedingActive: true,",
]) {
  assert.ok(planner.includes(expected), `planner retains active-only candidate contract: ${expected}`);
}
assert.ok(
  planner.includes("isBreedingActive: true,") &&
    planner.includes("This dog is not available for breeding.") &&
    planner.includes("This stud is not available for breeding."),
  "inactive direct owned and public anchors are excluded into existing unavailable behavior"
);

const publicStudQuery = section(studsPage, "const dogs =", "const dogIds =");
const publicStudWhere = section(publicStudQuery, "where: {", "select: {");
assert.equal(
  publicStudWhere.includes("isBreedingActive"),
  false,
  "inactive active listings remain visible on the public stud board"
);
assert.ok(
  publicStudQuery.includes("isBreedingActive: true,") &&
    studsPage.includes('"Breeding Inactive"'),
  "public board loads and labels participation state"
);
assert.match(
  studsPage,
  /!dog\.isBreedingActive\s*\?\s*"Breeding Inactive"\s*:\s*breedingEligibility\.isEligible\s*\?\s*"Available"\s*:\s*"Recovery"/,
  "Breeding Inactive takes primary status precedence over Stud Recovery"
);
const inactiveStudAction = section(
  studsPage,
  "{!dog.isBreedingActive ? (",
  ") : breedingEligibility.isEligible ? ("
);
assert.ok(
  inactiveStudAction.includes("aria-disabled=\"true\"") &&
    !inactiveStudAction.includes("href={`/breed?studListingId=${listing.id}`}"),
  "inactive visible public studs have no Use At Stud action"
);
assert.ok(
  studsPage.includes("href={`/dogs/${dog.id}`}"),
  "inactive public studs retain View Dog navigation"
);
assert.equal(
  studsPage.includes('data: { status: "CANCELLED" }'),
  false,
  "public stud discovery never cancels an existing listing"
);

assert.match(
  marketService,
  /ownerKennelId: buyer\.id,[\s\S]{0,180}isBreedingActive: true/,
  "player-sale acquisition resets breeding participation"
);
assert.match(
  foundationService,
  /ownerKennelId: kennel\.id,[\s\S]{0,180}isBreedingActive: true/,
  "Foundation acquisition explicitly resets breeding participation"
);
assert.equal(
  source("apps/web/server/services/rehome.service.ts").includes(
    "isBreedingActive: true"
  ),
  false,
  "terminal rehome does not masquerade as playable ownership acquisition"
);
assert.equal(
  source("apps/web/server/services/accountClosure.service.ts").includes(
    "isBreedingActive: true"
  ),
  false,
  "account closure does not reset a non-acquired dog"
);

for (const expected of [
  "getSessionUserId()",
  "ownerKennelId !== kennel.id",
  'typeof candidate === "boolean"',
  "data: { isBreedingActive }",
  "select: { isBreedingActive: true }",
  "status: 401",
  "status: 403",
  "status: 400",
]) {
  assert.ok(mutationRoute.includes(expected), `breeding-active mutation contract includes ${expected}`);
}

for (const expected of [
  'role="group"',
  'aria-label="Breeding"',
  "aria-pressed={isBreedingActive}",
  "aria-pressed={!isBreedingActive}",
  "aria-busy={isPending || undefined}",
  "role=\"alert\"",
  "if (isPending || nextValue === isBreedingActive) return;",
  "setBreedingActive(true)",
  "setBreedingActive(false)",
  "JSON.stringify({ isBreedingActive: nextValue })",
  "router.refresh()",
]) {
  assert.ok(control.includes(expected), `segmented control includes ${expected}`);
}
assert.ok(
  dogPage.includes("viewerContext.canManage ? (") &&
    dogPage.includes("<BreedingActiveControl"),
  "Dog Profile renders the control only for the server-authorized manager"
);
assert.match(
  dogService,
  /canBreed: isOwnedByCurrentKennel && dog\.isBreedingActive && breedingEligible/,
  "Breed Dog stays unavailable while inactive without changing biological eligibility"
);
assert.match(
  dogService,
  /canOfferAtStud[\s\S]{0,280}dog\.isBreedingActive/,
  "Offer Dog At Stud remains participation-gated"
);

for (const relativePath of [
  "apps/web/server/services/showEntry.service.ts",
  "apps/web/server/services/judging.service.ts",
  "apps/web/server/services/publishShowResultsJob.service.ts",
]) {
  assert.equal(
    source(relativePath).includes("isBreedingActive"),
    false,
    `${relativePath} remains isolated from breeding participation`
  );
}

console.log("Breeding Active state regression checks passed.");
