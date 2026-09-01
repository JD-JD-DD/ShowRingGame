import {
  AnnualChampionshipPointScheduleCalculationError,
  calculateAnnualChampionshipPointSchedule,
  type AnnualChampionshipPointScheduleCalculation,
} from "./annualChampionshipPointSchedule.engine";

export const ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_MIN_SAMPLE_SIZE = 10;

export const MINIMUM_ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_THRESHOLDS = {
  onePointThreshold: 2,
  twoPointThreshold: 3,
  threePointThreshold: 4,
  fourPointThreshold: 5,
  fivePointThreshold: 6,
} as const;

export type AnnualChampionshipCompetitionObservationForResolution = {
  sourceYear: number;
  district: number;
  breedCode2: string;
  sex: "M" | "F";
  dogsInCompetition: number;
};

export type PriorPublishedAnnualChampionshipPointSchedule = {
  id: string;
  effectiveYear: number;
  district: number;
  breedCode2: string;
  sex: "M" | "F";
  publicationStatus: "DRAFT" | "PUBLISHED";
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

type Target = {
  sourceYear: number;
  targetDistrict: number;
  targetBreedCode2: string;
  targetSex: "M" | "F";
};

type CalculatedResolution = Target & {
  resolutionType: "LOCAL" | "NATIONAL_SAME_BREED_SAME_SEX";
  sourceObservationCount: number;
  calculation: AnnualChampionshipPointScheduleCalculation;
};

type PriorPublishedScheduleResolution = Target & {
  resolutionType: "PRIOR_PUBLISHED_SCHEDULE";
  sourceObservationCount: number;
  priorSchedule: PriorPublishedAnnualChampionshipPointSchedule;
};

type MinimumPointScheduleResolution = Target & {
  resolutionType: "MINIMUM_POINT_SCHEDULE";
  sourceObservationCount: number;
  calculation: AnnualChampionshipPointScheduleCalculation;
};

type UnresolvedResolution = Target & {
  resolutionType: "UNRESOLVED";
  localObservationCount: number;
  nationalObservationCount: number;
  localReason: "LOCAL_SAMPLE_TOO_SMALL" | "LOCAL_CALCULATION_FAILED";
  reason: "NATIONAL_SAMPLE_TOO_SMALL" | "NATIONAL_CALCULATION_FAILED";
};

type DataQualityResolution = Target & {
  resolutionType: "DATA_QUALITY_ERROR";
  sourceScope: "LOCAL" | "NATIONAL_SAME_BREED_SAME_SEX";
  errorCode: "INVALID_COMPETITION_COUNTS";
};

export type AnnualChampionshipPointScheduleResolution =
  | CalculatedResolution
  | PriorPublishedScheduleResolution
  | MinimumPointScheduleResolution
  | UnresolvedResolution
  | DataQualityResolution;

function isExactPriorPublishedSchedule(
  prior: PriorPublishedAnnualChampionshipPointSchedule | undefined,
  target: Target
): prior is PriorPublishedAnnualChampionshipPointSchedule {
  return Boolean(
    prior &&
      prior.publicationStatus === "PUBLISHED" &&
      prior.effectiveYear === target.sourceYear &&
      prior.district === target.targetDistrict &&
      prior.breedCode2 === target.targetBreedCode2 &&
      prior.sex === target.targetSex
  );
}

function calculatePopulation(counts: readonly number[]):
  | { kind: "CALCULATED"; calculation: AnnualChampionshipPointScheduleCalculation }
  | { kind: "STRUCTURALLY_UNUSABLE" }
  | { kind: "DATA_QUALITY_ERROR" } {
  try {
    return { kind: "CALCULATED", calculation: calculateAnnualChampionshipPointSchedule({ competitionCounts: counts }) };
  } catch (error) {
    if (!(error instanceof AnnualChampionshipPointScheduleCalculationError)) throw error;
    if (error.code === "INVALID_COMPETITION_COUNTS") return { kind: "DATA_QUALITY_ERROR" };
    return { kind: "STRUCTURALLY_UNUSABLE" };
  }
}

function calculateMinimumPointSchedule(counts: readonly number[]): AnnualChampionshipPointScheduleCalculation {
  const threshold = MINIMUM_ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_THRESHOLDS;
  const qualifyingRate = (minimum: number) =>
    counts.length === 0 ? 0 : counts.filter((count) => count >= minimum).length / counts.length;
  return {
    ...threshold,
    observationCount: counts.length,
    achievedOnePointRate: qualifyingRate(threshold.onePointThreshold),
    achievedMajorRate: qualifyingRate(threshold.threePointThreshold),
    achievedFivePointRate: qualifyingRate(threshold.fivePointThreshold),
  };
}

/**
 * Selects one unblended source population for a target schedule. It does not
 * persist, publish, or manufacture data, and leaves threshold mathematics to
 * the POINTS-03 calculator.
 */
export function resolveAnnualChampionshipPointScheduleSource(args: Target & {
  observations: readonly AnnualChampionshipCompetitionObservationForResolution[];
  priorPublishedSchedule?: PriorPublishedAnnualChampionshipPointSchedule;
}): AnnualChampionshipPointScheduleResolution {
  const target: Target = {
    sourceYear: args.sourceYear,
    targetDistrict: args.targetDistrict,
    targetBreedCode2: args.targetBreedCode2,
    targetSex: args.targetSex,
  };
  const sameYearBreedSex = args.observations.filter((observation) =>
    observation.sourceYear === target.sourceYear &&
    observation.breedCode2 === target.targetBreedCode2 &&
    observation.sex === target.targetSex
  );
  const local = sameYearBreedSex.filter((observation) => observation.district === target.targetDistrict);
  const localObservationCount = local.length;
  const nationalObservationCount = sameYearBreedSex.length;
  let localReason: UnresolvedResolution["localReason"] = "LOCAL_SAMPLE_TOO_SMALL";

  if (localObservationCount >= ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_MIN_SAMPLE_SIZE) {
    const localCalculation = calculatePopulation(local.map((observation) => observation.dogsInCompetition));
    if (localCalculation.kind === "CALCULATED") {
      return { ...target, resolutionType: "LOCAL", sourceObservationCount: localObservationCount, calculation: localCalculation.calculation };
    }
    if (localCalculation.kind === "DATA_QUALITY_ERROR") {
      return { ...target, resolutionType: "DATA_QUALITY_ERROR", sourceScope: "LOCAL", errorCode: "INVALID_COMPETITION_COUNTS" };
    }
    localReason = "LOCAL_CALCULATION_FAILED";
  }

  if (isExactPriorPublishedSchedule(args.priorPublishedSchedule, target)) {
    return { ...target, resolutionType: "PRIOR_PUBLISHED_SCHEDULE", sourceObservationCount: localObservationCount, priorSchedule: args.priorPublishedSchedule };
  }

  if (nationalObservationCount < ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_MIN_SAMPLE_SIZE) {
    return {
      ...target,
      resolutionType: "MINIMUM_POINT_SCHEDULE",
      sourceObservationCount: nationalObservationCount,
      calculation: calculateMinimumPointSchedule(sameYearBreedSex.map((observation) => observation.dogsInCompetition)),
    };
  }
  const nationalCalculation = calculatePopulation(sameYearBreedSex.map((observation) => observation.dogsInCompetition));
  if (nationalCalculation.kind === "CALCULATED") {
    return { ...target, resolutionType: "NATIONAL_SAME_BREED_SAME_SEX", sourceObservationCount: nationalObservationCount, calculation: nationalCalculation.calculation };
  }
  if (nationalCalculation.kind === "DATA_QUALITY_ERROR") {
    return { ...target, resolutionType: "DATA_QUALITY_ERROR", sourceScope: "NATIONAL_SAME_BREED_SAME_SEX", errorCode: "INVALID_COMPETITION_COUNTS" };
  }
  return {
    ...target,
    resolutionType: "MINIMUM_POINT_SCHEDULE",
    sourceObservationCount: nationalObservationCount,
    calculation: calculateMinimumPointSchedule(sameYearBreedSex.map((observation) => observation.dogsInCompetition)),
  };
}
