import { TRAIT_IDEAL, TRAIT_MAX, TRAIT_MIN } from "../constants/genetics.constants";

function clampToDirectionalScale(value: number): number {
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, value));
}

function directionFromLargestDeviation(deviations: readonly number[]): -1 | 1 {
  let selectedDirection: -1 | 1 = 1;
  let largestAbsDeviation = 0;

  for (const deviation of deviations) {
    const absDeviation = Math.abs(deviation);

    if (absDeviation > largestAbsDeviation) {
      largestAbsDeviation = absDeviation;
      selectedDirection = deviation < 0 ? -1 : 1;
    }
  }

  return selectedDirection;
}

export function aggregateDirectionalCategory(values: readonly number[]): number {
  if (values.length === 0) {
    return TRAIT_IDEAL;
  }

  const deviations = values.map((value) => value - TRAIT_IDEAL);
  const signedDeviationSum = deviations.reduce(
    (sum, deviation) => sum + deviation,
    0
  );
  const averageAbsDeviation =
    deviations.reduce((sum, deviation) => sum + Math.abs(deviation), 0) /
    deviations.length;

  if (averageAbsDeviation === 0) {
    return TRAIT_IDEAL;
  }

  const direction =
    signedDeviationSum > 0
      ? 1
      : signedDeviationSum < 0
        ? -1
        : directionFromLargestDeviation(deviations);

  return clampToDirectionalScale(
    TRAIT_IDEAL + direction * averageAbsDeviation
  );
}
