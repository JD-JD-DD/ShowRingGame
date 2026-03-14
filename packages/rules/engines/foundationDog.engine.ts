import {
  TRAIT_KEYS,
  TRAIT_MAX,
  TRAIT_MIN,
  type TraitKey,
} from "../constants/genetics.constants";
import {
  CATEGORY_TRAIT_MAP,
  JUDGING_CATEGORIES,
  type JudgingCategory,
} from "../constants/judging.constants";
import type { Dog, DogTraits } from "./dog.engine";
import type { Sex } from "../src/lifecycle";

export type VisibleCategories = {
  typeExpression: number;
  structureBalance: number;
  movement: number;
  coatPresentation: number;
  temperamentRingBehavior: number;
  conditioningHandling: number;
};

export type FoundationQualityBand =
  | "STANDARD_FOUNDATION"
  | "NICE_FOUNDATION"
  | "ROUGH_FOUNDATION";

export type FoundationBreedBaseline = {
  breedCode2: string;
  traitMeans: DogTraits;
};

export type CreateFoundationDogEngineInput = {
  dogId: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex?: Sex;
  callName: string;
  breedBaseline: FoundationBreedBaseline;
  random01?: () => number;
};

export type FoundationDogEngineResult = {
  dog: Dog;
  callName: string;
  qualityBand: FoundationQualityBand;
  visibleCategories: VisibleCategories;
  suggestedPrice: number;
};

const FOUNDATION_STANDARD_WEIGHT = 0.60;
const FOUNDATION_NICE_WEIGHT = 0.30;
// Remaining 0.10 => rough

const STANDARD_OFFSET = 1.0;
const NICE_OFFSET = 0.5;
const ROUGH_OFFSET = 1.75;

const TRAIT_ROLL_VARIANCE = 1.25;
const MAX_GENERATION_ATTEMPTS = 40;

const PRICE_BASE = 1800;
const PRICE_STEP = 75;

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, Math.round(value)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Returns a random number between min and max.
 */
function randomBetween(random01: () => number, min: number, max: number): number {
  return min + (max - min) * random01();
}

function pickSex(random01: () => number): Sex {
  return random01() < 0.5 ? "M" : "F";
}

function pickQualityBand(random01: () => number): FoundationQualityBand {
  const roll = random01();

  if (roll < FOUNDATION_STANDARD_WEIGHT) return "STANDARD_FOUNDATION";
  if (roll < FOUNDATION_STANDARD_WEIGHT + FOUNDATION_NICE_WEIGHT) {
    return "NICE_FOUNDATION";
  }

  return "ROUGH_FOUNDATION";
}

function getBandOffset(band: FoundationQualityBand): number {
  switch (band) {
    case "NICE_FOUNDATION":
      return NICE_OFFSET;
    case "ROUGH_FOUNDATION":
      return ROUGH_OFFSET;
    case "STANDARD_FOUNDATION":
    default:
      return STANDARD_OFFSET;
  }
}

function buildTargetMeans(
  baseline: DogTraits,
  band: FoundationQualityBand
): DogTraits {
  const offset = getBandOffset(band);
  const target = {} as DogTraits;

  for (const traitKey of TRAIT_KEYS) {
    target[traitKey] = Math.max(TRAIT_MIN, baseline[traitKey] - offset);
  }

  return target;
}

