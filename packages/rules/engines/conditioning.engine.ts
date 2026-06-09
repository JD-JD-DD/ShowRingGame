export const CONDITIONING_HANDLING_MIN = 0;
export const CONDITIONING_HANDLING_MAX = 10;

export type ConditioningHandlingInfluences = {
  coatCondition?: number | null;
  muscleTone?: number | null;
  ringObedience?: number | null;
  fatiguePoints?: number | null;
  conditioningSnapshot?: number | null;
  fatigueSnapshot?: number | null;
};

function clampConditioningHandling(value: number): number {
  return Math.min(
    CONDITIONING_HANDLING_MAX,
    Math.max(CONDITIONING_HANDLING_MIN, value)
  );
}

function safeNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function deriveConditioningHandlingScore(
  influences: ConditioningHandlingInfluences = {}
): number {
  const base =
    influences.conditioningSnapshot == null
      ? (safeNumber(influences.coatCondition) +
          safeNumber(influences.muscleTone) +
          safeNumber(influences.ringObedience)) /
        3
      : safeNumber(influences.conditioningSnapshot);
  const fatiguePenalty = safeNumber(
    influences.fatigueSnapshot ?? influences.fatiguePoints
  );

  return Number(
    clampConditioningHandling(base - Math.max(0, fatiguePenalty)).toFixed(2)
  );
}
