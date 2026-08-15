import {
  CURRENT_GENETICS_VERSION,
  TOTAL_LOCI,
  TRAIT_IDEAL,
  TRAIT_KEYS,
  assertCanonicalGenotype,
  calculatePhenotypeFromGenotype,
  inheritModelDGenotype,
  type CanonicalGenotype,
  type GenotypePhenotype,
  type ModelDMutationConfig,
} from "../src/index";

export const GENETICS_CALIBRATION_METHODOLOGY_VERSION = "genetics-calibration-v1";
/** MasterFile long-horizon diagnostic bands; descriptive only, never selection criteria. */
export const LONG_HORIZON_MAD_TARGET_BANDS = {
  G3: "approximately 2.0–2.4", G10: "approximately 1.2–1.7", G20: "approximately 0.8–1.3",
  G50: "approximately 0.45–0.9", G100: "approximately 0.30–0.7", G200: "approximately 0.20–0.55",
} as const;

export class SimulationRng {
  private state: number;

  constructor(seed: string) {
    let hash = 2166136261;
    for (const character of seed) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    this.state = hash >>> 0;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export type SimulationDog = {
  id: string;
  generation: number;
  sex: "M" | "F";
  genotype: CanonicalGenotype;
  phenotype: GenotypePhenotype;
  sireId?: string;
  damId?: string;
  familyId: string;
};

export type SimulationConfig = {
  seed: string;
  generations: number;
  founderSireCount: number;
  founderDamCount: number;
  litterSize: number;
  matingsPerGeneration: number;
  retainedSireCount: number;
  retainedDamCount: number;
  founderAlleleEffectSpread: number;
  mutation: ModelDMutationConfig;
  breedBackgroundCoefficient: number;
};

export const SimulationScenario = {
  NORMAL_SELECTION: "NORMAL_SELECTION",
  AGGRESSIVE_HIGH_VOLUME: "AGGRESSIVE_HIGH_VOLUME",
  POPULAR_SIRE: "POPULAR_SIRE",
  BOTTLENECK: "BOTTLENECK",
  DIVERSITY_PRESERVING: "DIVERSITY_PRESERVING",
} as const;
export type SimulationScenario = typeof SimulationScenario[keyof typeof SimulationScenario];

export type ScenarioOptions = {
  /** Scenario-only birth volume; the NORMAL_SELECTION config remains untouched. */
  matingsPerGeneration?: number;
  litterSize?: number;
  retainedSireCount?: number;
  retainedDamCount?: number;
  popularSireCount?: number;
  popularSireMatingShare?: number;
  bottleneckStartGeneration?: number;
  bottleneckDuration?: number;
  bottleneckSireCount?: number;
  bottleneckDamCount?: number;
  bottleneckFamilyCount?: number;
  outcross?: { generation: number; donorSex?: "M" | "F"; alleleEffect: number };
};

export type ScenarioSimulationConfig = SimulationConfig & {
  scenario: SimulationScenario;
  scenarioOptions?: ScenarioOptions;
};

export type TraitMetrics = {
  mean: number;
  mad: number;
  standardDeviation: number;
  below: number;
  exact: number;
  above: number;
};

export type CheckpointMetrics = {
  generation: number;
  meanMad: number;
  medianMad: number;
  bestMad: number;
  worstMad: number;
  perTrait: Record<string, TraitMetrics>;
  exact10: { traitFrequency: number; dogsWithAny: number; dogsAllTen: number };
  nearPerfect: Record<string, number>;
  diversity: {
    meanHomozygosity: number;
    meanUniqueAlleles: number;
    maxAlleleConcentration: number;
    meanAlleleStandardDeviation: number;
    fixedLoci: number;
  };
  clampFrequency: number;
  mutationCount: number;
};

export type SimulationResult = {
  methodologyVersion: string;
  geneticsVersion: string;
  seed: string;
  configuration: SimulationConfig;
  checkpoints: CheckpointMetrics[];
  totalMutationCount: number;
  finalPopulationSize: number;
};

export type ContributionAudit = {
  generation: number;
  births: number;
  uniqueSiresUsed: number;
  uniqueDamsUsed: number;
  representedFamilies: number;
  maxSireContributionShare: number;
  maxFamilyContributionShare: number;
  dominantSireId?: string;
  dominantSireDescendants: number;
  outcrossDonorId?: string;
};

export type ScenarioSimulationResult = SimulationResult & {
  scenario: SimulationScenario;
  contributionAudits: ContributionAudit[];
};

export type LitterExperimentResult = {
  puppyCount: number;
  meanOffspringMad: number;
  offspringMadVariance: number;
  bestPuppyMad: number;
  worstPuppyMad: number;
  parentMidpointMad: number;
  betterThanParentMidpointPercent: number;
  worseThanParentMidpointPercent: number;
  betweenParentsPercent: number;
  perTraitVariance: Record<string, number>;
  uniqueGenotypes: number;
  mutationCount: number;
  puppies: SimulationDog[];
};

const CHECKPOINTS = [0, 3, 10, 20, 50, 100, 200] as const;
const NEAR_PERFECT_THRESHOLDS = [1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;

function roundToSixDecimals(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function getSimulationDogMad(dog: SimulationDog): number {
  return TRAIT_KEYS.reduce(
    (sum, trait) => sum + Math.abs(dog.phenotype[trait] - TRAIT_IDEAL),
    0,
  ) / TRAIT_KEYS.length;
}

export function createSyntheticFounder(
  rng: SimulationRng,
  id: string,
  generation: number,
  sex: "M" | "F",
  spread: number,
): SimulationDog {
  const loci = Array.from({ length: TOTAL_LOCI }, () => [
    roundToSixDecimals((rng.next() * 2 - 1) * spread),
    roundToSixDecimals((rng.next() * 2 - 1) * spread),
  ] as const);
  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertCanonicalGenotype(genotype);
  return { id, generation, sex, genotype, phenotype: calculatePhenotypeFromGenotype(genotype), familyId: id };
}

function median(sortedValues: number[]): number {
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? (sortedValues[middle - 1] + sortedValues[middle]) / 2
    : sortedValues[middle];
}

export function calculateCheckpointMetrics(
  population: SimulationDog[],
  generation: number,
  mutationCount: number,
): CheckpointMetrics {
  if (population.length === 0) throw new Error("Simulation population cannot be empty.");
  const scores = population.map(getSimulationDogMad).sort((left, right) => left - right);
  const traitValues = TRAIT_KEYS.flatMap((trait) => population.map((dog) => dog.phenotype[trait]));
  const perTrait = Object.fromEntries(TRAIT_KEYS.map((trait) => {
    const values = population.map((dog) => dog.phenotype[trait]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [trait, {
      mean,
      mad: values.reduce((sum, value) => sum + Math.abs(value - TRAIT_IDEAL), 0) / values.length,
      standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length),
      below: values.filter((value) => value < TRAIT_IDEAL).length,
      exact: values.filter((value) => value === TRAIT_IDEAL).length,
      above: values.filter((value) => value > TRAIT_IDEAL).length,
    } satisfies TraitMetrics];
  }));
  const locusAlleles = Array.from({ length: TOTAL_LOCI }, (_, locus) => population.flatMap((dog) => dog.genotype.loci[locus]));
  const homozygosity = Array.from({ length: TOTAL_LOCI }, (_, locus) =>
    population.filter((dog) => dog.genotype.loci[locus][0] === dog.genotype.loci[locus][1]).length / population.length,
  );
  const concentrations = locusAlleles.map((alleles) => {
    const counts = new Map<number, number>();
    for (const allele of alleles) counts.set(allele, (counts.get(allele) ?? 0) + 1);
    return Math.max(...counts.values()) / alleles.length;
  });
  const alleleStandardDeviations = locusAlleles.map((alleles) => {
    const mean = alleles.reduce((sum, allele) => sum + allele, 0) / alleles.length;
    return Math.sqrt(alleles.reduce((sum, allele) => sum + (allele - mean) ** 2, 0) / alleles.length);
  });

  return {
    generation,
    meanMad: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    medianMad: median(scores),
    bestMad: scores[0],
    worstMad: scores[scores.length - 1],
    perTrait,
    exact10: {
      traitFrequency: traitValues.filter((value) => value === TRAIT_IDEAL).length / traitValues.length,
      dogsWithAny: population.filter((dog) => TRAIT_KEYS.some((trait) => dog.phenotype[trait] === TRAIT_IDEAL)).length,
      dogsAllTen: population.filter((dog) => TRAIT_KEYS.every((trait) => dog.phenotype[trait] === TRAIT_IDEAL)).length,
    },
    nearPerfect: Object.fromEntries(NEAR_PERFECT_THRESHOLDS.map((threshold) => [
      threshold.toFixed(3),
      population.filter((dog) => TRAIT_KEYS.every((trait) => Math.abs(dog.phenotype[trait] - TRAIT_IDEAL) <= threshold)).length,
    ])),
    diversity: {
      meanHomozygosity: homozygosity.reduce((sum, value) => sum + value, 0) / TOTAL_LOCI,
      meanUniqueAlleles: locusAlleles.reduce((sum, alleles) => sum + new Set(alleles).size, 0) / TOTAL_LOCI,
      maxAlleleConcentration: Math.max(...concentrations),
      meanAlleleStandardDeviation: alleleStandardDeviations.reduce((sum, value) => sum + value, 0) / TOTAL_LOCI,
      fixedLoci: concentrations.filter((concentration) => concentration >= 0.99).length,
    },
    clampFrequency: traitValues.filter((value) => value === 0 || value === 20).length / traitValues.length,
    mutationCount,
  };
}

function validateConfig(config: SimulationConfig): void {
  const positiveIntegers: Array<[string, number]> = [
    ["generations", config.generations], ["founderSireCount", config.founderSireCount],
    ["founderDamCount", config.founderDamCount], ["litterSize", config.litterSize],
    ["matingsPerGeneration", config.matingsPerGeneration], ["retainedSireCount", config.retainedSireCount],
    ["retainedDamCount", config.retainedDamCount],
  ];
  for (const [name, value] of positiveIntegers) {
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  }
  if (!Number.isFinite(config.founderAlleleEffectSpread) || config.founderAlleleEffectSpread < 0) {
    throw new Error("founderAlleleEffectSpread must be finite and non-negative.");
  }
  if (!Number.isFinite(config.breedBackgroundCoefficient) || config.breedBackgroundCoefficient < 0) {
    throw new Error("breedBackgroundCoefficient must be finite and non-negative.");
  }
}

function rankForRetention(dogs: SimulationDog[]): SimulationDog[] {
  return [...dogs].sort((left, right) => getSimulationDogMad(left) - getSimulationDogMad(right) || left.id.localeCompare(right.id));
}

export function runNormalSelectionSimulation(config: SimulationConfig): SimulationResult {
  validateConfig(config);
  const rng = new SimulationRng(config.seed);
  let population: SimulationDog[] = [];
  for (let index = 0; index < config.founderSireCount; index += 1) population.push(createSyntheticFounder(rng, `g0-s${index}`, 0, "M", config.founderAlleleEffectSpread));
  for (let index = 0; index < config.founderDamCount; index += 1) population.push(createSyntheticFounder(rng, `g0-d${index}`, 0, "F", config.founderAlleleEffectSpread));

  const checkpointGenerations: number[] = CHECKPOINTS.filter((generation) => generation <= config.generations);
  const checkpoints: CheckpointMetrics[] = [];
  if (checkpointGenerations.includes(0)) checkpoints.push(calculateCheckpointMetrics(population, 0, 0));
  let totalMutationCount = 0;

  for (let generation = 1; generation <= config.generations; generation += 1) {
    const sires = rankForRetention(population.filter((dog) => dog.sex === "M")).slice(0, config.retainedSireCount);
    const dams = rankForRetention(population.filter((dog) => dog.sex === "F")).slice(0, config.retainedDamCount);
    if (sires.length === 0 || dams.length === 0) throw new Error(`Generation ${generation} has no selectable parent of one sex.`);
    const children: SimulationDog[] = [];
    let generationMutationCount = 0;
    for (let mating = 0; mating < config.matingsPerGeneration; mating += 1) {
      for (let puppy = 0; puppy < config.litterSize; puppy += 1) {
        const sire = sires[mating % sires.length];
        const dam = dams[mating % dams.length];
        const inherited = inheritModelDGenotype({
          sireGenotype: sire.genotype,
          damGenotype: dam.genotype,
          random01: () => rng.next(),
          mutation: config.mutation,
          // Synthetic founders have no LIVE population distribution in this baseline harness.
          breedBackground: { version: "breed-background-v1", coefficient: config.breedBackgroundCoefficient, sourceStatus: "BASELINE" },
        });
        generationMutationCount += inherited.mutationCount;
        children.push({
          id: `g${generation}-${mating}-${puppy}`,
          generation,
          sex: children.length % 2 === 0 ? "M" : "F",
          genotype: inherited.genotype,
          phenotype: inherited.phenotype,
          sireId: sire.id,
          damId: dam.id,
          familyId: sire.familyId,
        });
      }
    }
    totalMutationCount += generationMutationCount;
    population = children;
    if (checkpointGenerations.includes(generation)) checkpoints.push(calculateCheckpointMetrics(population, generation, generationMutationCount));
  }

  return {
    methodologyVersion: GENETICS_CALIBRATION_METHODOLOGY_VERSION,
    geneticsVersion: CURRENT_GENETICS_VERSION,
    seed: config.seed,
    configuration: config,
    checkpoints,
    totalMutationCount,
    finalPopulationSize: population.length,
  };
}

function scenarioCount(value: number | undefined, fallback: number): number {
  return value === undefined ? fallback : value;
}

function selectFamilies(dogs: SimulationDog[], count: number, familyLimit?: number): SimulationDog[] {
  const ranked = rankForRetention(dogs);
  if (!familyLimit) return ranked.slice(0, count);
  const allowedFamilies = [...new Set(ranked.map((dog) => dog.familyId))].slice(0, familyLimit);
  return ranked.filter((dog) => allowedFamilies.includes(dog.familyId)).slice(0, count);
}

/** Pedigree-aware selection only: it never reads hidden allele values. */
function selectDiversityPreserving(dogs: SimulationDog[], count: number): SimulationDog[] {
  const ranked = rankForRetention(dogs);
  const selected: SimulationDog[] = [];
  const represented = new Set<string>();
  for (const dog of ranked) {
    if (!represented.has(dog.familyId)) {
      selected.push(dog);
      represented.add(dog.familyId);
      if (selected.length === count) return selected;
    }
  }
  for (const dog of ranked) {
    if (!selected.includes(dog)) selected.push(dog);
    if (selected.length === count) break;
  }
  return selected;
}

function contributionAudit(generation: number, pairs: Array<{ sire: SimulationDog; dam: SimulationDog }>, litterSize: number): ContributionAudit {
  const sireCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const damIds = new Set<string>();
  for (const pair of pairs) {
    sireCounts.set(pair.sire.id, (sireCounts.get(pair.sire.id) ?? 0) + 1);
    familyCounts.set(pair.sire.familyId, (familyCounts.get(pair.sire.familyId) ?? 0) + 1);
    damIds.add(pair.dam.id);
  }
  const dominant = [...sireCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  const maxFamily = Math.max(...familyCounts.values());
  return {
    generation, births: pairs.length * litterSize, uniqueSiresUsed: sireCounts.size, uniqueDamsUsed: damIds.size,
    representedFamilies: familyCounts.size, maxSireContributionShare: dominant[1] / pairs.length,
    maxFamilyContributionShare: maxFamily / pairs.length, dominantSireId: dominant[0],
    dominantSireDescendants: dominant[1] * litterSize,
  };
}

export function createSimulationOutcrossDonor(id: string, generation: number, sex: "M" | "F", alleleEffect: number): SimulationDog {
  const loci = Array.from({ length: TOTAL_LOCI }, (_, locus) => {
    const sign = Math.floor(locus / 4) % 2 === 0 ? 1 : -1;
    return [sign * alleleEffect, sign * alleleEffect] as const;
  });
  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertCanonicalGenotype(genotype);
  return { id, generation, sex, genotype, phenotype: calculatePhenotypeFromGenotype(genotype), familyId: id };
}

/**
 * Scenario runner: all breeding uses the normal Model D engine. Scenario policy
 * changes only who is mated and how many ordinary offspring are produced.
 */
export function runScenarioSimulation(config: ScenarioSimulationConfig): ScenarioSimulationResult {
  validateConfig(config);
  const rng = new SimulationRng(config.seed);
  const options = config.scenarioOptions ?? {};
  const matingCount = scenarioCount(options.matingsPerGeneration, config.matingsPerGeneration);
  const litterSize = scenarioCount(options.litterSize, config.litterSize);
  const retainedSireCount = scenarioCount(options.retainedSireCount, config.retainedSireCount);
  const retainedDamCount = scenarioCount(options.retainedDamCount, config.retainedDamCount);
  let population: SimulationDog[] = [];
  for (let index = 0; index < config.founderSireCount; index += 1) population.push(createSyntheticFounder(rng, `g0-s${index}`, 0, "M", config.founderAlleleEffectSpread));
  for (let index = 0; index < config.founderDamCount; index += 1) population.push(createSyntheticFounder(rng, `g0-d${index}`, 0, "F", config.founderAlleleEffectSpread));
  const checkpointGenerations: number[] = CHECKPOINTS.filter((generation) => generation <= config.generations);
  const checkpoints: CheckpointMetrics[] = [];
  const contributionAudits: ContributionAudit[] = [];
  if (checkpointGenerations.includes(0)) checkpoints.push(calculateCheckpointMetrics(population, 0, 0));
  let totalMutationCount = 0;

  for (let generation = 1; generation <= config.generations; generation += 1) {
    const bottleneckActive = config.scenario === SimulationScenario.BOTTLENECK &&
      generation >= (options.bottleneckStartGeneration ?? 20) &&
      generation < (options.bottleneckStartGeneration ?? 20) + (options.bottleneckDuration ?? 5);
    const sireCount = bottleneckActive ? scenarioCount(options.bottleneckSireCount, 1) : retainedSireCount;
    const damCount = bottleneckActive ? scenarioCount(options.bottleneckDamCount, 2) : retainedDamCount;
    const familyLimit = bottleneckActive ? scenarioCount(options.bottleneckFamilyCount, 1) : undefined;
    const males = population.filter((dog) => dog.sex === "M");
    const females = population.filter((dog) => dog.sex === "F");
    let sires = selectFamilies(males, sireCount, familyLimit);
    let dams = selectFamilies(females, damCount, familyLimit);
    if (config.scenario === SimulationScenario.DIVERSITY_PRESERVING) {
      sires = selectDiversityPreserving(males, sireCount);
      dams = selectDiversityPreserving(females, damCount);
    }
    if (sires.length === 0 || dams.length === 0) throw new Error(`Generation ${generation} has no selectable parent of one sex.`);
    const pairs: Array<{ sire: SimulationDog; dam: SimulationDog }> = [];
    const popularMatingCount = config.scenario === SimulationScenario.POPULAR_SIRE
      ? Math.min(matingCount, Math.ceil(matingCount * scenarioCount(options.popularSireMatingShare, 0.8))) : 0;
    const eliteSires = sires.slice(0, scenarioCount(options.popularSireCount, 1));
    for (let mating = 0; mating < matingCount; mating += 1) {
      const sire = mating < popularMatingCount ? eliteSires[mating % eliteSires.length] : sires[mating % sires.length];
      pairs.push({ sire, dam: dams[mating % dams.length] });
    }
    const outcross = options.outcross?.generation === generation ? options.outcross : undefined;
    if (outcross) {
      const donorSex = outcross.donorSex ?? "M";
      const donor = createSimulationOutcrossDonor(`outcross-g${generation}`, generation, donorSex, outcross.alleleEffect);
      const replacementIndex = pairs.length - 1;
      pairs[replacementIndex] = donorSex === "M" ? { sire: donor, dam: dams[0] } : { sire: sires[0], dam: donor };
    }
    const audit = contributionAudit(generation, pairs, litterSize);
    if (outcross) audit.outcrossDonorId = `outcross-g${generation}`;
    contributionAudits.push(audit);
    const children: SimulationDog[] = [];
    let generationMutationCount = 0;
    pairs.forEach((pair, mating) => {
      for (let puppy = 0; puppy < litterSize; puppy += 1) {
        const inherited = inheritModelDGenotype({
          sireGenotype: pair.sire.genotype, damGenotype: pair.dam.genotype, random01: () => rng.next(), mutation: config.mutation,
          breedBackground: { version: "breed-background-v1", coefficient: config.breedBackgroundCoefficient, sourceStatus: "BASELINE" },
        });
        generationMutationCount += inherited.mutationCount;
        children.push({ id: `g${generation}-${mating}-${puppy}`, generation, sex: children.length % 2 === 0 ? "M" : "F", genotype: inherited.genotype, phenotype: inherited.phenotype, sireId: pair.sire.id, damId: pair.dam.id, familyId: pair.sire.familyId });
      }
    });
    totalMutationCount += generationMutationCount;
    population = children;
    if (checkpointGenerations.includes(generation)) checkpoints.push(calculateCheckpointMetrics(population, generation, generationMutationCount));
  }
  return { methodologyVersion: GENETICS_CALIBRATION_METHODOLOGY_VERSION, geneticsVersion: CURRENT_GENETICS_VERSION, seed: config.seed, configuration: config, checkpoints, totalMutationCount, finalPopulationSize: population.length, scenario: config.scenario, contributionAudits };
}

/** Repeats real Model D litters. "Better" means lower ten-trait MAD than the parents' MAD midpoint. */
export function runRepeatedLitterExperiment(args: { seed: string; sire: SimulationDog; dam: SimulationDog; litterCount: number; puppiesPerLitter: number; mutation: ModelDMutationConfig; breedBackgroundCoefficient?: number }): LitterExperimentResult {
  const rng = new SimulationRng(args.seed);
  const puppies: SimulationDog[] = [];
  let mutationCount = 0;
  for (let litter = 0; litter < args.litterCount; litter += 1) for (let puppy = 0; puppy < args.puppiesPerLitter; puppy += 1) {
    const inherited = inheritModelDGenotype({ sireGenotype: args.sire.genotype, damGenotype: args.dam.genotype, random01: () => rng.next(), mutation: args.mutation, breedBackground: { version: "breed-background-v1", coefficient: args.breedBackgroundCoefficient ?? 0, sourceStatus: "BASELINE" } });
    mutationCount += inherited.mutationCount;
    puppies.push({ id: `l${litter}-p${puppy}`, generation: 0, sex: puppies.length % 2 === 0 ? "M" : "F", genotype: inherited.genotype, phenotype: inherited.phenotype, sireId: args.sire.id, damId: args.dam.id, familyId: args.sire.familyId });
  }
  const scores = puppies.map(getSimulationDogMad); const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const parentSireMad = getSimulationDogMad(args.sire); const parentDamMad = getSimulationDogMad(args.dam); const midpoint = (parentSireMad + parentDamMad) / 2;
  const low = Math.min(parentSireMad, parentDamMad); const high = Math.max(parentSireMad, parentDamMad);
  return { puppyCount: puppies.length, meanOffspringMad: mean, offspringMadVariance: scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / scores.length, bestPuppyMad: Math.min(...scores), worstPuppyMad: Math.max(...scores), parentMidpointMad: midpoint, betterThanParentMidpointPercent: puppies.filter((dog) => getSimulationDogMad(dog) < midpoint).length / puppies.length, worseThanParentMidpointPercent: puppies.filter((dog) => getSimulationDogMad(dog) > midpoint).length / puppies.length, betweenParentsPercent: puppies.filter((dog) => getSimulationDogMad(dog) >= low && getSimulationDogMad(dog) <= high).length / puppies.length, perTraitVariance: Object.fromEntries(TRAIT_KEYS.map((trait) => { const values = puppies.map((dog) => dog.phenotype[trait]); const traitMean = values.reduce((sum, value) => sum + value, 0) / values.length; return [trait, values.reduce((sum, value) => sum + (value - traitMean) ** 2, 0) / values.length]; })), uniqueGenotypes: new Set(puppies.map((dog) => JSON.stringify(dog.genotype.loci))).size, mutationCount, puppies };
}

function dogFromLoci(id: string, sex: "M" | "F", loci: CanonicalGenotype["loci"]): SimulationDog {
  const genotype: CanonicalGenotype = { geneticsVersion: CURRENT_GENETICS_VERSION, loci };
  assertCanonicalGenotype(genotype);
  return { id, generation: 0, sex, genotype, phenotype: calculatePhenotypeFromGenotype(genotype), familyId: id };
}

export type ProducerConsistencyResult = { first: LitterExperimentResult; second: LitterExperimentResult; phenotypeEqual: boolean; genotypeEqual: boolean };

/** Equal phenotype, intentionally different allele arrangements, paired to the same complementary dam. */
export function runProducerConsistencyExperiment(seed = "producer-consistency-v1"): ProducerConsistencyResult {
  const heterozygousNeutral = Array.from({ length: TOTAL_LOCI }, () => [-0.4, 0.4] as const);
  const homozygousNeutral = Array.from({ length: TOTAL_LOCI }, () => [0, 0] as const);
  const complementaryDam = Array.from({ length: TOTAL_LOCI }, (_, locus) => locus % 2 === 0 ? [-0.7, 0.3] as const : [-0.3, 0.7] as const);
  const firstSire = dogFromLoci("producer-heterozygous", "M", heterozygousNeutral);
  const secondSire = dogFromLoci("producer-homozygous", "M", homozygousNeutral);
  const dam = dogFromLoci("producer-dam", "F", complementaryDam);
  return {
    first: runRepeatedLitterExperiment({ seed: `${seed}-a`, sire: firstSire, dam, litterCount: 12, puppiesPerLitter: 8, mutation: { probability: 0, effectMagnitude: 0 } }),
    second: runRepeatedLitterExperiment({ seed: `${seed}-b`, sire: secondSire, dam, litterCount: 12, puppiesPerLitter: 8, mutation: { probability: 0, effectMagnitude: 0 } }),
    phenotypeEqual: JSON.stringify(firstSire.phenotype) === JSON.stringify(secondSire.phenotype),
    genotypeEqual: JSON.stringify(firstSire.genotype.loci) === JSON.stringify(secondSire.genotype.loci),
  };
}

export type ComplementarityExperimentResult = { belowParentMad: number; aboveParentMad: number; litter: LitterExperimentResult; exactIdealCount: number };

/** Opposite-side directional parents; ordinary segregation may, but need not, yield exact ideal offspring. */
export function runComplementarityExperiment(seed = "complementarity-v1"): ComplementarityExperimentResult {
  const below = dogFromLoci("below-ideal", "M", Array.from({ length: TOTAL_LOCI }, () => [-0.75, -0.25] as const));
  const above = dogFromLoci("above-ideal", "F", Array.from({ length: TOTAL_LOCI }, () => [0.25, 0.75] as const));
  const litter = runRepeatedLitterExperiment({ seed, sire: below, dam: above, litterCount: 16, puppiesPerLitter: 8, mutation: { probability: 0, effectMagnitude: 0 } });
  return { belowParentMad: getSimulationDogMad(below), aboveParentMad: getSimulationDogMad(above), litter, exactIdealCount: litter.puppies.filter((dog) => getSimulationDogMad(dog) === 0).length };
}

export const DEFAULT_SCENARIO_OPTIONS: Record<SimulationScenario, ScenarioOptions> = {
  NORMAL_SELECTION: {},
  AGGRESSIVE_HIGH_VOLUME: { matingsPerGeneration: 48, litterSize: 10, retainedSireCount: 6, retainedDamCount: 12 },
  POPULAR_SIRE: { popularSireCount: 1, popularSireMatingShare: 0.8 },
  BOTTLENECK: { bottleneckStartGeneration: 20, bottleneckDuration: 5, bottleneckSireCount: 1, bottleneckDamCount: 2, bottleneckFamilyCount: 1 },
  DIVERSITY_PRESERVING: {},
};

export type ScenarioComparisonRow = {
  scenario: SimulationScenario;
  g3Mad?: number; g10Mad?: number; g20Mad?: number; g50Mad?: number; g100Mad?: number; g200Mad?: number;
  g200Homozygosity?: number; g200FixedLoci?: number; g200Exact10Frequency?: number; g200NearPerfectFrequency?: number;
  maxSireShare: number; familyDiversity: number;
};

export function summarizeScenario(result: ScenarioSimulationResult): ScenarioComparisonRow {
  const at = (generation: number) => result.checkpoints.find((checkpoint) => checkpoint.generation === generation);
  const final = at(200) ?? result.checkpoints.at(-1);
  return { scenario: result.scenario, g3Mad: at(3)?.meanMad, g10Mad: at(10)?.meanMad, g20Mad: at(20)?.meanMad, g50Mad: at(50)?.meanMad, g100Mad: at(100)?.meanMad, g200Mad: at(200)?.meanMad, g200Homozygosity: final?.diversity.meanHomozygosity, g200FixedLoci: final?.diversity.fixedLoci, g200Exact10Frequency: final?.exact10.traitFrequency, g200NearPerfectFrequency: final?.nearPerfect["0.100"], maxSireShare: Math.max(...result.contributionAudits.map((audit) => audit.maxSireContributionShare)), familyDiversity: final ? result.contributionAudits.find((audit) => audit.generation === final.generation)?.representedFamilies ?? 0 : 0 };
}

export function runDiagnosticScenarioComparison(base: SimulationConfig): ScenarioSimulationResult[] {
  return Object.values(SimulationScenario).map((scenario) => runScenarioSimulation({ ...base, scenario, scenarioOptions: DEFAULT_SCENARIO_OPTIONS[scenario] }));
}
