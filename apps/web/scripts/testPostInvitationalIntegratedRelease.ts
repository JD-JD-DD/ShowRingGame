import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CATEGORY_TRAIT_MAP,
  CURRENT_BREED_RELEASE,
  CURRENT_GENETICS_VERSION,
  FIXED_CONFORMATION_BUDGET,
  GENETIC_JUDGING_CATEGORIES,
  TOTAL_ALLELE_VALUES,
  TOTAL_LOCI,
  TRAIT_IDEAL,
  TRAIT_KEYS,
  combineBreedAndJudgeConformationWeights,
  createFoundationDogProfile,
  createJudge,
  createLitter,
  decodeGenotype,
  deriveBreedConformationCategoryWeights,
  judgeBreedBlock,
  resolveBreedGroupNameToCanonicalShowGroupCode,
  scoreDogByJudgeWeights,
  type NormalizedBreedTraitWeights,
} from "@showring/rules";

import { createBreedJudgingResultAudit, validateBreedWeightedResultAudit } from "../server/services/judgingAudit.service";
import { parseCanonicalBreedDataCsv } from "../server/services/canonicalBreedDataMigration.service";
import { parseBreedJudgingProfilesCsv, toNormalizedBreedJudgingTraitWeights, validateBreedJudgingProfileCoverage } from "../server/services/breedJudgingProfile.service";

const root = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const traits: NormalizedBreedTraitWeights = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const rng = () => .5;

