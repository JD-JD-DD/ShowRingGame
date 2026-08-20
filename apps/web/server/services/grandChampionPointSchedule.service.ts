import type { Sex } from "@prisma/client";

import {
  getPublishedAnnualChampionshipPointSchedule,
} from "@/server/services/annualChampionshipPointSchedule.service";

type GrandChampionPointScheduleClient = Parameters<
  typeof getPublishedAnnualChampionshipPointSchedule
>[0]["client"];

export const GRAND_CHAMPION_DYNAMIC_SCHEDULE_START_YEAR = 17;

export class GrandChampionPointScheduleYearBoundaryError extends Error {}

export function usesDynamicGrandChampionPointSchedule(effectiveYear: number): boolean {
  return effectiveYear >= GRAND_CHAMPION_DYNAMIC_SCHEDULE_START_YEAR;
}

export type GrandChampionPublishedPointSchedule = Readonly<{
  scheduleId: string;
  publicationId: string;
  calculationVersion: string;
  sex: Sex;
  thresholds: Readonly<{
    onePointThreshold: number;
    twoPointThreshold: number;
    threePointThreshold: number;
    fourPointThreshold: number;
    fivePointThreshold: number;
  }>;
}>;

/** Resolves the one exact published CH/GCH schedule key; it never calculates or falls back. */
export async function resolveGrandChampionPointSchedule(args: {
  client: GrandChampionPointScheduleClient;
  effectiveYear: number;
  district: number;
  breedCode2: string;
  sex: Sex;
}): Promise<GrandChampionPublishedPointSchedule> {
  if (!usesDynamicGrandChampionPointSchedule(args.effectiveYear)) {
    throw new GrandChampionPointScheduleYearBoundaryError(
      `Year ${args.effectiveYear} uses the legacy Grand Champion point conversion.`
    );
  }
  const schedule = await getPublishedAnnualChampionshipPointSchedule(args);
  return {
    scheduleId: schedule.id,
    publicationId: schedule.publicationId,
    calculationVersion: schedule.publication.calculationVersion,
    sex: schedule.sex,
    thresholds: {
      onePointThreshold: schedule.onePointThreshold,
      twoPointThreshold: schedule.twoPointThreshold,
      threePointThreshold: schedule.threePointThreshold,
      fourPointThreshold: schedule.fourPointThreshold,
      fivePointThreshold: schedule.fivePointThreshold,
    },
  };
}

/** Bounded helper for one breed block: deduplicates to at most M and F schedule reads. */
export async function resolveGrandChampionPointSchedules(args: {
  client: GrandChampionPointScheduleClient;
  effectiveYear: number;
  district: number;
  breedCode2: string;
  sexes: readonly Sex[];
}): Promise<ReadonlyMap<Sex, GrandChampionPublishedPointSchedule>> {
  if (!usesDynamicGrandChampionPointSchedule(args.effectiveYear)) {
    throw new GrandChampionPointScheduleYearBoundaryError(
      `Year ${args.effectiveYear} uses the legacy Grand Champion point conversion.`
    );
  }
  const uniqueSexes = [...new Set(args.sexes)];
  const schedules = await Promise.all(
    uniqueSexes.map((sex) => resolveGrandChampionPointSchedule({ ...args, sex }))
  );
  return new Map<Sex, GrandChampionPublishedPointSchedule>(
    schedules.map((schedule) => [schedule.sex, schedule] as const)
  );
}
