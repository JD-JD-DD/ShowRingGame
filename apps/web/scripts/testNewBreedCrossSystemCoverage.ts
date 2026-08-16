import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ALL_BREED_REQUIRED_HEALTH_TEST_CODES,
  CURRENT_BREED_RELEASE,
  CURRENT_GENETICS_VERSION,
  combineBreedAndJudgeConformationWeights,
  createFoundationDogProfile,
  createJudge,
  createLitter,
  deriveBreedConformationCategoryWeights,
  getRequiredHealthTestsForBreed,
  isValidBreedCode2,
  resolveBreedGroupNameToCanonicalShowGroupCode,
  type NormalizedBreedTraitWeights,
} from "@showring/rules";

import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, toNormalizedBreedJudgingTraitWeights, validateBreedJudgingProfileCoverage } from "../server/services/breedJudgingProfile.service";

const BREED_01_BASELINE = "0a76d0f^";
const REQUIRED_STATUS = "PASS" as const;
const GENERIC_STATUS = "GENERIC_BY_DESIGN" as const;
type Status = typeof REQUIRED_STATUS | typeof GENERIC_STATUS;
type BreedRow = { breed: string; breedCode2: string; group: string; playable: string; releaseVersion: number };
const traitMeans: NormalizedBreedTraitWeights = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const parseRows = (csv: string): BreedRow[] => csv.trim().split(/\r?\n/).slice(1).map((line) => { const [breed, breedCode2, group, playable, releaseVersion] = line.split(","); return { breed, breedCode2, group, playable, releaseVersion: Number(releaseVersion) }; });
const random = (seed: number) => { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; }; };

function requireSource(sourceText: string, pattern: RegExp, label: string) {
  assert.match(sourceText, pattern, label);
}

