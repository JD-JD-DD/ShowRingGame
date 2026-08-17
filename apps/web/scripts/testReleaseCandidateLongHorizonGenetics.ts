import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CURRENT_GENETICS_VERSION, TOTAL_ALLELE_VALUES, TOTAL_LOCI, TRAIT_KEYS,
  createFoundationDogProfile, createResetFoundationPopulationContext, decodeGenotype, deriveBreedConformationCategoryWeights, encodeGenotype,
  type NormalizedBreedTraitWeights,
} from "@showring/rules";
import { FINAL_GENETICS_CALIBRATION } from "../../../packages/rules/calibration/geneticsCalibration.constants";
import {
  DEFAULT_POPULATION_GROWTH_SCHEDULE, FounderDistributionFamily, PopulationScale,
  SimulationRng, SimulationScenario, createSyntheticFounder, runExtremeBirthExperiment,
  runProducerConsistencyExperiment, runRepeatedLitterExperiment, runScenarioSimulation,
  type CheckpointMetrics, type ScenarioSimulationResult,
} from "../../../packages/rules/simulation/geneticsCalibration.simulation";
import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, toNormalizedBreedJudgingTraitWeights, validateBreedJudgingProfileCoverage } from "../server/services/breedJudgingProfile.service";

const SEEDS = Array.from({ length: 10 }, (_, index) => `release-02-${String(index + 1).padStart(2, "0")}`);
const STRESS_SEEDS = SEEDS.slice(0, 3);
const checkpoints = [0, 3, 10, 20, 50, 100, 200];
const traits: NormalizedBreedTraitWeights = { head: 10, forequarters: 10, hindquarters: 10, gait: 10, coat: 10, size: 10, temperament: 10, show_shine: 10, feet: 10, topline: 10 };
const csv = (name: string) => readFileSync(resolve(process.cwd(), `prisma/data/${name}`), "utf8");
const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
const range = (values: number[]) => [Math.min(...values), Math.max(...values)] as const;

function config(seed: string) {
  return { seed, generations: 200, founderSireCount: 6, founderDamCount: 10, litterSize: 4, matingsPerGeneration: 6, retainedSireCount: 4, retainedDamCount: 8, founderAlleleEffectSpread: FINAL_GENETICS_CALIBRATION.founderDistribution.spread, founderDistribution: FINAL_GENETICS_CALIBRATION.founderDistribution as { family: typeof FounderDistributionFamily.NORMAL_LIKE; spread: number }, mutation: FINAL_GENETICS_CALIBRATION.mutation, breedBackgroundCoefficient: FINAL_GENETICS_CALIBRATION.breedBackgroundCoefficient };
}

function checkpointReport(runs: ScenarioSimulationResult[]) {
  return Object.fromEntries(checkpoints.map((generation) => {
    const metrics = runs.map((run) => run.checkpoints.find((checkpoint) => checkpoint.generation === generation)!);
    const mads = metrics.map((metric) => metric.meanMad);
    return [generation, { medianPopulationMad: [...mads].sort((a, b) => a - b)[Math.floor(mads.length / 2)], range: range(mads), bestDogMad: range(metrics.map((metric) => metric.bestMad)), diversityHomozygosity: range(metrics.map((metric) => metric.diversity.meanHomozygosity)), fixedLoci: range(metrics.map((metric) => metric.diversity.fixedLoci)), exact10TraitFrequency: range(metrics.map((metric) => metric.exact10.traitFrequency)), allTenNearPerfectPointOne: range(metrics.map((metric) => metric.nearPerfect["0.100"])), directional: Object.fromEntries(TRAIT_KEYS.map((trait) => [trait, { below: mean(metrics.map((metric) => metric.perTrait[trait].below)), above: mean(metrics.map((metric) => metric.perTrait[trait].above)) }])) }];
  }));
}

