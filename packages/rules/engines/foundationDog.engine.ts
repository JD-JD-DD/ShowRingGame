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
import {
  allValuesExactlyIdeal,
  averageIdealDistance,
  averageIdealScore,
  countValuesNearIdeal,
  scoreValueAgainstIdeal,
} from "./idealScoring.engine";

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

const STANDARD_HIDDEN_SPREAD = 4.5;
const NICE_HIDDEN_SPREAD = 3.25;
const ROUGH_HIDDEN_SPREAD = 5.75;

const STANDARD_EXTREME_TRAIT_CHANCE = 0.1;
const NICE_EXTREME_TRAIT_CHANCE = 0.04;
const ROUGH_EXTREME_TRAIT_CHANCE = 0.18;

const EXTREME_MIN_DISTANCE = 6.5;
const EXTREME_MAX_DISTANCE = 9.25;

const TRAIT_ROLL_VARIANCE = 1.75;
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
      return NICE_HIDDEN_SPREAD;
    case "ROUGH_FOUNDATION":
      return ROUGH_HIDDEN_SPREAD;
    case "STANDARD_FOUNDATION":
    default:
      return STANDARD_HIDDEN_SPREAD;
  }
}

function getBandExtremeChance(band: FoundationQualityBand): number {
  switch (band) {
    case "NICE_FOUNDATION":
      return NICE_EXTREME_TRAIT_CHANCE;
    case "ROUGH_FOUNDATION":
      return ROUGH_EXTREME_TRAIT_CHANCE;
    case "STANDARD_FOUNDATION":
    default:
      return STANDARD_EXTREME_TRAIT_CHANCE;
  }
}

function buildTargetMeans(
  baseline: DogTraits,
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const target = {} as DogTraits;
  const spread = getBandOffset(band);
  const extremeChance = getBandExtremeChance(band);

  for (const traitKey of TRAIT_KEYS) {
    const ideal = 10;
    const breedMean = baseline[traitKey];
    const deviationFromIdeal = breedMean - ideal;

    // Bias toward underrepresented side of ideal
    let bias = 0;
    if (Math.abs(deviationFromIdeal) > 0.5) {
      bias = deviationFromIdeal > 0 ? -0.5 : 0.5;
    }

    let sampled: number;

    if (random01() < extremeChance) {
      const direction =
        Math.abs(deviationFromIdeal) > 0.5
          ? deviationFromIdeal > 0
            ? -1
            : 1
          : random01() < 0.5
            ? -1
            : 1;

      sampled =
        ideal +
        direction *
          randomBetween(random01, EXTREME_MIN_DISTANCE, EXTREME_MAX_DISTANCE);
    } else {
      // Sample around ideal (NOT breed mean), but with enough width that
      // hidden genotype can carry real risk behind a smoother phenotype.
      sampled =
        ideal +
        randomBetween(random01, -spread, spread) +
        bias * random01();
    }

    target[traitKey] = clampTrait(sampled);
  }

  return target;
}

// function buildTargetMeans(
//   baseline: DogTraits,
//   band: FoundationQualityBand,
//   random01: () => number
// ): DogTraits {
//   const offset = getBandOffset(band);
//   const target = {} as DogTraits;

//   for (const traitKey of TRAIT_KEYS) {
//     const ideal = 10;

//     if (baseline[traitKey] === ideal) {
//       const direction = random01() < 0.5 ? -1 : 1;
//       target[traitKey] = clampTrait(ideal + direction * offset);
//     } else if (baseline[traitKey] < ideal) {
//       target[traitKey] = clampTrait(
//         baseline[traitKey] + (random01() < 0.6 ? -offset : offset * 0.5)
//       );
//     } else {
//       target[traitKey] = clampTrait(
//         baseline[traitKey] + (random01() < 0.6 ? offset : -offset * 0.5)
//       );
//     }
//   }

//   return target;
// }