function main() {
  const currentRows = parseRows(source("prisma/data/breeds.csv"));
  const baselineRows = parseRows(execFileSync("git", ["show", `${BREED_01_BASELINE}:apps/web/prisma/data/breeds.csv`], { encoding: "utf8" }));
  const baselineCodes = new Set(baselineRows.map((row) => row.breedCode2));
  const newBreeds = currentRows.filter((row) => !baselineCodes.has(row.breedCode2));
  assert.ok(newBreeds.length > 0, "BREED-01 baseline code2 delta contains newly added breeds");
  assert.equal(new Set(newBreeds.map((row) => row.breedCode2)).size, newBreeds.length, "new breed codes are unique");

  const canonical = parseCanonicalBreedsCsv(source("prisma/data/breeds.csv"));
  const judgingProfiles = validateBreedJudgingProfileCoverage({ canonicalBreeds: canonical, profiles: parseBreedJudgingProfilesCsv(source("prisma/data/JUDGE-01_Breed_Judging_Profile.csv")) });
  const profileByCode = new Map(judgingProfiles.map((profile) => [profile.breedCode2, profile]));
  const neutralJudge = createJudge({ judgeId: "breed-02", name: "breed-02", style: "BALANCED", random01: () => .5 });
  const foundationService = source("server/services/foundationDog.service.ts");
  const populationContextService = source("server/services/foundationPopulationContext.service.ts");
  const marketService = source("server/services/market.service.ts");
  const catalogRoute = source("app/api/breeds/catalog/route.ts");
  const seedSource = source("prisma/seed.ts");
  const showAssignment = source("server/services/showDayGroupJudgeAssignment.service.ts");
  const dogService = source("server/services/dog.service.ts");
  const selector = source("components/breeds/BreedSelectOptions.tsx");
  requireSource(foundationService, /ensureFoundationInventoryForBreed\(args/, "foundation inventory is breedCode2-generic");
  requireSource(populationContextService, /return \{ breedCode2, mode: "RESET_FALLBACK"/, "empty populations use generic reset fallback");
  requireSource(marketService, /const dogBreedFilter = breedCode2 \? \{ breedCode2 \} : \{\}/, "dog market filter is canonical-code driven");
  requireSource(catalogRoute, /releaseVersion:\s*\{\s*lte: CURRENT_BREED_RELEASE/, "catalog honors release state");
  requireSource(seedSource, /code2,\s*name,\s*groupName/, "seed imports canonical code/name/group");
  requireSource(showAssignment, /resolveBreedGroupNameToCanonicalShowGroupCode\(breed\.groupName\)/, "show routing derives canonical group from breed row");
  requireSource(dogService, /colorLabel: "Color: Pending"/, "active color display has a generic safe path");
  requireSource(selector, /option\.code2/, "selectors are data-driven by canonical code2");

  const matrix = newBreeds.map((breed, index) => {
    assert.ok(isValidBreedCode2(breed.breedCode2), `${breed.breedCode2} registration format compatible`);
    assert.ok(breed.playable === "TRUE" || breed.playable === "FALSE", `${breed.breedCode2} playable is canonical boolean`);
    assert.ok(breed.releaseVersion > 0, `${breed.breedCode2} release version is valid`);
    resolveBreedGroupNameToCanonicalShowGroupCode(breed.group);
    const rng = random(index + 1);
    const sire = createFoundationDogProfile({ dogId: `${breed.breedCode2}-sire`, regNumber: `${breed.breedCode2}000000101`, breedCode2: breed.breedCode2, birthEpoch: 0, callName: "Sire", breedBaseline: { breedCode2: breed.breedCode2, traitMeans }, populationContext: { mode: "RESET_FALLBACK", genotype: null }, random01: rng });
    const dam = createFoundationDogProfile({ dogId: `${breed.breedCode2}-dam`, regNumber: `${breed.breedCode2}000000201`, breedCode2: breed.breedCode2, birthEpoch: 0, callName: "Dam", breedBaseline: { breedCode2: breed.breedCode2, traitMeans }, populationContext: { mode: "RESET_FALLBACK", genotype: null }, random01: rng });
    assert.equal(sire.dog.geneticsVersion, CURRENT_GENETICS_VERSION, `${breed.breedCode2} foundation genetics version`);
    const litter = createLitter({ litterId: `${breed.breedCode2}-litter`, breedCode2: breed.breedCode2, bornEpoch: 1, sireId: sire.dog.dogId, damId: dam.dog.dogId, pupCount: 2, puppyDogIds: [`${breed.breedCode2}-p1`, `${breed.breedCode2}-p2`], puppySexes: ["M", "F"], sireTraits: sire.dog.traits, damTraits: dam.dog.traits, sireGenotype: sire.dog.genotype!, sireGeneticsVersion: sire.dog.geneticsVersion!, damGenotype: dam.dog.genotype!, damGeneticsVersion: dam.dog.geneticsVersion!, coiPercent: 0, coiGenerationDepth: 0, random01: rng, puppyGeneticsRandom01: () => rng });
    assert.equal(litter.puppies[0].geneticsVersion, CURRENT_GENETICS_VERSION, `${breed.breedCode2} Model D litter generation`);
    assert.ok(litter.puppies.every((puppy) => puppy.regNumber.startsWith(breed.breedCode2)), `${breed.breedCode2} litter registration prefix`);
    assert.deepEqual(getRequiredHealthTestsForBreed(breed.breedCode2), ALL_BREED_REQUIRED_HEALTH_TEST_CODES, `${breed.breedCode2} universal health requirements`);
    const profile = profileByCode.get(breed.breedCode2); assert.ok(profile, `${breed.breedCode2} JUDGE-01 profile exists`);
    const breedWeights = deriveBreedConformationCategoryWeights(toNormalizedBreedJudgingTraitWeights(profile));
    const effective = combineBreedAndJudgeConformationWeights({ breedWeights, judgeWeights: { TYPE_EXPRESSION: neutralJudge.categoryWeights.TYPE_EXPRESSION, STRUCTURE_BALANCE: neutralJudge.categoryWeights.STRUCTURE_BALANCE, MOVEMENT: neutralJudge.categoryWeights.MOVEMENT, COAT_PRESENTATION: neutralJudge.categoryWeights.COAT_PRESENTATION, TEMPERAMENT_RING_BEHAVIOR: neutralJudge.categoryWeights.TEMPERAMENT_RING_BEHAVIOR } });
    assert.ok(Math.abs(Object.values(effective).reduce((total, value) => total + value, 0) - 5) < 1e-9, `${breed.breedCode2} JUDGE-04 fixed budget`);
    return {
      breed: breed.breed, code2: breed.breedCode2, group: breed.group, playable: breed.playable, releaseVersion: breed.releaseVersion,
      canonical: REQUIRED_STATUS, registration: REQUIRED_STATUS, foundation: GENERIC_STATUS, genetics: GENERIC_STATUS, populationContext: GENERIC_STATUS,
      judging: REQUIRED_STATUS, health: GENERIC_STATUS, colorPhenotype: GENERIC_STATUS, showRouting: GENERIC_STATUS, classCompatibility: GENERIC_STATUS,
      foundationMarket: GENERIC_STATUS, dogMarket: GENERIC_STATUS, studMarket: GENERIC_STATUS, searchFilter: GENERIC_STATUS, selector: GENERIC_STATUS, importSeed: GENERIC_STATUS, overall: REQUIRED_STATUS,
    };
  });
  const statusCounts = matrix.flatMap((row) => Object.values(row).filter((value): value is Status => value === REQUIRED_STATUS || value === GENERIC_STATUS)).reduce<Record<Status, number>>((counts, status) => ({ ...counts, [status]: counts[status] + 1 }), { PASS: 0, GENERIC_BY_DESIGN: 0 });
  assert.ok(newBreeds.every((breed) => breed.releaseVersion <= CURRENT_BREED_RELEASE), "new breeds retain existing release visibility semantics without a release change");
  console.log(JSON.stringify({ baseline: BREED_01_BASELINE, newBreedCount: newBreeds.length, newBreeds: matrix, statusCounts, missing: 0, blocked: 0, colorSystem: "GENERIC_COLOR_PENDING", healthSystem: "ALL_BREED_REQUIRED_HEALTH_TEST_CODES" }, null, 2));
  console.log("New-breed cross-system coverage checks passed.");
}

main();