function shuffleTraitKeys(random01: () => number): TraitKey[] {
  const values = [...TRAIT_KEYS];

  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random01() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

function buildTraitBiasProfile(random01: () => number): {
  boostedTraits: Set<TraitKey>;
  loweredTraits: Set<TraitKey>;
} {
  const shuffled = shuffleTraitKeys(random01);

  const boostedCount = 2 + Math.floor(random01() * 3); // 2..4
  const loweredCount = 2 + Math.floor(random01() * 3); // 2..4

  const boostedTraits = new Set<TraitKey>(shuffled.slice(0, boostedCount));
  const loweredTraits = new Set<TraitKey>(
    shuffled.slice(boostedCount, boostedCount + loweredCount)
  );

  return { boostedTraits, loweredTraits };
}

function generateCandidateTraits(
  targetMeans: DogTraits,
  random01: () => number
): DogTraits {
  const { boostedTraits, loweredTraits } = buildTraitBiasProfile(random01);
  const traits = {} as DogTraits;

  for (const traitKey of TRAIT_KEYS) {
    let value =
      targetMeans[traitKey] +
      randomBetween(random01, -TRAIT_ROLL_VARIANCE, TRAIT_ROLL_VARIANCE);

    if (boostedTraits.has(traitKey)) {
      value += randomBetween(random01, 0.4, 1.0);
    }

    if (loweredTraits.has(traitKey)) {
      value -= randomBetween(random01, 0.4, 1.0);
    }

    traits[traitKey] = clampTrait(value);
  }

  return traits;
}

function mapCategoryKey(category: JudgingCategory): keyof VisibleCategories {
  switch (category) {
    case "TYPE_EXPRESSION":
      return "typeExpression";
    case "STRUCTURE_BALANCE":
      return "structureBalance";
    case "MOVEMENT":
      return "movement";
    case "COAT_PRESENTATION":
      return "coatPresentation";
    case "TEMPERAMENT_RING_BEHAVIOR":
      return "temperamentRingBehavior";
    case "CONDITIONING_HANDLING":
      return "conditioningHandling";
  }
}

/**
 * Keep this helper aligned with the judging category map.
 * Raw traits stay hidden; UI and API should use these derived values.
 */
export function deriveVisibleCategoriesFromTraits(
  traits: DogTraits
): VisibleCategories {
  const visibleCategories: VisibleCategories = {
    typeExpression: 0,
    structureBalance: 0,
    movement: 0,
    coatPresentation: 0,
    temperamentRingBehavior: 0,
    conditioningHandling: 0,
  };

  for (const category of JUDGING_CATEGORIES) {
    const traitKeys = CATEGORY_TRAIT_MAP[category];
    const values = traitKeys.map((traitKey) => traits[traitKey]);
    const score = Number(average(values).toFixed(1));

    visibleCategories[mapCategoryKey(category)] = score;
  }

  return visibleCategories;
}

function countTraitsAboveThreshold(
  traits: DogTraits,
  baseline: DogTraits,
  threshold: number
): number {
  let count = 0;

  for (const traitKey of TRAIT_KEYS) {
    if (traits[traitKey] > baseline[traitKey] + threshold) {
      count += 1;
    }
  }

  return count;
}

function countTraitsBelowThreshold(
  traits: DogTraits,
  baseline: DogTraits,
  threshold: number
): number {
  let count = 0;

  for (const traitKey of TRAIT_KEYS) {
    if (traits[traitKey] < baseline[traitKey] - threshold) {
      count += 1;
    }
  }

  return count;
}

function isTooFlat(traits: DogTraits): boolean {
  const values = TRAIT_KEYS.map((traitKey) => traits[traitKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return max - min <= 1;
}

function isEliteCandidate(
  traits: DogTraits,
  baseline: DogTraits,
  visibleCategories: VisibleCategories
): boolean {
  const aboveMeanPlusOne = countTraitsAboveThreshold(traits, baseline, 1);
  const visibleStrongCount = Object.values(visibleCategories).filter(
    (value) => value >= 11.5
  ).length;

  const traitSum = TRAIT_KEYS.reduce((sum, traitKey) => sum + traits[traitKey], 0);
  const baselineSum = TRAIT_KEYS.reduce(
    (sum, traitKey) => sum + baseline[traitKey],
    0
  );

  return (
    aboveMeanPlusOne > 3 ||
    visibleStrongCount > 2 ||
    traitSum > baselineSum - 1
  );
}

function isTooWeakCandidate(
  traits: DogTraits,
  baseline: DogTraits,
  visibleCategories: VisibleCategories
): boolean {
  const belowMeanMinusTwo = countTraitsBelowThreshold(traits, baseline, 2);
  const visibleAppealingCount = Object.values(visibleCategories).filter(
    (value) => value >= 10.0
  ).length;

  const traitSum = TRAIT_KEYS.reduce((sum, traitKey) => sum + traits[traitKey], 0);
  const baselineSum = TRAIT_KEYS.reduce(
    (sum, traitKey) => sum + baseline[traitKey],
    0
  );

  return (
    belowMeanMinusTwo > 3 ||
    visibleAppealingCount < 1 ||
    traitSum < baselineSum - 18
  );
}

function scoreCandidatePenalty(
  traits: DogTraits,
  baseline: DogTraits
): number {
  const visibleCategories = deriveVisibleCategoriesFromTraits(traits);

  let penalty = 0;

  if (isTooFlat(traits)) penalty += 100;

  const aboveMeanPlusOne = countTraitsAboveThreshold(traits, baseline, 1);
  const belowMeanMinusTwo = countTraitsBelowThreshold(traits, baseline, 2);
  const visibleStrongCount = Object.values(visibleCategories).filter(
    (value) => value >= 11.5
  ).length;
  const visibleAppealingCount = Object.values(visibleCategories).filter(
    (value) => value >= 10.0
  ).length;

  penalty += aboveMeanPlusOne * 10;
  penalty += belowMeanMinusTwo * 10;

  if (visibleStrongCount > 2) penalty += 25;
  if (visibleAppealingCount < 1) penalty += 25;

  return penalty;
}

function isValidFoundationCandidate(
  traits: DogTraits,
  baseline: DogTraits
): boolean {
  if (isTooFlat(traits)) return false;

  const visibleCategories = deriveVisibleCategoriesFromTraits(traits);

  if (isEliteCandidate(traits, baseline, visibleCategories)) return false;
  if (isTooWeakCandidate(traits, baseline, visibleCategories)) return false;

  return true;
}

function generateFoundationTraits(
  baseline: DogTraits,
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const targetMeans = buildTargetMeans(baseline, band);

  let bestCandidate: DogTraits | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateCandidateTraits(targetMeans, random01);

    if (isValidFoundationCandidate(candidate, baseline)) {
      return candidate;
    }

    const penalty = scoreCandidatePenalty(candidate, baseline);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? generateCandidateTraits(targetMeans, random01);
}

function calculateSuggestedPrice(
  visibleCategories: VisibleCategories,
  band: FoundationQualityBand
): number {
  const visibleAverage = average(Object.values(visibleCategories));

  let bandAdjustment = 0;
  switch (band) {
    case "NICE_FOUNDATION":
      bandAdjustment = 250;
      break;
    case "ROUGH_FOUNDATION":
      bandAdjustment = -250;
      break;
    case "STANDARD_FOUNDATION":
    default:
      bandAdjustment = 0;
      break;
  }

  const scoreAdjustment = Math.round((visibleAverage - 10) * PRICE_STEP * 2);
  return Math.max(1000, PRICE_BASE + bandAdjustment + scoreAdjustment);
}

export function createFoundationDogProfile(
  input: CreateFoundationDogEngineInput
): FoundationDogEngineResult {
  const random01 = input.random01 ?? Math.random;
  const sex = input.sex ?? pickSex(random01);
  const qualityBand = pickQualityBand(random01);
  const baseline = input.breedBaseline.traitMeans;

  const traits = generateFoundationTraits(baseline, qualityBand, random01);
  const visibleCategories = deriveVisibleCategoriesFromTraits(traits);
  const suggestedPrice = calculateSuggestedPrice(visibleCategories, qualityBand);

  const dog: Dog = {
    dogId: input.dogId,
    regNumber: input.regNumber,
    breedCode2: input.breedCode2,
    birthEpoch: input.birthEpoch,
    sex,
    status: "ALIVE",
    litterId: null,
    litterOrder: null,
    sireId: null,
    damId: null,
    traits,
  };

  return {
    dog,
    callName: input.callName,
    qualityBand,
    visibleCategories,
    suggestedPrice,
  };
}

