import { db } from "@/lib/db";
import { getAnnualChampionshipCompetitionObservations } from "@/server/services/annualChampionshipCompetitionObservation.service";
import {
  ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_CALCULATION_VERSION,
  resolveAnnualChampionshipPointScheduleSource,
  type PriorPublishedAnnualChampionshipPointSchedule,
} from "@showring/rules";
import { CURRENT_BREED_RELEASE, SHOW_DISTRICT_COUNT } from "@showring/rules";
import { type Sex } from "@prisma/client";

const SEXES: readonly Sex[] = ["M", "F"];

type ExpectedKey = { district: number; breedCode2: string; sex: Sex };
type UnresolvedKey = ExpectedKey & { reason: string };

export type AnnualChampionshipPointScheduleBuildResult = {
  sourceYear: number;
  effectiveYear: number;
  publicationId: string;
  publicationStatus: "DRAFT" | "PUBLISHED";
  expectedScheduleCount: number;
  resolvedScheduleCount: number;
  resolutionCounts: Record<"LOCAL" | "PRIOR_PUBLISHED_SCHEDULE" | "NATIONAL_SAME_BREED_SAME_SEX" | "MINIMUM_POINT_SCHEDULE", number>;
  unresolved: UnresolvedKey[];
  dataQualityFailure: { district: number; breedCode2: string; sex: Sex } | null;
  publishedThisInvocation: boolean;
  alreadyPublished: boolean;
};

function keyOf(key: ExpectedKey): string {
  return `${key.district}:${key.breedCode2}:${key.sex}`;
}

function assertConsecutiveYears(sourceYear: number, effectiveYear: number): void {
  if (!Number.isInteger(sourceYear) || !Number.isInteger(effectiveYear) || effectiveYear !== sourceYear + 1) {
    throw new Error("Annual Championship Point Schedule builds require effectiveYear to equal sourceYear + 1.");
  }
}

async function getOrCreateDraftPublication(sourceYear: number, effectiveYear: number) {
  let publication = await db.annualChampionshipPointSchedulePublication.findUnique({ where: { effectiveYear } });
  if (!publication) {
    try {
      publication = await db.annualChampionshipPointSchedulePublication.create({
        data: { sourceYear, effectiveYear, calculationVersion: ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_CALCULATION_VERSION, status: "DRAFT", calculatedAt: new Date() },
      });
    } catch {
      publication = await db.annualChampionshipPointSchedulePublication.findUnique({ where: { effectiveYear } });
      if (!publication) throw new Error("Unable to create or claim the Annual Championship Point Schedule publication.");
    }
  }
  if (publication.sourceYear !== sourceYear || publication.calculationVersion !== ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_CALCULATION_VERSION) {
    throw new Error("Annual Championship Point Schedule publication conflicts with the requested source year or calculation version.");
  }
  return publication;
}

function scheduleDataFromResolution(args: {
  publicationId: string;
  effectiveYear: number;
  district: number;
  breedCode2: string;
  sex: Sex;
  resolution: ReturnType<typeof resolveAnnualChampionshipPointScheduleSource>;
}) {
  const base = { publicationId: args.publicationId, effectiveYear: args.effectiveYear, district: args.district, breedCode2: args.breedCode2, sex: args.sex };
  if (args.resolution.resolutionType === "PRIOR_PUBLISHED_SCHEDULE") {
    const schedule = args.resolution.priorSchedule;
    return { ...base, onePointThreshold: schedule.onePointThreshold, twoPointThreshold: schedule.twoPointThreshold, threePointThreshold: schedule.threePointThreshold, fourPointThreshold: schedule.fourPointThreshold, fivePointThreshold: schedule.fivePointThreshold, observationCount: schedule.observationCount, resolutionType: "PRIOR_PUBLISHED_SCHEDULE" as const, sourceObservationCount: null, inheritedFromScheduleId: schedule.id, achievedOnePointRate: schedule.achievedOnePointRate, achievedMajorRate: schedule.achievedMajorRate, achievedFivePointRate: schedule.achievedFivePointRate };
  }
  if (args.resolution.resolutionType === "LOCAL" || args.resolution.resolutionType === "NATIONAL_SAME_BREED_SAME_SEX" || args.resolution.resolutionType === "MINIMUM_POINT_SCHEDULE") {
    const calculation = args.resolution.calculation;
    return { ...base, onePointThreshold: calculation.onePointThreshold, twoPointThreshold: calculation.twoPointThreshold, threePointThreshold: calculation.threePointThreshold, fourPointThreshold: calculation.fourPointThreshold, fivePointThreshold: calculation.fivePointThreshold, observationCount: calculation.observationCount, resolutionType: args.resolution.resolutionType, sourceObservationCount: args.resolution.sourceObservationCount, inheritedFromScheduleId: null, achievedOnePointRate: calculation.achievedOnePointRate, achievedMajorRate: calculation.achievedMajorRate, achievedFivePointRate: calculation.achievedFivePointRate };
  }
  return null;
}

function matchesSchedule(existing: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  const rateFields = new Set(["achievedOnePointRate", "achievedMajorRate", "achievedFivePointRate"]);
  return Object.entries(expected).every(([field, value]) =>
    rateFields.has(field)
      ? Number(existing[field]).toFixed(6) === Number(value).toFixed(6)
      : String(existing[field] ?? "") === String(value ?? "")
  );
}

