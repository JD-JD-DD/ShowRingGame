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
    resolutionType?: "LOCAL" | "PRIOR_PUBLISHED_SCHEDULE" | "NATIONAL_SAME_BREED_SAME_SEX" | "MINIMUM_POINT_SCHEDULE";
    sourceObservationCount?: number | null;
    inheritedFromScheduleId?: string | null;
    achievedOnePointRate: number;
    achievedMajorRate: number;
    achievedFivePointRate: number;
  };

export class MissingAnnualChampionshipPointSchedulePublicationError extends Error {}
export class PublishedAnnualChampionshipPointScheduleError extends Error {}
export class UnavailablePublishedAnnualChampionshipPointScheduleError extends Error {}

export type PublishedPointScheduleYear = Readonly<{
  effectiveYear: number;
  publishedAt: Date;
}>;

export type PublishedPointScheduleBreedRow = Readonly<{
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  dogThresholds: Readonly<{ one: number; two: number; three: number; four: number; five: number }>;
  bitchThresholds: Readonly<{ one: number; two: number; three: number; four: number; five: number }>;
}>;

export type PublishedPointScheduleDivision = Readonly<{
  district: number;
  rows: readonly PublishedPointScheduleBreedRow[];
}>;

export type PublishedPointScheduleTable = Readonly<{
  effectiveYear: number;
  publishedAt: Date;
  divisions: readonly PublishedPointScheduleDivision[];
  incompleteBreedKeys: readonly string[];
}>;

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

/** Player-reference read path: only complete PUBLISHED schedule facts are exposed. */
export async function listPublishedAnnualChampionshipPointScheduleYears(args: {
  client: ScheduleClient;
}): Promise<readonly PublishedPointScheduleYear[]> {
  return args.client.annualChampionshipPointSchedulePublication.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null } },
    orderBy: { effectiveYear: "desc" },
    select: { effectiveYear: true, publishedAt: true },
  }).then((publications) =>
    publications.flatMap((publication) =>
      publication.publishedAt
        ? [{ effectiveYear: publication.effectiveYear, publishedAt: publication.publishedAt }]
        : []
    )
  );
}

/**
 * Loads one published effective year in one set-based schedule read. Division
 * is a presentation filter over canonical district rows, never an aggregate.
 */
export async function getPublishedAnnualChampionshipPointScheduleTable(args: {
  client: ScheduleClient;
  effectiveYear: number;
  district?: number;
}): Promise<PublishedPointScheduleTable | null> {
  const publication = await args.client.annualChampionshipPointSchedulePublication.findUnique({
    where: { effectiveYear: args.effectiveYear },
    select: { id: true, effectiveYear: true, status: true, publishedAt: true },
  });
  if (
    !publication ||
    publication.status !== "PUBLISHED" ||
    !publication.publishedAt
  ) {
    return null;
  }
  const schedules = await args.client.annualChampionshipPointSchedule.findMany({
    where: {
      publicationId: publication.id,
      effectiveYear: args.effectiveYear,
      ...(args.district === undefined ? {} : { district: args.district }),
    },
    select: {
      district: true,
      breedCode2: true,
      sex: true,
      onePointThreshold: true,
      twoPointThreshold: true,
      threePointThreshold: true,
      fourPointThreshold: true,
      fivePointThreshold: true,
      breed: { select: { name: true, groupName: true } },
    },
    orderBy: [{ district: "asc" }, { breedCode2: "asc" }, { sex: "asc" }],
  });
  const pairs = new Map<string, {
    district: number;
    breedCode2: string;
    breedName: string;
    breedGroupName: string | null;
    M?: (typeof schedules)[number];
    F?: (typeof schedules)[number];
  }>();
  for (const schedule of schedules) {
    const key = `${schedule.district}:${schedule.breedCode2}`;
    const pair = pairs.get(key) ?? {
      district: schedule.district,
      breedCode2: schedule.breedCode2,
      breedName: schedule.breed.name,
      breedGroupName: schedule.breed.groupName,
    };
    pair[schedule.sex] = schedule;
    pairs.set(key, pair);
  }
  const divisionRows = new Map<number, PublishedPointScheduleBreedRow[]>();
  const incompleteBreedKeys: string[] = [];
  for (const [key, pair] of pairs) {
    if (!pair.M || !pair.F) {
      incompleteBreedKeys.push(key);
      continue;
    }
    const thresholds = (schedule: NonNullable<typeof pair.M>) => ({
      one: schedule.onePointThreshold,
      two: schedule.twoPointThreshold,
      three: schedule.threePointThreshold,
      four: schedule.fourPointThreshold,
      five: schedule.fivePointThreshold,
    });
    const rows = divisionRows.get(pair.district) ?? [];
    rows.push({
      breedCode2: pair.breedCode2,
      breedName: pair.breedName,
      breedGroupName: pair.breedGroupName,
      dogThresholds: thresholds(pair.M),
      bitchThresholds: thresholds(pair.F),
    });
    divisionRows.set(pair.district, rows);
  }
  return {
    effectiveYear: publication.effectiveYear,
    publishedAt: publication.publishedAt,
    divisions: [...divisionRows.entries()]
      .sort(([left], [right]) => left - right)
      .map(([district, rows]) => ({
        district,
        rows: rows.sort((left, right) => left.breedName.localeCompare(right.breedName)),
      })),
    incompleteBreedKeys,
  };
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
