import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { SHOW_YEAR_HOURS } from "@showring/rules";
import {
  listBreedingsForKennelAfterProgressResolved,
} from "@/server/services/breeding.service";
import { DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES } from "@/server/services/dogVisibleCategories.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  mapLitterDetail,
  mapLitterListItem,
  type LitterDetailDto,
  type LitterListItemDto,
  type LitterPuppySummary,
} from "@/server/mappers/litter.mapper";

const DEFAULT_LITTER_PAGE_SIZE = 10;
const MAX_LITTER_PAGE_SIZE = 10;

const litterListSelect = Prisma.validator<Prisma.LitterSelect>()({
  id: true,
  breedCode2: true,
  serial7: true,
  customName: true,
  bornEpoch: true,
  pupCount: true,
  createdAt: true,
  breed: {
    select: {
      name: true,
    },
  },
  sire: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  dam: {
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
    },
  },
  bredByKennel: {
    select: {
      name: true,
    },
  },
  puppies: {
    where: {
      visibilityState: {
        not: "HIDDEN_NEONATAL_LOSS",
      },
    },
    orderBy: [{ litterOrder: "asc" }, { regNumber: "asc" }],
    take: 4,
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
      litterOrder: true,
    },
  },
});

const litterDetailSelect = Prisma.validator<Prisma.LitterSelect>()({
  ...litterListSelect,
  breederNote: true,
  bredByKennel: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  breedingAttempt: {
    select: {
      id: true,
      status: true,
      createdEpoch: true,
      pregCheckEpoch: true,
      dueEpoch: true,
      checkedEpoch: true,
      whelpedEpoch: true,
    },
  },
  puppies: {
    orderBy: [{ litterOrder: "asc" }, { regNumber: "asc" }],
    select: {
      id: true,
      litterId: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
      birthEpoch: true,
      deathEpoch: true,
      lifecycleState: true,
      visibilityState: true,
      isPlayerVisible: true,
      marketState: true,
      litterOrder: true,
      ownerKennel: {
        select: {
          id: true,
          name: true,
        },
      },
      breederKennel: {
        select: {
          id: true,
          name: true,
        },
      },
      kennelRun: {
        select: {
          id: true,
          name: true,
        },
      },
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      healthConditionTruths: {
        where: {
          conditionCode: {
            in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
          },
        },
        select: {
          conditionCode: true,
          geneticLiability: true,
          environmentModifier: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          testTypeCode: true,
          resultCode: true,
        },
      },
    },
  },
});

type LitterDetailForMapping = Prisma.LitterGetPayload<{
  select: typeof litterDetailSelect;
}>;
type PuppyHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

export type LitterListCursor = {
  bornEpoch: number;
  createdAt: string;
  litterId: string;
};

export type LitterArchiveFilters = {
  search: string;
  breedCode2: string | null;
  gameYear: number | null;
  sort: "newest" | "oldest";
};

export type LitterManagementOptions = {
  breeds: Array<{ code2: string; name: string }>;
  years: number[];
};

const DEFAULT_LITTER_ARCHIVE_FILTERS: LitterArchiveFilters = {
  search: "",
  breedCode2: null,
  gameYear: null,
  sort: "newest",
};

const MAX_LITTER_CUSTOM_NAME_LENGTH = 25;
const MAX_LITTER_BREEDER_NOTE_LENGTH = 2_000;

export class LitterMetadataError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export type LitterMetadataInput = {
  customName?: unknown;
  breederNote?: unknown;
};

type LitterMetadataValues = {
  customName: string | null;
  breederNote: string | null;
};

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export function resolveLitterMetadataUpdate(
  current: LitterMetadataValues,
  input: LitterMetadataInput
): Partial<LitterMetadataValues> {
  const update: Partial<LitterMetadataValues> = {};

  if (hasOwn(input, "customName")) {
    if (input.customName !== null && typeof input.customName !== "string") {
      throw new LitterMetadataError("Litter name must be plain text.", 400);
    }

    const customName = typeof input.customName === "string" ? input.customName.trim() : null;

    if (current.customName !== null && customName === null) {
      throw new LitterMetadataError("A named litter must have a litter name.", 400);
    }

    if (customName !== null && customName.length > MAX_LITTER_CUSTOM_NAME_LENGTH) {
      throw new LitterMetadataError("Litter name must be 25 characters or fewer.", 400);
    }

    update.customName = customName || null;
  }

  if (hasOwn(input, "breederNote")) {
    if (input.breederNote !== null && typeof input.breederNote !== "string") {
      throw new LitterMetadataError("Private breeder note must be plain text.", 400);
    }

    const breederNote = typeof input.breederNote === "string" ? input.breederNote.trim() : null;

    if (breederNote !== null && breederNote.length > MAX_LITTER_BREEDER_NOTE_LENGTH) {
      throw new LitterMetadataError(
        "Private breeder note must be 2,000 characters or fewer.",
        400
      );
    }

    update.breederNote = breederNote || null;
  }

  return update;
}

