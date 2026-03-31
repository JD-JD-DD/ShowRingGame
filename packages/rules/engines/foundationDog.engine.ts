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

// function clampTrait(value: number): number {
//   return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, Math.round(value)));
// }

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
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
  band: FoundationQualityBand,
  random01: () => number
): DogTraits {
  const target = {} as DogTraits;

  for (const traitKey of TRAIT_KEYS) {
    const ideal = 10;

    const breedMean = baseline[traitKey];

    // How far breed is from ideal
    const deviationFromIdeal = breedMean - ideal;

    // Estimate plausible spread based on breed deviation
    const magnitude = Math.max(1.5, Math.min(3.5, Math.abs(deviationFromIdeal) + 1));

    // Slight band influence (NICE slightly tighter, ROUGH slightly wider)
    let spreadAdjustment = 0;
    switch (band) {
      case "NICE_FOUNDATION":
        spreadAdjustment = -0.2;
        break;
      case "ROUGH_FOUNDATION":
        spreadAdjustment = +0.6;
        break;
    }

    const finalSpread = magnitude + spreadAdjustment;

    // Bias toward underrepresented side of ideal
    let bias = 0;
    if (Math.abs(deviationFromIdeal) > 0.5) {
      bias = deviationFromIdeal > 0 ? -0.5 : 0.5;
    }

    // Sample around ideal (NOT breed mean)
    const sampled =
      ideal +
      randomBetween(random01, -finalSpread, finalSpread) +
      bias * random01();

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


function traitDistanceFromIdeal(value: number, ideal = 10): number {
  return Math.abs(value - ideal);
}

function traitQualityFromIdeal(value: number, ideal = 10): number {
  return Math.max(0, 10 - traitDistanceFromIdeal(value, ideal));
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
 * Hidden trait values are distance-from-ideal traits where 10 is ideal.
 * Visible categories should therefore reflect closeness to 10, not raw magnitude.
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
    const qualityValues = traitKeys.map((traitKey) =>
      traitQualityFromIdeal(traits[traitKey])
    );

    const score = Number(average(qualityValues).toFixed(1));
    visibleCategories[mapCategoryKey(category)] = score;
  }

  return visibleCategories;
}

// function countTraitsAboveThreshold(
//   traits: DogTraits,
//   baseline: DogTraits,
//   threshold: number
// ): number {
//   let count = 0;

//   for (const traitKey of TRAIT_KEYS) {
//     if (traits[traitKey] > baseline[traitKey] + threshold) {
//       count += 1;
//     }
//   }

//   return count;
// }

// function countTraitsBelowThreshold(
//   traits: DogTraits,
//   baseline: DogTraits,
//   threshold: number
// ): number {
//   let count = 0;

//   for (const traitKey of TRAIT_KEYS) {
//     if (traits[traitKey] < baseline[traitKey] - threshold) {
//       count += 1;
//     }
//   }

//   return count;
// }

// function isTooFlat(traits: DogTraits): boolean {
//   const values = TRAIT_KEYS.map((traitKey) => traits[traitKey]);
//   const min = Math.min(...values);
//   const max = Math.max(...values);

//   return max - min <= 1;
// }

// function isEliteCandidate(
//   traits: DogTraits,
//   baseline: DogTraits,
//   visibleCategories: VisibleCategories
// ): boolean {
//   const aboveMeanPlusOne = countTraitsAboveThreshold(traits, baseline, 1);
//   const visibleStrongCount = Object.values(visibleCategories).filter(
//     (value) => value >= 11.5
//   ).length;

//   const traitSum = TRAIT_KEYS.reduce((sum, traitKey) => sum + traits[traitKey], 0);
//   const baselineSum = TRAIT_KEYS.reduce(
//     (sum, traitKey) => sum + baseline[traitKey],
//     0
//   );

//   return (
//     aboveMeanPlusOne > 3 ||
//     visibleStrongCount > 2 ||
//     traitSum > baselineSum - 1
//   );
// }

// function isTooWeakCandidate(
//   traits: DogTraits,
//   baseline: DogTraits,
//   visibleCategories: VisibleCategories
// ): boolean {
//   const belowMeanMinusTwo = countTraitsBelowThreshold(traits, baseline, 2);
//   const visibleAppealingCount = Object.values(visibleCategories).filter(
//     (value) => value >= 10.0
//   ).length;

//   const traitSum = TRAIT_KEYS.reduce((sum, traitKey) => sum + traits[traitKey], 0);
//   const baselineSum = TRAIT_KEYS.reduce(
//     (sum, traitKey) => sum + baseline[traitKey],
//     0
//   );

//   return (
//     belowMeanMinusTwo > 3 ||
//     visibleAppealingCount < 1 ||
//     traitSum < baselineSum - 18
//   );
// }

// function scoreCandidatePenalty(
//   traits: DogTraits,
//   baseline: DogTraits
// ): number {
//   const visibleCategories = deriveVisibleCategoriesFromTraits(traits);

//   let penalty = 0;

//   if (isTooFlat(traits)) penalty += 100;

//   const aboveMeanPlusOne = countTraitsAboveThreshold(traits, baseline, 1);
//   const belowMeanMinusTwo = countTraitsBelowThreshold(traits, baseline, 2);
//   const visibleStrongCount = Object.values(visibleCategories).filter(
//     (value) => value >= 11.5
//   ).length;
//   const visibleAppealingCount = Object.values(visibleCategories).filter(
//     (value) => value >= 10.0
//   ).length;

//   penalty += aboveMeanPlusOne * 10;
//   penalty += belowMeanMinusTwo * 10;

//   if (visibleStrongCount > 2) penalty += 25;
//   if (visibleAppealingCount < 1) penalty += 25;

//   return penalty;
// }

// function isValidFoundationCandidate(
//   traits: DogTraits,
//   baseline: DogTraits
// ): boolean {
//   if (isTooFlat(traits)) return false;

//   const visibleCategories = deriveVisibleCategoriesFromTraits(traits);

//   if (isEliteCandidate(traits, baseline, visibleCategories)) return false;
//   if (isTooWeakCandidate(traits, baseline, visibleCategories)) return false;

//   return true;
// }

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

  const eliteTraitCount = countEliteTraits(traits);
  const poorTraitCount = countPoorTraits(traits);
  const extremeFaultCount = countExtremeFaultTraits(traits);
  const spread = traitSpread(traits);

  const strongVisibleCategoryCount = categoryValues.filter(
    (value) => value >= 8.5
  ).length;

  const collapsedVisibleCategoryCount = categoryValues.filter(
    (value) => value <= 4.5
  ).length;

  // Reject flat dogs
  if (spread < 2.5) {
    return false;
  }

  // Reject suspiciously clean dogs
  if (eliteTraitCount > 4) {
    return false;
  }

  // Reject accidental superdogs
  if (strongVisibleCategoryCount > 2) {
    return false;
  }

  // Reject hopeless dogs
  if (extremeFaultCount > 2) {
    return false;
  }

  if (poorTraitCount > 5) {
    return false;
  }

  if (collapsedVisibleCategoryCount >= 4) {
    return false;
  }

  // Require at least something appealing
  if (categoryValues.every((value) => value < 5.5)) {
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
    const visibleAverage = average(Object.values(visible));
    const spread = traitSpread(candidate);

    const score =
      visibleAverage +
      spread -
      countExtremeFaultTraits(candidate) * 2 -
      countPoorTraits(candidate) * 1.5 -
      Math.max(0, countEliteTraits(candidate) - 4) * 2;

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

