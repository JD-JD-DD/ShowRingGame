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