export function parseLitterArchiveFilters(
  input: Record<string, unknown> | null | undefined
): LitterArchiveFilters {
  const search = typeof input?.search === "string" ? input.search.trim().slice(0, 120) : "";
  const breedCandidate = typeof input?.breedCode2 === "string" ? input.breedCode2.trim().toUpperCase() : "";
  const yearCandidate = typeof input?.year === "string" || typeof input?.year === "number" ? Number(input.year) : NaN;

  return {
    search,
    breedCode2: /^[A-Z0-9]{2,12}$/.test(breedCandidate) ? breedCandidate : null,
    gameYear: Number.isInteger(yearCandidate) && yearCandidate >= 1 && yearCandidate <= 10_000 ? yearCandidate : null,
    sort: input?.sort === "oldest" ? "oldest" : DEFAULT_LITTER_ARCHIVE_FILTERS.sort,
  };
}

export type LitterListPageResult = {
  litters: LitterListItemDto[];
  nextCursor: LitterListCursor | null;
  hasMore: boolean;
};

type LitterListSummaryResult = LitterListPageResult & {
  totalCount: number;
  totalPuppyCount: number;
};

function groupHealthConditionTruthsByDog(
  healthConditionTruths: PuppyHealthConditionTruth[]
) {
  const truthsByDogId = new Map<
    string,
    Array<{
      conditionCode: string;
      geneticLiability: number;
      environmentModifier: number;
    }>
  >();

  for (const truth of healthConditionTruths) {
    const truths = truthsByDogId.get(truth.dogId) ?? [];
    truths.push({
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });
    truthsByDogId.set(truth.dogId, truths);
  }

  return truthsByDogId;
}