/** Builds or resumes one DRAFT annual set and publishes only after exact key coverage. */
export async function ensureAnnualChampionshipPointSchedulesForEffectiveYear(args: {
  sourceYear: number;
  effectiveYear: number;
}): Promise<AnnualChampionshipPointScheduleBuildResult> {
  assertConsecutiveYears(args.sourceYear, args.effectiveYear);
  const publication = await getOrCreateDraftPublication(args.sourceYear, args.effectiveYear);
  const emptyCounts = { LOCAL: 0, PRIOR_PUBLISHED_SCHEDULE: 0, NATIONAL_SAME_BREED_SAME_SEX: 0, MINIMUM_POINT_SCHEDULE: 0 };
  if (publication.status === "PUBLISHED") {
    return { sourceYear: args.sourceYear, effectiveYear: args.effectiveYear, publicationId: publication.id, publicationStatus: "PUBLISHED", expectedScheduleCount: 0, resolvedScheduleCount: 0, resolutionCounts: emptyCounts, unresolved: [], dataQualityFailure: null, publishedThisInvocation: false, alreadyPublished: true };
  }

  const [breeds, observations, priorSchedules, existingSchedules] = await Promise.all([
    db.breed.findMany({ where: { isActive: true, releaseVersion: { lte: CURRENT_BREED_RELEASE } }, select: { code2: true }, orderBy: { code2: "asc" } }),
    getAnnualChampionshipCompetitionObservations({ client: db, sourceYear: args.sourceYear }),
    db.annualChampionshipPointSchedule.findMany({ where: { effectiveYear: args.sourceYear }, include: { publication: true } }),
    db.annualChampionshipPointSchedule.findMany({ where: { effectiveYear: args.effectiveYear } }),
  ]);
  const expected = breeds.flatMap((breed) => Array.from({ length: SHOW_DISTRICT_COUNT }, (_, index) => SEXES.map((sex) => ({ district: index + 1, breedCode2: breed.code2, sex })))).flat();
  const existingByKey = new Map(existingSchedules.map((schedule) => [keyOf(schedule), schedule]));
  const priorByKey = new Map<string, PriorPublishedAnnualChampionshipPointSchedule>(priorSchedules.map((schedule) => [keyOf(schedule), { ...schedule, publicationStatus: schedule.publication.status, achievedOnePointRate: Number(schedule.achievedOnePointRate), achievedMajorRate: Number(schedule.achievedMajorRate), achievedFivePointRate: Number(schedule.achievedFivePointRate) }]));
  const resolutionCounts = { ...emptyCounts };
  const unresolved: UnresolvedKey[] = [];
  let resolvedScheduleCount = 0;

  for (const target of expected) {
    const resolution = resolveAnnualChampionshipPointScheduleSource({ sourceYear: args.sourceYear, targetDistrict: target.district, targetBreedCode2: target.breedCode2, targetSex: target.sex, observations, priorPublishedSchedule: priorByKey.get(keyOf(target)) });
    if (resolution.resolutionType === "DATA_QUALITY_ERROR") {
      return { sourceYear: args.sourceYear, effectiveYear: args.effectiveYear, publicationId: publication.id, publicationStatus: "DRAFT", expectedScheduleCount: expected.length, resolvedScheduleCount, resolutionCounts, unresolved, dataQualityFailure: target, publishedThisInvocation: false, alreadyPublished: false };
    }
    if (resolution.resolutionType === "UNRESOLVED") {
      unresolved.push({ ...target, reason: `${resolution.localReason}:${resolution.reason}` });
      continue;
    }
    const data = scheduleDataFromResolution({ publicationId: publication.id, effectiveYear: args.effectiveYear, ...target, resolution });
    if (!data) throw new Error("Annual Championship Point Schedule resolver returned an unsupported result.");
    const existing = existingByKey.get(keyOf(target));
    if (existing) {
      if (!matchesSchedule(existing as unknown as Record<string, unknown>, data)) throw new Error("Existing DRAFT Annual Championship Point Schedule conflicts with the deterministic build result.");
    } else {
      try {
        await db.annualChampionshipPointSchedule.create({ data });
      } catch {
        const concurrent = await db.annualChampionshipPointSchedule.findUnique({ where: { effectiveYear_district_breedCode2_sex: { effectiveYear: args.effectiveYear, ...target } } });
        if (!concurrent || !matchesSchedule(concurrent as unknown as Record<string, unknown>, data)) throw new Error("Concurrent Annual Championship Point Schedule persistence conflict.");
      }
    }
    resolutionCounts[resolution.resolutionType] += 1;
    resolvedScheduleCount += 1;
  }
  if (unresolved.length > 0) return { sourceYear: args.sourceYear, effectiveYear: args.effectiveYear, publicationId: publication.id, publicationStatus: "DRAFT", expectedScheduleCount: expected.length, resolvedScheduleCount, resolutionCounts, unresolved, dataQualityFailure: null, publishedThisInvocation: false, alreadyPublished: false };

  const actualSchedules = await db.annualChampionshipPointSchedule.findMany({ where: { effectiveYear: args.effectiveYear, publicationId: publication.id }, select: { district: true, breedCode2: true, sex: true } });
  const expectedKeys = new Set(expected.map(keyOf));
  const actualKeys = new Set(actualSchedules.map(keyOf));
  const complete = expectedKeys.size === actualKeys.size && [...expectedKeys].every((key) => actualKeys.has(key));
  if (!complete) throw new Error("Annual Championship Point Schedule publication failed exact canonical completeness validation.");
  const published = await db.annualChampionshipPointSchedulePublication.updateMany({ where: { id: publication.id, status: "DRAFT" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  const latest = await db.annualChampionshipPointSchedulePublication.findUniqueOrThrow({ where: { id: publication.id } });
  return { sourceYear: args.sourceYear, effectiveYear: args.effectiveYear, publicationId: publication.id, publicationStatus: latest.status, expectedScheduleCount: expected.length, resolvedScheduleCount, resolutionCounts, unresolved: [], dataQualityFailure: null, publishedThisInvocation: published.count === 1, alreadyPublished: published.count === 0 && latest.status === "PUBLISHED" };
}
