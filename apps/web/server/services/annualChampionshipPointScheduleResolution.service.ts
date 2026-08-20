import { type Prisma, type Sex } from "@prisma/client";
import {
  resolveAnnualChampionshipPointScheduleSource,
  type PriorPublishedAnnualChampionshipPointSchedule,
} from "@showring/rules";

import { getAnnualChampionshipCompetitionObservations } from "./annualChampionshipCompetitionObservation.service";
import { getAnnualChampionshipPointSchedule } from "./annualChampionshipPointSchedule.service";

type ResolutionClient = Pick<
  Prisma.TransactionClient,
  "showAward" | "annualChampionshipPointSchedule" | "annualChampionshipPointSchedulePublication"
>;

/** Loads the immutable inputs for the pure POINTS-04 source-selection policy. */
export async function resolveAnnualChampionshipPointSchedule(args: {
  client: ResolutionClient;
  sourceYear: number;
  targetDistrict: number;
  targetBreedCode2: string;
  targetSex: Sex;
}) {
  const [observations, priorSchedule] = await Promise.all([
    getAnnualChampionshipCompetitionObservations({ client: args.client, sourceYear: args.sourceYear }),
    getAnnualChampionshipPointSchedule({
      client: args.client,
      effectiveYear: args.sourceYear,
      district: args.targetDistrict,
      breedCode2: args.targetBreedCode2,
      sex: args.targetSex,
    }),
  ]);
  const priorPublishedSchedule: PriorPublishedAnnualChampionshipPointSchedule | undefined =
    priorSchedule
      ? {
          id: priorSchedule.id,
          effectiveYear: priorSchedule.effectiveYear,
          district: priorSchedule.district,
          breedCode2: priorSchedule.breedCode2,
          sex: priorSchedule.sex,
          publicationStatus: priorSchedule.publication.status,
          onePointThreshold: priorSchedule.onePointThreshold,
          twoPointThreshold: priorSchedule.twoPointThreshold,
          threePointThreshold: priorSchedule.threePointThreshold,
          fourPointThreshold: priorSchedule.fourPointThreshold,
          fivePointThreshold: priorSchedule.fivePointThreshold,
          observationCount: priorSchedule.observationCount,
          achievedOnePointRate: Number(priorSchedule.achievedOnePointRate),
          achievedMajorRate: Number(priorSchedule.achievedMajorRate),
          achievedFivePointRate: Number(priorSchedule.achievedFivePointRate),
        }
      : undefined;
  return resolveAnnualChampionshipPointScheduleSource({
    sourceYear: args.sourceYear,
    targetDistrict: args.targetDistrict,
    targetBreedCode2: args.targetBreedCode2,
    targetSex: args.targetSex,
    observations,
    priorPublishedSchedule,
  });
}
