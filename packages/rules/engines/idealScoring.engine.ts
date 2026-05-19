import {
  TRAIT_IDEAL,
  TRAIT_MAX,
  TRAIT_MIN,
} from "../constants/genetics.constants";

export const IDEAL_SCORE_MIN = 0;
export const IDEAL_SCORE_MAX = 20;

export function clampToTraitScale(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

export function distanceFromIdeal(
  value: number,
  ideal = TRAIT_IDEAL
): number {
  return Math.abs(clampToTraitScale(value) - ideal);
}

export function scoreValueAgainstIdeal(
  value: number,
  ideal = TRAIT_IDEAL
): number {
  const maxDistance = Math.max(ideal - TRAIT_MIN, TRAIT_MAX - ideal);

  if (maxDistance <= 0) {
    return IDEAL_SCORE_MAX;
  }

  const score =
    IDEAL_SCORE_MAX -
    (distanceFromIdeal(value, ideal) / maxDistance) * IDEAL_SCORE_MAX;

  return Number(Math.max(IDEAL_SCORE_MIN, score).toFixed(2));
}

export function averageIdealScore(
  values: readonly number[],
  ideal = TRAIT_IDEAL
): number {
  if (values.length === 0) {
    return IDEAL_SCORE_MIN;
  }

  const total = values.reduce(
    (sum, value) => sum + scoreValueAgainstIdeal(value, ideal),
    0
  );

  return Number((total / values.length).toFixed(2));
}

export function averageIdealDistance(
  values: readonly number[],
  ideal = TRAIT_IDEAL
): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce(
    (sum, value) => sum + distanceFromIdeal(value, ideal),
    0
  );

  return Number((total / values.length).toFixed(2));
}

export function countValuesNearIdeal(
  values: readonly number[],
  tolerance = 1,
  ideal = TRAIT_IDEAL
): number {
  return values.filter((value) => distanceFromIdeal(value, ideal) <= tolerance)
    .length;
}

export function allValuesExactlyIdeal(
  values: readonly number[],
  ideal = TRAIT_IDEAL
): boolean {
  return values.length > 0 && values.every((value) => value === ideal);
}
