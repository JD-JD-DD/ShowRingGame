// how traits are inherited

import {
  TRAIT_MAX,
  TRAIT_IDEAL,
  TRAIT_MIN,
  TRAIT_VARIANCE,
  INHERITANCE_WEIGHT,
  MUTATION_RATE,
  TRAIT_KEYS
} from "../constants/genetics.constants";

import type { DogTraits } from "./dog.engine";
import { allValuesExactlyIdeal } from "./idealScoring.engine";

export type GeneratePuppyTraitsInput = {
  sireTraits: DogTraits;
  damTraits: DogTraits;
  random01?: () => number;
};

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

/**
 * Returns a random number between min and max.
 */
function randomBetween(random01: () => number, min: number, max: number): number {
  return min + (max - min) * random01();
}

/**
 * Returns a small centered random value in the range [-variance, +variance].
 */
function centeredVariance(random01: () => number, variance: number): number {
  return randomBetween(random01, -variance, variance);
}

/**
 * Optional mutation event.
 * For now this is intentionally small and rare.
 */
function maybeMutate(random01: () => number, value: number): number {
  if (MUTATION_RATE <= 0) {
    return value;
  }

  const roll = random01();
  if (roll >= MUTATION_RATE) {
    return value;
  }

  // Small mutation step: either +1 or -1
  const mutationStep = random01() < 0.5 ? -1 : 1;
  return value + mutationStep;
}

/**
 * Computes a single inherited trait from two parents.
 *
 * Current philosophy:
 * - Start with parent average
 * - Optionally bias slightly toward one parent
 * - Apply bounded random variance
 * - Rare small mutation
 * - Clamp into legal trait range
 */
function deriveSingleTrait(
  sireValue: number,
  damValue: number,
  random01: () => number
): number {
  const parentAverage = (sireValue + damValue) / 2;

  /**
   * INHERITANCE_WEIGHT meaning:
   * 0   => use pure average
   * 1   => fully allow bias toward one parent
   *
   * We keep the bias centered so it does not always favor sire or dam.
   */
  const safeInheritanceWeight =
    INHERITANCE_WEIGHT > 0 ? INHERITANCE_WEIGHT : 0;

  const parentDifference = sireValue - damValue;
  const biasDirection = random01() < 0.5 ? -1 : 1;
  const inheritanceBias =
    (parentDifference / 2) * safeInheritanceWeight * biasDirection;

  const safeVariance = TRAIT_VARIANCE > 0 ? TRAIT_VARIANCE : 0;
  const variance = centeredVariance(random01, safeVariance);

  let result = parentAverage + inheritanceBias + variance;
  result = maybeMutate(random01, result);

  return clampTrait(Math.round(result));
}

export function generatePuppyTraits(
  input: GeneratePuppyTraitsInput
): DogTraits {

  const random01 = input.random01 ?? Math.random
  const { sireTraits, damTraits } = input

  const puppyTraits = {} as DogTraits

  for (const trait of TRAIT_KEYS) {
    puppyTraits[trait] = deriveSingleTrait(
      sireTraits[trait],
      damTraits[trait],
      random01
    )
  }

  if (allValuesExactlyIdeal(TRAIT_KEYS.map((trait) => puppyTraits[trait]))) {
    const trait = TRAIT_KEYS[Math.floor(random01() * TRAIT_KEYS.length)]
    puppyTraits[trait] = random01() < 0.5 ? TRAIT_IDEAL - 1 : TRAIT_IDEAL + 1
  }

  return puppyTraits
}
