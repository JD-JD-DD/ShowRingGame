import { getChampionshipPointsFromThresholds, type ChampionshipPointThresholds } from "./judging.engine";
import type { GrandChampionAwardCompetitionResult } from "./grandChampionCompetition.engine";

export type GrandChampionPointApplicationResult = Readonly<{
  awardCode: GrandChampionAwardCompetitionResult["awardCode"];
  recipientDogId: string;
  recipientSex: "M" | "F";
  recipientEligible: boolean;
  competitionCount: number;
  bobSameSexComparisonCount?: number;
  bobFullPoints?: number;
  bobSameSexComparisonPoints?: number;
  pointsAwarded: number;
  championDefeatFacts: GrandChampionAwardCompetitionResult["championDefeatFacts"];
}>;

/** Historical-only conversion; Year 17+ must use published thresholds. */
export function getLegacyGrandChampionPointsForCount(countedDogs: number): number {
  return Math.max(0, Math.min(countedDogs - 1, 5));
}

function resultBase(result: GrandChampionAwardCompetitionResult): Omit<GrandChampionPointApplicationResult, "pointsAwarded" | "bobFullPoints" | "bobSameSexComparisonPoints"> {
  return {
    awardCode: result.awardCode,
    recipientDogId: result.recipientDogId,
    recipientSex: result.recipientSex,
    recipientEligible: result.recipientEligible,
    competitionCount: result.competitionCount,
    ...(result.bobSameSexComparisonCount === undefined ? {} : { bobSameSexComparisonCount: result.bobSameSexComparisonCount }),
    championDefeatFacts: result.championDefeatFacts,
  };
}

/** Applies one published sex-specific annual schedule to one GCH-03 award result. */
export function calculateGrandChampionPointsFromCompetition(args: {
  competitionResult: GrandChampionAwardCompetitionResult;
  thresholds: ChampionshipPointThresholds;
}): GrandChampionPointApplicationResult {
  const base = resultBase(args.competitionResult);
  if (!args.competitionResult.recipientEligible) return { ...base, pointsAwarded: 0 };

  const directPoints = getChampionshipPointsFromThresholds({
    dogsInCompetition: args.competitionResult.competitionCount,
    thresholds: args.thresholds,
  });
  if (args.competitionResult.awardCode !== "BOB") {
    return { ...base, pointsAwarded: directPoints };
  }
  const sameSexComparisonCount = args.competitionResult.bobSameSexComparisonCount;
  if (sameSexComparisonCount === undefined) {
    throw new Error("BOB GCH competition results require a same-sex comparison count.");
  }
  const sameSexComparisonPoints = getChampionshipPointsFromThresholds({
    dogsInCompetition: sameSexComparisonCount,
    thresholds: args.thresholds,
  });
  return {
    ...base,
    bobFullPoints: directPoints,
    bobSameSexComparisonPoints: sameSexComparisonPoints,
    pointsAwarded: Math.max(directPoints, sameSexComparisonPoints),
  };
}

/** Historical-only point conversion for ShowCluster years 16 and earlier. */
export function calculateLegacyGrandChampionPointsFromCompetition(
  competitionResult: GrandChampionAwardCompetitionResult
): GrandChampionPointApplicationResult {
  const base = resultBase(competitionResult);
  if (!competitionResult.recipientEligible) return { ...base, pointsAwarded: 0 };
  const directPoints = getLegacyGrandChampionPointsForCount(competitionResult.competitionCount);
  if (competitionResult.awardCode !== "BOB") return { ...base, pointsAwarded: directPoints };
  const sameSexComparisonCount = competitionResult.bobSameSexComparisonCount;
  if (sameSexComparisonCount === undefined) throw new Error("BOB GCH competition results require a same-sex comparison count.");
  const sameSexComparisonPoints = getLegacyGrandChampionPointsForCount(sameSexComparisonCount);
  return { ...base, bobFullPoints: directPoints, bobSameSexComparisonPoints: sameSexComparisonPoints, pointsAwarded: Math.max(directPoints, sameSexComparisonPoints) };
}