async function withFreshPuppyHealthConditionTruths(
  litters: LitterDetailForMapping[]
): Promise<LitterDetailForMapping[]> {
  const dogIds = [
    ...new Set(litters.flatMap((litter) => litter.puppies.map((puppy) => puppy.id))),
  ];

  if (dogIds.length === 0) {
    return litters;
  }

  await ensurePhenotypeHealthTruthsForDogs(db, dogIds);

  const healthConditionTruths = await db.dogHealthConditionTruth.findMany({
    where: {
      dogId: {
        in: dogIds,
      },
      conditionCode: {
        in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
      },
    },
    select: {
      dogId: true,
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });
  const truthsByDogId = groupHealthConditionTruthsByDog(healthConditionTruths);

  return litters.map((litter) => ({
    ...litter,
    puppies: litter.puppies.map((puppy) => ({
      ...puppy,
      healthConditionTruths:
        truthsByDogId.get(puppy.id) ?? puppy.healthConditionTruths,
    })),
  }));
}

function visibleToKennelWhere(kennelId: string) {
  return {
    bredByKennelId: kennelId,
  };
}

export async function getLitterManagementOptions(args: {
  kennelId: string;
}): Promise<LitterManagementOptions> {
  const where = visibleToKennelWhere(args.kennelId);
  const [breedRows, yearRange] = await Promise.all([
    db.litter.findMany({
      where,
      distinct: ["breedCode2"],
      select: {
        breedCode2: true,
        breed: { select: { name: true } },
      },
    }),
    db.litter.aggregate({
      where,
      _min: { bornEpoch: true },
      _max: { bornEpoch: true },
    }),
  ]);
  const firstYear = yearRange._min.bornEpoch === null ? null : Math.floor(yearRange._min.bornEpoch / SHOW_YEAR_HOURS) + 1;
  const lastYear = yearRange._max.bornEpoch === null ? null : Math.floor(yearRange._max.bornEpoch / SHOW_YEAR_HOURS) + 1;

  return {
    breeds: breedRows
      .map((row) => ({ code2: row.breedCode2, name: row.breed.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    years:
      firstYear === null || lastYear === null
        ? []
        : Array.from({ length: lastYear - firstYear + 1 }, (_, index) => lastYear - index),
  };
}

function buildLitterArchiveWhere(args: {
  kennelId: string;
  filters: LitterArchiveFilters;
}): Prisma.LitterWhereInput {
  const { kennelId, filters } = args;
  const search = filters.search;
  const searchWhere: Prisma.LitterWhereInput | null = search
    ? {
        OR: [
          { serial7: { contains: search, mode: "insensitive" } },
          {
            sire: {
              OR: [
                { callName: { contains: search, mode: "insensitive" } },
                { registeredName: { contains: search, mode: "insensitive" } },
                { regNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          {
            dam: {
              OR: [
                { callName: { contains: search, mode: "insensitive" } },
                { registeredName: { contains: search, mode: "insensitive" } },
                { regNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          {
            puppies: {
              some: {
                OR: [
                  { callName: { contains: search, mode: "insensitive" } },
                  { registeredName: { contains: search, mode: "insensitive" } },
                  { regNumber: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      }
    : null;
  const yearStart = filters.gameYear === null ? null : (filters.gameYear - 1) * SHOW_YEAR_HOURS;

  return {
    AND: [
      visibleToKennelWhere(kennelId),
      ...(filters.breedCode2 ? [{ breedCode2: filters.breedCode2 }] : []),
      ...(yearStart === null ? [] : [{ bornEpoch: { gte: yearStart, lt: yearStart + SHOW_YEAR_HOURS } }]),
      ...(searchWhere ? [searchWhere] : []),
    ],
  };
}

function clampLitterPageSize(limit?: number): number {
  return Math.min(
    Math.max(limit ?? DEFAULT_LITTER_PAGE_SIZE, 1),
    MAX_LITTER_PAGE_SIZE
  );
}

function buildLitterPageWhere(args: {
  kennelId: string;
  filters: LitterArchiveFilters;
  cursor?: LitterListCursor | null;
}): Prisma.LitterWhereInput {
  const { kennelId, filters, cursor } = args;
  const archiveWhere = buildLitterArchiveWhere({ kennelId, filters });

  if (!cursor) {
    return archiveWhere;
  }

  const cursorCreatedAt = new Date(cursor.createdAt);

  return {
    AND: [
      archiveWhere,
      {
        OR: [
          {
            bornEpoch: {
              [filters.sort === "newest" ? "lt" : "gt"]: cursor.bornEpoch,
            },
          },
          {
            bornEpoch: cursor.bornEpoch,
            createdAt: {
              [filters.sort === "newest" ? "lt" : "gt"]: cursorCreatedAt,
            },
          },
          {
            bornEpoch: cursor.bornEpoch,
            createdAt: cursorCreatedAt,
            id: {
              [filters.sort === "newest" ? "lt" : "gt"]: cursor.litterId,
            },
          },
        ],
      },
    ],
  };
}

function makeLitterCursor(litter: {
  id: string;
  bornEpoch: number;
  createdAt: Date;
}): LitterListCursor {
  return {
    bornEpoch: litter.bornEpoch,
    createdAt: litter.createdAt.toISOString(),
    litterId: litter.id,
  };
}

async function loadLitterPuppySummaries(litterIds: string[]) {
  const summaries = new Map<string, LitterPuppySummary>(
    litterIds.map((litterId) => [
      litterId,
      {
        survivedCount: 0,
        neonatalLossCount: 0,
        maleCount: 0,
        femaleCount: 0,
      },
    ])
  );

  if (litterIds.length === 0) {
    return summaries;
  }

  const counts = await db.dog.groupBy({
    by: ["litterId", "sex", "visibilityState"],
    where: {
      litterId: {
        in: litterIds,
      },
    },
    _count: {
      _all: true,
    },
  });

  for (const count of counts) {
    if (!count.litterId) {
      continue;
    }

    const summary = summaries.get(count.litterId);
    if (!summary) {
      continue;
    }

    if (count.visibilityState === "HIDDEN_NEONATAL_LOSS") {
      summary.neonatalLossCount += count._count._all;
    } else {
      summary.survivedCount += count._count._all;
    }

    if (count.sex === "M") {
      summary.maleCount += count._count._all;
    } else {
      summary.femaleCount += count._count._all;
    }
  }

  return summaries;
}

async function loadLitterListPageForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  filters?: LitterArchiveFilters;
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListPageResult> {
  const { kennelId, currentEpoch, cursor, filters = DEFAULT_LITTER_ARCHIVE_FILTERS } = args;
  const pageSize = clampLitterPageSize(args.limit);

  const litters = await db.litter.findMany({
    where: buildLitterPageWhere({ kennelId, filters, cursor }),
    orderBy: [
      { bornEpoch: filters.sort === "newest" ? "desc" : "asc" },
      { createdAt: filters.sort === "newest" ? "desc" : "asc" },
      { id: filters.sort === "newest" ? "desc" : "asc" },
    ],
    take: pageSize + 1,
    select: litterListSelect,
  });

  const hasMore = litters.length > pageSize;
  const pageLitters = hasMore ? litters.slice(0, pageSize) : litters;
  const puppySummaries = await loadLitterPuppySummaries(
    pageLitters.map((litter) => litter.id)
  );

  return {
    litters: pageLitters.map((litter) =>
      mapLitterListItem(
        {
          ...litter,
          puppySummary: puppySummaries.get(litter.id),
        },
        currentEpoch
      )
    ),
    nextCursor:
      hasMore && pageLitters.length > 0
        ? makeLitterCursor(pageLitters[pageLitters.length - 1])
        : null,
    hasMore,
  };
}

async function loadLitterListSummaryForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  filters?: LitterArchiveFilters;
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListSummaryResult> {
  const { kennelId, currentEpoch, cursor, limit, filters = DEFAULT_LITTER_ARCHIVE_FILTERS } = args;
  const archiveWhere = buildLitterArchiveWhere({ kennelId, filters });

  const [page, totals] = await Promise.all([
    loadLitterListPageForKennel({
      kennelId,
      currentEpoch,
      filters,
      cursor,
      limit,
    }),
    db.litter.aggregate({
      where: archiveWhere,
      _count: {
        _all: true,
      },
      _sum: {
        pupCount: true,
      },
    }),
  ]);

  return {
    ...page,
    totalCount: totals._count._all,
    totalPuppyCount: totals._sum.pupCount ?? 0,
  };
}

export async function listLitterPageForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  filters?: LitterArchiveFilters;
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListPageResult> {
  return loadLitterListPageForKennel(args);
}

export async function listLittersForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  filters?: LitterArchiveFilters;
}): Promise<{
  litters: LitterListItemDto[];
  nextCursor: LitterListCursor | null;
  hasMore: boolean;
  totalCount: number;
  totalPuppyCount: number;
  historicalTotalCount: number;
  activeBreedings: Awaited<
    ReturnType<typeof listBreedingsForKennelAfterProgressResolved>
  >;
}> {
  const { kennelId, currentEpoch, filters = DEFAULT_LITTER_ARCHIVE_FILTERS } = args;

  const [litterSummary, activeBreedings, historicalTotalCount] = await Promise.all([
    loadLitterListSummaryForKennel({
      kennelId,
      currentEpoch,
      filters,
      limit: DEFAULT_LITTER_PAGE_SIZE,
    }),
    listBreedingsForKennelAfterProgressResolved({ kennelId, currentEpoch }),
    db.litter.count({ where: visibleToKennelWhere(kennelId) }),
  ]);

  return {
    ...litterSummary,
    historicalTotalCount,
    activeBreedings,
  };
}

export async function getLitterForKennel(args: {
  kennelId: string;
  litterId: string;
  currentEpoch: number;
}): Promise<LitterDetailDto | null> {
  const { kennelId, litterId, currentEpoch } = args;

  const litter = await db.litter.findFirst({
    where: {
      id: litterId,
      ...visibleToKennelWhere(kennelId),
    },
    select: litterDetailSelect,
  });

  if (!litter) {
    return null;
  }

  const [litterWithFreshHealthTruths] =
    await withFreshPuppyHealthConditionTruths([litter]);

  return await mapLitterDetail(litterWithFreshHealthTruths, currentEpoch, kennelId);
}

export async function updateLitterMetadata(args: {
  kennelId: string;
  litterId: string;
  input: LitterMetadataInput;
}) {
  const litter = await db.litter.findFirst({
    where: {
      id: args.litterId,
      bredByKennelId: args.kennelId,
    },
    select: {
      id: true,
      customName: true,
      breederNote: true,
    },
  });

  if (!litter) {
    throw new LitterMetadataError("Litter not found.", 404);
  }

  const update = resolveLitterMetadataUpdate(litter, args.input);

  if (Object.keys(update).length === 0) {
    return {
      customName: litter.customName,
      breederNote: litter.breederNote,
    };
  }

  return db.litter.update({
    where: { id: litter.id },
    data: update,
    select: {
      customName: true,
      breederNote: true,
    },
  });
}