function main() {
  assert.equal(CURRENT_GENETICS_VERSION, "showring-genotype-v1"); assert.equal(TOTAL_LOCI, 40); assert.equal(TOTAL_ALLELE_VALUES, 80);
  assert.deepEqual(FINAL_GENETICS_CALIBRATION, { founderDistribution: { family: "NORMAL_LIKE", spread: 14 }, mutation: { probability: .001, effectMagnitude: .005 }, breedBackgroundCoefficient: 0 });
  const canonical = parseCanonicalBreedsCsv(csv("breeds.csv"));
  const profiles = validateBreedJudgingProfileCoverage({ canonicalBreeds: canonical, profiles: parseBreedJudgingProfilesCsv(csv("JUDGE-01_Breed_Judging_Profile.csv")) });
  assert.equal(canonical.length, 318); assert.equal(profiles.length, 318);
  const profileByBreed = new Map(profiles.map((profile) => [profile.breed, profile]));
  for (const breed of ["Alaskan Klee Kai", "American Leopard Hound", "Tosa Inu", "South Russian Ovcharka", "Halden Hound", "Kuvasz", "Swedish Vallhund"]) assert.ok(profileByBreed.has(breed), `${breed} final profile`);
  const profileWeights = [...profileByBreed.values()].map((profile) => deriveBreedConformationCategoryWeights(toNormalizedBreedJudgingTraitWeights(profile)));
  assert.ok(new Set(profileWeights.map((weights) => JSON.stringify(weights))).size > 5, "final profiles retain differentiated emphasis without affecting inheritance");

  const normal = SEEDS.map((seed) => runScenarioSimulation({ ...config(seed), scenario: SimulationScenario.NORMAL_SELECTION }));
  const aggressive = STRESS_SEEDS.map((seed) => runScenarioSimulation({ ...config(seed), scenario: SimulationScenario.AGGRESSIVE_HIGH_VOLUME, scenarioOptions: { matingsPerGeneration: 18, litterSize: 8 } }));
  const popular = STRESS_SEEDS.map((seed) => runScenarioSimulation({ ...config(seed), scenario: SimulationScenario.POPULAR_SIRE, scenarioOptions: { popularSireCount: 1, popularSireMatingShare: .75 } }));
  const bottleneck = STRESS_SEEDS.map((seed) => runScenarioSimulation({ ...config(seed), scenario: SimulationScenario.BOTTLENECK, scenarioOptions: { bottleneckStartGeneration: 50, bottleneckDuration: 8, bottleneckSireCount: 1, bottleneckDamCount: 2, bottleneckFamilyCount: 1 } }));
  const outcross = STRESS_SEEDS.map((seed) => runScenarioSimulation({ ...config(seed), scenario: SimulationScenario.NORMAL_SELECTION, scenarioOptions: { outcross: { generation: 50, alleleEffect: 14 } } }));
  const scales = Object.fromEntries(Object.values(PopulationScale).map((scale) => [scale, runScenarioSimulation({ ...config(`scale-${scale}`), scenario: SimulationScenario.NORMAL_SELECTION, populationScale: scale })]));
  for (const run of [...normal, ...aggressive, ...popular, ...bottleneck, ...outcross, ...Object.values(scales)]) for (const checkpoint of run.checkpoints) {
    assert.equal(run.geneticsVersion, CURRENT_GENETICS_VERSION); assert.ok(Number.isFinite(checkpoint.meanMad) && checkpoint.meanMad >= 0); assert.ok(Object.values(checkpoint.perTrait).every((trait) => Number.isFinite(trait.mean) && trait.mean >= 0 && trait.mean <= 20));
  }
  assert.ok(mean(normal.map((run) => run.checkpoints.find((checkpoint) => checkpoint.generation === 3)!.meanMad)) < mean(normal.map((run) => run.checkpoints[0].meanMad)), "normal selection improves early");
  assert.ok(mean(normal.map((run) => run.checkpoints.at(-1)!.meanMad)) < mean(normal.map((run) => run.checkpoints.find((checkpoint) => checkpoint.generation === 20)!.meanMad)), "long-term selection remains productive");
  assert.ok(normal.every((run) => run.checkpoints.at(-1)!.nearPerfect["0.100"] === 0), "no routine all-ten near perfection at G200");
  assert.ok(popular.every((run) => run.contributionAudits.some((audit) => audit.maxSireContributionShare >= .75)), "popular-sire pressure is real");
  assert.ok(mean(popular.map((run) => run.checkpoints.at(-1)!.diversity.fixedLoci)) >= mean(normal.map((run) => run.checkpoints.at(-1)!.diversity.fixedLoci)), "popular-sire concentration carries fixation risk");
  assert.ok(bottleneck.every((run) => run.contributionAudits.some((audit) => audit.generation === 50 && audit.uniqueSiresUsed === 1)), "bottleneck is applied");
  assert.ok(aggressive.every((run) => run.cumulativeBirths > normal.find((candidate) => candidate.seed === run.seed)!.cumulativeBirths), "aggressive scenario increases opportunity without changing genetics constants");
  const founder = createSyntheticFounder(new SimulationRng("codec"), "codec", 0, "M", 14, FINAL_GENETICS_CALIBRATION.founderDistribution);
  assert.deepEqual(decodeGenotype(encodeGenotype(founder.genotype)).loci, founder.genotype.loci, "production genotype codec round trip");
  const litter = runRepeatedLitterExperiment({ seed: "release-litter", sire: founder, dam: createSyntheticFounder(new SimulationRng("dam"), "dam", 0, "F", 14, FINAL_GENETICS_CALIBRATION.founderDistribution), litterCount: 64, puppiesPerLitter: 8, mutation: FINAL_GENETICS_CALIBRATION.mutation });
  assert.ok(litter.uniqueGenotypes > 1 && litter.offspringMadVariance > 0, "siblings remain genetically and phenotypically variable");
  const producer = runProducerConsistencyExperiment("release-producer"); assert.ok(producer.phenotypeEqual && !producer.genotypeEqual && producer.first.offspringMadVariance !== producer.second.offspringMadVariance);
  const extremes = [100, 1_000, 10_000].map((births) => runExtremeBirthExperiment({ seed: `extreme-${births}`, sire: founder, dam: createSyntheticFounder(new SimulationRng(`dam-${births}`), `dam-${births}`, 0, "F", 14, FINAL_GENETICS_CALIBRATION.founderDistribution), births, mutation: FINAL_GENETICS_CALIBRATION.mutation }));
  assert.ok(extremes.every((result) => result.nearPerfectDogCount === 0), "extreme cohorts do not yield all-ten near-perfect dogs");
  const foundationCounts = [0, 0, 0];
  for (let index = 0; index < 2000; index += 1) { const dog = createFoundationDogProfile({ dogId: `foundation-${index}`, regNumber: `AL${String(index).padStart(9, "0")}`, breedCode2: "AL", birthEpoch: 0, callName: "Foundation", breedBaseline: { breedCode2: "AL", traitMeans: traits }, populationContext: createResetFoundationPopulationContext(), random01: new SimulationRng(`foundation-${index}`).next.bind(new SimulationRng(`foundation-${index}`)) }); foundationCounts[Math.min(2, dog.geneticsAnalysis.opportunityTargetCount)] += 1; assert.equal(dog.dog.geneticsVersion, CURRENT_GENETICS_VERSION); }
  const foundationShares = foundationCounts.map((count) => count / 2000);
  assert.deepEqual(foundationShares, [1, 0, 0], "RESET_FALLBACK has no live population shortage to target");
  const mutationCount = normal.reduce((total, run) => total + run.mutationAudit.count, 0); const transmissions = normal.reduce((total, run) => total + run.cumulativeBirths * 80, 0);
  const observedMutationRate = mutationCount / transmissions;
  assert.ok(observedMutationRate > .0005 && observedMutationRate < .0015, "observed mutation rate is consistent with final production probability");
  const report = { configuration: { geneticsVersion: CURRENT_GENETICS_VERSION, loci: TOTAL_LOCI, alleles: TOTAL_ALLELE_VALUES, ...FINAL_GENETICS_CALIBRATION, normalSeeds: SEEDS.length, stressSeeds: STRESS_SEEDS.length, checkpoints }, normal: checkpointReport(normal), aggressive: checkpointReport(aggressive), popularSire: checkpointReport(popular), bottleneck: checkpointReport(bottleneck), foundationOutcross: checkpointReport(outcross), populationScales: Object.fromEntries(Object.entries(scales).map(([scale, run]) => [scale, checkpointReport([run])])), extremeValue: extremes, litter: { variance: litter.offspringMadVariance, uniqueGenotypes: litter.uniqueGenotypes }, producer: { firstVariance: producer.first.offspringMadVariance, secondVariance: producer.second.offspringMadVariance }, mutation: { observedRate: observedMutationRate, count: mutationCount, expected: FINAL_GENETICS_CALIBRATION.mutation }, foundationResetFallbackOpportunityShares: { none: foundationShares[0], one: foundationShares[1], two: foundationShares[2] }, judgingProfiles: ["American Leopard Hound (new)", "Alaskan Klee Kai (Group changed)", "Tosa Inu", "South Russian Ovcharka", "Halden Hound", "Kuvasz", "Swedish Vallhund"], interpretation: "PASS: final GEN-06 constants and production-rule simulation retain early opportunity, later diminishing gains, diversity consequences, and no routine all-ten near perfection." };
  console.log(JSON.stringify(report, null, 2)); console.log("RELEASE-02 long-horizon release-candidate validation passed.");
}

main();
