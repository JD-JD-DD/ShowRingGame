import { type Prisma, type PrismaClient, type Sex } from "@prisma/client";

type ScheduleClient = Pick<
  Prisma.TransactionClient,
  "annualChampionshipPointSchedule" | "annualChampionshipPointSchedulePublication"
>;
type ScheduleDatabase = Pick<PrismaClient, "$transaction">;

export type AnnualChampionshipPointScheduleKey = {
  effectiveYear: number;
  district: number;
  breedCode2: string;
  sex: Sex;
};

export type AnnualChampionshipPointScheduleInput =
  AnnualChampionshipPointScheduleKey & {
    publicationId: string;
    onePointThreshold: number;
    twoPointThreshold: number;
    threePointThreshold: number;
    fourPointThreshold: number;
    fivePointThreshold: number;
    observationCount: number;
    resolutionType?: "LOCAL" | "PRIOR_PUBLISHED_SCHEDULE" | "NATIONAL_SAME_BREED_SAME_SEX";
    sourceObservationCount?: number | null;
    inheritedFromScheduleId?: string | null;
    achievedOnePointRate: number;
    achievedMajorRate: number;
    achievedFivePointRate: number;
  };

export class MissingAnnualChampionshipPointSchedulePublicationError extends Error {}
export class PublishedAnnualChampionshipPointScheduleError extends Error {}
export class UnavailablePublishedAnnualChampionshipPointScheduleError extends Error {}

function whereFor(key: AnnualChampionshipPointScheduleKey) {
  return {
    effectiveYear_district_breedCode2_sex: {
      effectiveYear: key.effectiveYear,
      district: key.district,
      breedCode2: key.breedCode2,
      sex: key.sex,
    },
  };
}

function assertPersistableSchedule(schedule: AnnualChampionshipPointScheduleInput) {
  const integerFields = [
    schedule.effectiveYear,
    schedule.district,
    schedule.onePointThreshold,
    schedule.twoPointThreshold,
    schedule.threePointThreshold,
    schedule.fourPointThreshold,
    schedule.fivePointThreshold,
    schedule.observationCount,
  ];
  if (
    !schedule.publicationId ||
    !schedule.breedCode2 ||
    integerFields.some((value) => !Number.isInteger(value) || value < 0)
  ) {
    throw new Error(
      "Annual Championship Point Schedule fields must use non-negative integer values and canonical identifiers."
    );
  }
  const rates = [
    schedule.achievedOnePointRate,
    schedule.achievedMajorRate,
    schedule.achievedFivePointRate,
  ];
  if (rates.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error(
      "Annual Championship Point Schedule achieved rates must be between zero and one."
    );
  }
}

function toUpdateData(schedule: AnnualChampionshipPointScheduleInput) {
  const { publicationId, effectiveYear, district, breedCode2, sex, resolutionType, sourceObservationCount, inheritedFromScheduleId, ...data } = schedule;
  return { ...data, resolutionType: resolutionType ?? "LOCAL", sourceObservationCount: sourceObservationCount ?? null, inheritedFromScheduleId: inheritedFromScheduleId ?? null };
}

async function requireMutablePublication(
  client: ScheduleClient,
  schedule: AnnualChampionshipPointScheduleInput
) {
  const publication =
    await client.annualChampionshipPointSchedulePublication.findUnique({
      where: { id: schedule.publicationId },
      select: { effectiveYear: true, status: true, publishedAt: true },
    });
  if (!publication) {
    throw new MissingAnnualChampionshipPointSchedulePublicationError(
      "Annual Championship Point Schedule publication does not exist."
    );
  }
  if (publication.effectiveYear !== schedule.effectiveYear) {
    throw new Error(
      "Annual Championship Point Schedule effective year must match its publication."
    );
  }
  if (publication.status === "PUBLISHED" || publication.publishedAt !== null) {
    throw new PublishedAnnualChampionshipPointScheduleError(
      "A published Annual Championship Point Schedule cannot be changed through the normal service API."
    );
  }
}

export async function getAnnualChampionshipPointSchedule(
  args: { client: ScheduleClient } & AnnualChampionshipPointScheduleKey
) {
  return args.client.annualChampionshipPointSchedule.findUnique({
    where: whereFor(args),
    include: { publication: true },
  });
}

export async function getPublishedAnnualChampionshipPointSchedule(
  args: { client: ScheduleClient } & AnnualChampionshipPointScheduleKey
) {
  const schedule = await getAnnualChampionshipPointSchedule(args);
  if (!schedule) {
    throw new UnavailablePublishedAnnualChampionshipPointScheduleError(
      `Missing Annual Championship Point Schedule for ${args.effectiveYear}/${args.district}/${args.breedCode2}/${args.sex}.`
    );
  }
  const publication = schedule.publication;
  if (publication.effectiveYear !== args.effectiveYear || publication.status !== "PUBLISHED" || !publication.publishedAt || Number.isNaN(publication.publishedAt.getTime())) {
    throw new UnavailablePublishedAnnualChampionshipPointScheduleError(
      `Annual Championship Point Schedule publication is unavailable for effective year ${args.effectiveYear}.`
    );
  }
  return schedule;
}

export async function listAnnualChampionshipPointSchedules(args: {
  client: ScheduleClient;
  effectiveYear: number;
}) {
  return args.client.annualChampionshipPointSchedule.findMany({
    where: { effectiveYear: args.effectiveYear },
    orderBy: [{ district: "asc" }, { breedCode2: "asc" }, { sex: "asc" }],
    include: { publication: true },
  });
}

export async function annualChampionshipPointScheduleExists(
  args: { client: ScheduleClient } & AnnualChampionshipPointScheduleKey
) {
  return (await getAnnualChampionshipPointSchedule(args)) !== null;
}

export async function getAnnualChampionshipPointSchedulePublication(args: {
  client: ScheduleClient;
  effectiveYear: number;
}) {
  return args.client.annualChampionshipPointSchedulePublication.findUnique({
    where: { effectiveYear: args.effectiveYear },
  });
}

export async function createAnnualChampionshipPointSchedule(args: {
  database: ScheduleDatabase;
  schedule: AnnualChampionshipPointScheduleInput;
}) {
  assertPersistableSchedule(args.schedule);
  return args.database.$transaction(async (tx) => {
    const client = tx as ScheduleClient;
    await requireMutablePublication(client, args.schedule);
    return client.annualChampionshipPointSchedule.create({ data: { ...args.schedule, resolutionType: args.schedule.resolutionType ?? "LOCAL" } });
  });
}

/**
 * Idempotently writes a future schedule while its annual publication remains
 * mutable. It is intentionally unavailable once that publication is published.
 */
export async function persistAnnualChampionshipPointSchedule(args: {
  database: ScheduleDatabase;
  schedule: AnnualChampionshipPointScheduleInput;
}) {
  assertPersistableSchedule(args.schedule);
  return args.database.$transaction(async (tx) => {
    const client = tx as ScheduleClient;
    await requireMutablePublication(client, args.schedule);
    return client.annualChampionshipPointSchedule.upsert({
      where: whereFor(args.schedule),
      create: { ...args.schedule, resolutionType: args.schedule.resolutionType ?? "LOCAL" },
      update: toUpdateData(args.schedule),
    });
  });
}
