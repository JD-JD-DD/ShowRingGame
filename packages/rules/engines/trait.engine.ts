// how traits are inherited

import {
  TRAIT_MAX,
  TRAIT_IDEAL,
  TRAIT_MIN,
  TRAIT_VARIANCE,
  MUTATION_RATE,
  TRAIT_KEYS,
  COI_FAULT_EXPRESSION_BASELINE_PERCENT,
  COI_FAULT_EXPRESSION_MULTIPLIER,
  COI_MAX_FAULT_EXPRESSION_RATE,
  COI_VARIANCE_REDUCTION_MULTIPLIER,
  COI_MAX_VARIANCE_REDUCTION,
} from "../constants/genetics.constants";

import type { DogTraits } from "./dog.engine";
import { allValuesExactlyIdeal } from "./idealScoring.engine";

const PARENT_SIDE_INHERITANCE_RATE = 0.92;

export type GeneratePuppyTraitsInput = {
  sireTraits: DogTraits;
  damTraits: DogTraits;
  coiPercent?: number | null;
  random01?: () => number;
};

export type CoiTraitEffects = {
  normalizedCoiPercent: number;
  faultExpressionRate: number;
  varianceScale: number;
};

function clampTrait(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

function normalizeCoiPercent(coiPercent: number | null | undefined): number {
  if (coiPercent == null || !Number.isFinite(coiPercent)) return 0;
  return Math.max(0, Math.min(100, coiPercent));
}

export function getCoiTraitEffects(
  coiPercent: number | null | undefined
): CoiTraitEffects {
  const normalizedCoiPercent = normalizeCoiPercent(coiPercent);
  const coi = normalizedCoiPercent / 100;
  const excessCoi = Math.max(
    0,
    coi - COI_FAULT_EXPRESSION_BASELINE_PERCENT / 100
  );
  const faultExpressionRate = Math.min(
    COI_MAX_FAULT_EXPRESSION_RATE,
    excessCoi * COI_FAULT_EXPRESSION_MULTIPLIER
  );
  const varianceReduction = Math.min(
    COI_MAX_VARIANCE_REDUCTION,
    coi * COI_VARIANCE_REDUCTION_MULTIPLIER
  );

  return {
    normalizedCoiPercent,
    faultExpressionRate,
    varianceScale: 1 - varianceReduction,
  };
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

function maybeExpressInbreedingFault(
  random01: () => number,
  value: number,
  faultExpressionRate: number
): number {
  if (faultExpressionRate <= 0 || random01() >= faultExpressionRate) {
    return value;
  }

  return value < TRAIT_IDEAL ? value - 1 : value + 1;
}

/**
 * Computes a single inherited trait from two parents.
 *
 * Current philosophy:
 * - Usually inherit from one parental side, not the midpoint
 * - Rarely blend both parents
 * - Apply bounded random variance around that inherited side
 * - Rare small mutation
 * - COI can reduce random spread and separately express a recessive fault
 * - Clamp into legal trait range
 */
function deriveSingleTrait(
  sireValue: number,
  damValue: number,
  random01: () => number,
  coiTraitEffects: CoiTraitEffects
): number {
  const parentAverage = (sireValue + damValue) / 2;
  const inheritedBase =
    random01() < PARENT_SIDE_INHERITANCE_RATE
      ? random01() < 0.5
        ? sireValue
        : damValue
      : parentAverage;

  const safeVariance =
    TRAIT_VARIANCE > 0 ? TRAIT_VARIANCE * coiTraitEffects.varianceScale : 0;
  const variance = centeredVariance(random01, safeVariance);

  let result = inheritedBase + variance;
  result = maybeMutate(random01, result);
  result = clampTrait(Math.round(result));
  result = maybeExpressInbreedingFault(
    random01,
    result,
    coiTraitEffects.faultExpressionRate
  );

  return clampTrait(result);
}

export function generatePuppyTraits(
  input: GeneratePuppyTraitsInput
): DogTraits {

  const random01 = input.random01 ?? Math.random
  const { sireTraits, damTraits } = input
  const coiTraitEffects = getCoiTraitEffects(input.coiPercent)

  const puppyTraits = {} as DogTraits

  for (const trait of TRAIT_KEYS) {
    puppyTraits[trait] = deriveSingleTrait(
      sireTraits[trait],
      damTraits[trait],
      random01,
      coiTraitEffects
    )
  }

  if (allValuesExactlyIdeal(TRAIT_KEYS.map((trait) => puppyTraits[trait]))) {
    const trait = TRAIT_KEYS[Math.floor(random01() * TRAIT_KEYS.length)]
    puppyTraits[trait] = random01() < 0.5 ? TRAIT_IDEAL - 1 : TRAIT_IDEAL + 1
  }

  return puppyTraits
}