function main() {
  const canonical = parseCanonicalBreedDataCsv(root("prisma/data/breeds.csv"));
  const baseline = parseCanonicalBreedDataCsv(execFileSync("git", ["show", "0a76d0f^:apps/web/prisma/data/breeds.csv"], { encoding: "utf8" }));
  const profiles = validateBreedJudgingProfileCoverage({ canonicalBreeds: canonical.map(({ name: breed, code2: breedCode2, groupName: group }) => ({ breed, breedCode2, group })), profiles: parseBreedJudgingProfilesCsv(root("prisma/data/JUDGE-01_Breed_Judging_Profile.csv")) });
  assert.equal(canonical.length, 318); assert.equal(profiles.length, 318); assert.ok(profiles.every((profile) => profile.isActive));
  const baselineCodes = new Set(baseline.map((row) => row.code2));
  assert.equal(canonical.filter((row) => !baselineCodes.has(row.code2)).length, 54);
  const byCode = new Map(canonical.map((row) => [row.code2, row]));
  const profileByCode = new Map(profiles.map((row) => [row.breedCode2, row]));
  for (const code2 of ["LR", "KK", "AL", "TO"]) assert.ok(byCode.has(code2) && profileByCode.has(code2), `${code2} canonical/profile representative`);

  assert.equal(TRAIT_KEYS.length, 10); assert.equal(TOTAL_LOCI, 40); assert.equal(TOTAL_ALLELE_VALUES, 80);
  assert.deepEqual(new Set(Object.values(CATEGORY_TRAIT_MAP).flat()).size, TRAIT_KEYS.length, "all and only ten inherited traits feed judging");
  assert.ok(!Object.values(CATEGORY_TRAIT_MAP).flat().includes("conditioningHandling" as never));
  for (const code2 of ["LR", "KK", "AL", "TO"]) {
    const foundation = createFoundationDogProfile({ dogId: `${code2}-f`, regNumber: `${code2}000000101`, breedCode2: code2, birthEpoch: 1, callName: "Foundation", breedBaseline: { breedCode2: code2, traitMeans: traits }, populationContext: { mode: "RESET_FALLBACK", genotype: null }, random01: rng });
    assert.equal(foundation.dog.geneticsVersion, CURRENT_GENETICS_VERSION);
    assert.equal(decodeGenotype(foundation.dog.genotype!).loci.length, TOTAL_LOCI);
    assert.deepEqual(Object.keys(foundation.dog.traits).sort(), [...TRAIT_KEYS].sort());
    const litter = createLitter({ litterId: `${code2}-l`, breedCode2: code2, bornEpoch: 2, sireId: `${code2}-s`, damId: `${code2}-d`, pupCount: 2, puppyDogIds: [`${code2}-p1`, `${code2}-p2`], puppySexes: ["M", "F"], sireTraits: foundation.dog.traits, damTraits: foundation.dog.traits, sireGenotype: foundation.dog.genotype!, damGenotype: foundation.dog.genotype!, sireGeneticsVersion: foundation.dog.geneticsVersion!, damGeneticsVersion: foundation.dog.geneticsVersion!, coiPercent: 0, coiGenerationDepth: 0, random01: rng, puppyGeneticsRandom01: () => rng });
    assert.ok(litter.puppies.every((puppy) => puppy.geneticsVersion === CURRENT_GENETICS_VERSION && puppy.regNumber.startsWith(code2)));
    assert.ok(resolveBreedGroupNameToCanonicalShowGroupCode(byCode.get(code2)!.groupName));
  }

  const profile = profileByCode.get("TO")!;
  const breedWeights = deriveBreedConformationCategoryWeights(toNormalizedBreedJudgingTraitWeights(profile));
  assert.equal(Object.keys(breedWeights).length, 5); assert.ok(!("CONDITIONING_HANDLING" in breedWeights));
  const judge = createJudge({ judgeId: "release-01", name: "release-01", style: "PRESENTATION_FOCUSED", random01: rng });
  const effective = combineBreedAndJudgeConformationWeights({ breedWeights, judgeWeights: Object.fromEntries(GENETIC_JUDGING_CATEGORIES.map((category) => [category, judge.categoryWeights[category]])) as typeof breedWeights });
  assert.ok(Math.abs(Object.values(effective).reduce((total, value) => total + value, 0) - FIXED_CONFORMATION_BUDGET) < 1e-9);
  const dog = { dogId: "integrated", regNumber: "TO000000101", breedCode2: "TO", birthEpoch: 1, sex: "M" as const, status: "ALIVE" as const, litterId: null, litterOrder: null, sireId: null, damId: null, traits };
  const result = judgeBreedBlock({ entries: [{ showEntryId: "entry", dog }], judge, conformationCategoryWeights: effective, random01: rng }).results[0];
  const audit = createBreedJudgingResultAudit({ effectiveConformationWeights: effective, judge, result });
  validateBreedWeightedResultAudit({ scoringVersion: "breed-weighted-v1", breedJudgingProfileId: "fixture", breedJudgingRulesVersion: profile.rulesVersion, audit });
  const typeScore = (value: number) => scoreDogByJudgeWeights({ dog: { ...dog, traits: { ...traits, head: value } }, judge, conformationCategoryWeights: effective, random01: rng }).weightedCategoryScores.TYPE_EXPRESSION;
  assert.equal(typeScore(9), typeScore(11), "fixed ideal is directional and symmetric"); assert.ok(typeScore(TRAIT_IDEAL) > typeScore(9));
  assert.equal(audit.effectiveCategoryWeights.CONDITIONING_HANDLING, judge.categoryWeights.CONDITIONING_HANDLING);

  const breeding = root("server/services/breeding.service.ts");
  const emergency = root("server/services/reproductiveEmergencyResolution.service.ts");
  const foundationService = root("server/services/foundationDog.service.ts");
  const schedule = root("server/services/showSchedule.service.ts");
  const entries = root("server/services/showEntry.service.ts");
  const migration = root("scripts/migrateCanonicalBreedData.ts");
  const dogsApi = root("app/api/dogs/mine/route.ts");
  assert.match(breeding, /createLitterWithCollisionRetry\(/); assert.match(breeding, /sireGenotype: fresh\.sire\.genotype/);
  assert.match(emergency, /resolveWhelp\(/); assert.match(emergency, /sireGenotype: attempt\.sire\.genotype/);
  assert.match(foundationService, /createFoundationDogProfile\(/);
  assert.match(schedule, /classType: "REGULAR"/); assert.match(entries, /classType: "REGULAR"/);
  assert.doesNotMatch(schedule + entries, /Bred-by-Exhibitor|6–9 Month Puppy|9–12 Month Puppy|Winners Dog|Winners Bitch/);
  assert.doesNotMatch(migration, /showEntry|classType|winner/i);
  assert.doesNotMatch(dogsApi, /genotype|geneticsVersion|breedJudgingAudit|effectiveCategoryWeights|realizedRandomness/);
  assert.equal(CURRENT_BREED_RELEASE, 19);
  console.log(JSON.stringify({ canonicalBreeds: canonical.length, activeProfiles: profiles.filter((item) => item.isActive).length, baselineBreeds: baseline.length, newBreeds: 54, representatives: ["LR", "KK", "AL", "TO"], genotype: { traits: TRAIT_KEYS.length, loci: TOTAL_LOCI, alleles: TOTAL_ALLELE_VALUES }, conformationBudget: Object.values(effective).reduce((total, value) => total + value, 0), classDeferral: "current REGULAR/INVITATIONAL behavior only", release: CURRENT_BREED_RELEASE }, null, 2));
  console.log("Post-Invitational integrated release checks passed.");
}

main();
