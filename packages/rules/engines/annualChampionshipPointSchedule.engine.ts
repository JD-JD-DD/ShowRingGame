export type AnnualChampionshipPointScheduleCalculation = {
  onePointThreshold: number;
  twoPointThreshold: number;
  threePointThreshold: number;
  fourPointThreshold: number;
  fivePointThreshold: number;
  observationCount: number;
  achievedOnePointRate: number;
  achievedMajorRate: number;
  achievedFivePointRate: number;
};

export type AnnualChampionshipPointScheduleCalculationFailureCode =
  | "INVALID_COMPETITION_COUNTS"
  | "NO_VALID_MAJOR_THRESHOLD"
  | "NO_VALID_FIVE_POINT_THRESHOLD"
  | "NON_MONOTONIC_THRESHOLDS";

export class AnnualChampionshipPointScheduleCalculationError extends Error {
  constructor(
    public readonly code: AnnualChampionshipPointScheduleCalculationFailureCode,
    message: string
  ) {
    super(message);
    this.name = "AnnualChampionshipPointScheduleCalculationError";
  }
}

function qualifyingRate(counts: readonly number[], threshold: number): number {
  return qualifyingCount(counts, threshold) / counts.length;
}

function qualifyingCount(counts: readonly number[], threshold: number): number {
  return counts.filter((count) => count >= threshold).length;
}

function selectClosestThreshold(args: {
  counts: readonly number[];
  minimumThreshold: number;
  maximumThreshold: number;
  targetBasisPoints: number;
  maximumBasisPoints?: number;
}): number | null {
  let selected: { threshold: number; distance: number } | null = null;
  for (let threshold = args.minimumThreshold; threshold <= args.maximumThreshold; threshold += 1) {
    const count = qualifyingCount(args.counts, threshold);
    const scaledCount = count * 10_000;
    if (args.maximumBasisPoints !== undefined && scaledCount > args.maximumBasisPoints * args.counts.length) continue;
    const distance = Math.abs(scaledCount - args.targetBasisPoints * args.counts.length);
    if (
      selected === null ||
      distance < selected.distance ||
      (distance === selected.distance && threshold > selected.threshold)
    ) {
      selected = { threshold, distance };
    }
  }
  return selected?.threshold ?? null;
}

function validateCompetitionCounts(competitionCounts: readonly number[]): void {
  if (competitionCounts.length === 0) {
    throw new AnnualChampionshipPointScheduleCalculationError(
      "INVALID_COMPETITION_COUNTS",
      "Annual Championship Point Schedule calculation requires at least one competition observation."
    );
  }
  for (const count of competitionCounts) {
    if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
      throw new AnnualChampionshipPointScheduleCalculationError(
        "INVALID_COMPETITION_COUNTS",
        "Annual Championship competition observations must be finite positive integers."
      );
    }
  }
}

/** Deterministically derives a schedule from one canonical WD/WB count sample. */
export function calculateAnnualChampionshipPointSchedule(args: {
  competitionCounts: readonly number[];
}): AnnualChampionshipPointScheduleCalculation {
  const counts = args.competitionCounts;
  validateCompetitionCounts(counts);
  const maximumObservedCount = Math.max(...counts);

  let onePointThreshold = 2;
  for (let threshold = 2; threshold <= maximumObservedCount; threshold += 1) {
    if (qualifyingCount(counts, threshold) * 100 >= 95 * counts.length) onePointThreshold = threshold;
  }

  const threePointThreshold = selectClosestThreshold({
    counts,
    minimumThreshold: onePointThreshold + 2,
    maximumThreshold: maximumObservedCount,
    targetBasisPoints: 1_800,
    maximumBasisPoints: 2_000,
  });
  if (threePointThreshold === null) {
    throw new AnnualChampionshipPointScheduleCalculationError(
      "NO_VALID_MAJOR_THRESHOLD",
      "No reachable three-point threshold satisfies the annual major-rate rules."
    );
  }

  const fivePointThreshold = selectClosestThreshold({
    counts,
    minimumThreshold: threePointThreshold + 2,
    maximumThreshold: maximumObservedCount,
    targetBasisPoints: 200,
  });
  if (fivePointThreshold === null) {
    throw new AnnualChampionshipPointScheduleCalculationError(
      "NO_VALID_FIVE_POINT_THRESHOLD",
      "No reachable five-point threshold satisfies the required spacing."
    );
  }

  const twoPointThreshold = Math.round(onePointThreshold + 0.5 * (threePointThreshold - onePointThreshold));
  const fourPointThreshold = Math.round(threePointThreshold + (2 / 3) * (fivePointThreshold - threePointThreshold));
  if (!(onePointThreshold < twoPointThreshold && twoPointThreshold < threePointThreshold && threePointThreshold < fourPointThreshold && fourPointThreshold < fivePointThreshold)) {
    throw new AnnualChampionshipPointScheduleCalculationError(
      "NON_MONOTONIC_THRESHOLDS",
      "Annual Championship Point Schedule thresholds must be strictly increasing."
    );
  }

  return {
    onePointThreshold,
    twoPointThreshold,
    threePointThreshold,
    fourPointThreshold,
    fivePointThreshold,
    observationCount: counts.length,
    achievedOnePointRate: qualifyingRate(counts, onePointThreshold),
    achievedMajorRate: qualifyingRate(counts, threePointThreshold),
    achievedFivePointRate: qualifyingRate(counts, fivePointThreshold),
  };
}