function shuffleTraitKeys(random01: () => number): TraitKey[] {
  const values = [...TRAIT_KEYS];

  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random01() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

function moveTowardIdeal(
  value: number,
  random01: () => number,
  ideal = 10
): number {
  if (value === ideal) return value;

  const delta = randomBetween(random01, 0.4, 1.1);

  if (value < ideal) {
    return clampTrait(value + delta);
  }

  return clampTrait(value - delta);
}

function moveAwayFromIdeal(
  value: number,
  random01: () => number,
  ideal = 10
): number {
  const delta = randomBetween(random01, 0.5, 1.4);

  if (value < ideal) {
    return clampTrait(value - delta);
  }

  return clampTrait(value + delta);
}

function buildTraitBiasProfile(random01: () => number): {
  closerToIdealTraits: Set<TraitKey>;
  fartherFromIdealTraits: Set<TraitKey>;
} {
  const shuffled = shuffleTraitKeys(random01);

  const closerCount = 2 + Math.floor(random01() * 3); // 2..4
  const fartherCount = 2 + Math.floor(random01() * 3); // 2..4

  const closerToIdealTraits = new Set<TraitKey>(shuffled.slice(0, closerCount));
  const fartherFromIdealTraits = new Set<TraitKey>(
    shuffled.slice(closerCount, closerCount + fartherCount)
  );

  return { closerToIdealTraits, fartherFromIdealTraits };
}

function generateCandidateTraits(
  targetMeans: DogTraits,
  random01: () => number
): DogTraits {
  const { closerToIdealTraits, fartherFromIdealTraits } =
    buildTraitBiasProfile(random01);

  const traits = {} as DogTraits;

  for (const traitKey of TRAIT_KEYS) {
    let value =
      targetMeans[traitKey] +
      randomBetween(random01, -TRAIT_ROLL_VARIANCE, TRAIT_ROLL_VARIANCE);

    if (closerToIdealTraits.has(traitKey)) {
      value = moveTowardIdeal(value, random01);
    }

    if (fartherFromIdealTraits.has(traitKey)) {
      value = moveAwayFromIdeal(value, random01);
    }

    traits[traitKey] = Number(clampTrait(value).toFixed(2));
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
 *
 * IMPORTANT:
 * Visible categories remain on the same 0–20 scale as hidden traits,
 * with 10 as ideal. They preserve whether the category appears under
 * or over ideal, while still hiding the exact raw trait breakdown.
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

function countTraitsInRange(
  traits: DogTraits,
  minInclusive: number,
  maxInclusive: number
): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value >= minInclusive && value <= maxInclusive;
  }).length;
}

function countExtremeFaultTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value <= 3 || value >= 17;
  }).length;
}

function countPoorTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return (value >= 4 && value <= 5) || (value >= 15 && value <= 16);
  }).length;
}

function countEliteTraits(traits: DogTraits): number {
  return TRAIT_KEYS.filter((traitKey) => {
    const value = traits[traitKey];
    return value >= 9 && value <= 11;
  }).length;
}

function traitSpread(traits: DogTraits): number {
  const values = TRAIT_KEYS.map((traitKey) => traits[traitKey]);
  return Math.max(...values) - Math.min(...values);
}

function isFoundationCandidateAcceptable(traits: DogTraits): boolean {
  const visible = deriveVisibleCategoriesFromTraits(traits);
  const categoryValues = Object.values(visible);
  const traitValues = TRAIT_KEYS.map((traitKey) => traits[traitKey]);

  const eliteTraitCount = countEliteTraits(traits);
  const poorTraitCount = countPoorTraits(traits);
  const extremeFaultCount = countExtremeFaultTraits(traits);
  const spread = traitSpread(traits);

  const nearIdealVisibleCategoryCount = countValuesNearIdeal(categoryValues, 0.75);

  const severeVisibleFaultCategoryCount = categoryValues.filter(
    (value) => scoreValueAgainstIdeal(value) <= 9
  ).length;

  if (allValuesExactlyIdeal(traitValues)) {
    return false;
  }

  // Reject flat dogs
  if (spread < 2.5) {
    return false;
  }

  // Reject suspiciously clean dogs
  if (eliteTraitCount > 4) {
    return false;
  }

  // Reject accidental superdogs
  if (nearIdealVisibleCategoryCount > 3) {
    return false;
  }

  // Reject hopeless dogs
  if (extremeFaultCount > 2) {
    return false;
  }

  if (poorTraitCount > 5) {
    return false;
  }

  if (severeVisibleFaultCategoryCount >= 4) {
    return false;
  }

  // Require at least something appealing
  if (averageIdealScore(categoryValues) < 10) {
    return false;
  }

  return true;
}

function generateFoundationTraits(
  baseline: DogTraits,
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const targetMeans = buildTargetMeans(baseline, band, random01);
  let bestCandidate: DogTraits | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = generateCandidateTraits(targetMeans, random01);

    if (isFoundationCandidateAcceptable(candidate)) {
      return candidate;
    }

    const visible = deriveVisibleCategoriesFromTraits(candidate);
    const categoryValues = Object.values(visible);
    const visibleQuality = averageIdealScore(categoryValues);
    const visibleFaultPressure = averageIdealDistance(categoryValues);
    const spread = traitSpread(candidate);

    const score =
      visibleQuality -
      visibleFaultPressure +
      Math.min(spread, 6) * 0.4 -
      countExtremeFaultTraits(candidate) * 3 -
      countPoorTraits(candidate) * 1.5 -
      Math.max(0, countEliteTraits(candidate) - 4) * 3 -
      Math.max(0, countValuesNearIdeal(categoryValues, 0.75) - 3) * 2;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? generateCandidateTraits(targetMeans, random01);
}

function calculateSuggestedPrice(
  visibleCategories: VisibleCategories,
  band: FoundationQualityBand
): number {
  const visibleQuality = averageIdealScore(Object.values(visibleCategories));

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

  const scoreAdjustment = Math.round((visibleQuality - 14) * PRICE_STEP);
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

