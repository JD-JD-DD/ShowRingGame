import {
  generateFoundationPhenotypeHealthTruths,
  inheritPhenotypeHealthTruths,
  PHENOTYPE_HEALTH_TEST_CODES,
  revealPhenotypeHealthTestResult,
  type PhenotypeHealthTestCode,
  type PhenotypeHealthTruth,
} from "../src/index";

const POPULATION_SIZE = 100_000;
const SELECTED_BREEDING_POOL_RATE = 0.35;
const SELECTED_GENERATIONS = 6;

type HealthProfile = PhenotypeHealthTruth[];

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick<T>(values: T[], random01: () => number): T {
  return values[Math.floor(random01() * values.length)];
}

function generateFoundationPopulation(random01: () => number): HealthProfile[] {
  return Array.from({ length: POPULATION_SIZE }, () =>
    generateFoundationPhenotypeHealthTruths(random01)
  );
}

function breedPopulation(
  parentPool: HealthProfile[],
  random01: () => number
): HealthProfile[] {
  return Array.from({ length: POPULATION_SIZE }, () =>
    inheritPhenotypeHealthTruths({
      sireTruths: pick(parentPool, random01),
      damTruths: pick(parentPool, random01),
      coiPercent: 0,
      random01,
    })
  );
}

function profileScore(profile: HealthProfile): number {
  return profile.reduce(
    (total, truth) => total + truth.geneticLiability,
    0
  );
}

function selectBreedingPool(population: HealthProfile[]): HealthProfile[] {
  return [...population]
    .sort((a, b) => profileScore(a) - profileScore(b))
    .slice(0, Math.ceil(population.length * SELECTED_BREEDING_POOL_RATE));
}

function reportPopulation(label: string, population: HealthProfile[]): void {
  console.log(`\n${label}`);

  for (const conditionCode of PHENOTYPE_HEALTH_TEST_CODES) {
    const counts = new Map<string, number>();

    for (const profile of population) {
      const truth = profile.find(
        (candidate) => candidate.conditionCode === conditionCode
      );

      if (!truth) {
        throw new Error(`Missing ${conditionCode} truth in audit profile.`);
      }

      const result = revealPhenotypeHealthTestResult(truth);
      counts.set(result.resultCode, (counts.get(result.resultCode) ?? 0) + 1);
    }

    const results = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resultCode, count]) => `${resultCode}=${formatRate(count)}`)
      .join(" ");

    console.log(`${conditionCode}: ${results}`);
  }
}

function formatRate(count: number): string {
  return `${((count / POPULATION_SIZE) * 100).toFixed(1)}%`;
}

const random01 = createRandom(20260602);
const foundations = generateFoundationPopulation(random01);
reportPopulation("FOUNDATION POPULATION", foundations);

const firstGeneration = breedPopulation(foundations, random01);
reportPopulation("FIRST-GENERATION OFFSPRING", firstGeneration);

let selectedPopulation = foundations;

for (
  let generation = 1;
  generation <= SELECTED_GENERATIONS;
  generation += 1
) {
  selectedPopulation = breedPopulation(
    selectBreedingPool(selectedPopulation),
    random01
  );
  reportPopulation(`SELECTED BREEDING GENERATION ${generation}`, selectedPopulation);
}
