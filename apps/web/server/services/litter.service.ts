import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  listBreedingsForKennelAfterProgressResolved,
  resolveBreedingProgressForKennel,
  resolveDueBreedingProgressForKennel,
} from "@/server/services/breeding.service";
import { DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES } from "@/server/services/dogVisibleCategories.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  mapLitterDetail,
  mapLitterListItem,
  type LitterDetailDto,
  type LitterListItemDto,
} from "@/server/mappers/litter.mapper";

const DEFAULT_LITTER_PAGE_SIZE = 10;
const MAX_LITTER_PAGE_SIZE = 10;

const litterListSelect = Prisma.validator<Prisma.LitterSelect>()({
  id: true,
  breedCode2: true,
  serial7: true,
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
    orderBy: [{ litterOrder: "asc" }, { regNumber: "asc" }],
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      sex: true,
      visibilityState: true,
      litterOrder: true,
    },
  },
});

const litterDetailSelect = Prisma.validator<Prisma.LitterSelect>()({
  ...litterListSelect,
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
    OR: [
      { bredByKennelId: kennelId },
      {
        sire: {
          ownerKennelId: kennelId,
        },
      },
      {
        puppies: {
          some: {
            ownerKennelId: kennelId,
          },
        },
      },
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
  cursor?: LitterListCursor | null;
}): Prisma.LitterWhereInput {
  const { kennelId, cursor } = args;
  const visibilityWhere = visibleToKennelWhere(kennelId);

  if (!cursor) {
    return visibilityWhere;
  }

  const cursorCreatedAt = new Date(cursor.createdAt);

  return {
    AND: [
      visibilityWhere,
      {
        OR: [
          {
            bornEpoch: {
              lt: cursor.bornEpoch,
            },
          },
          {
            bornEpoch: cursor.bornEpoch,
            createdAt: {
              lt: cursorCreatedAt,
            },
          },
          {
            bornEpoch: cursor.bornEpoch,
            createdAt: cursorCreatedAt,
            id: {
              lt: cursor.litterId,
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

async function loadLitterListPageForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListPageResult> {
  const { kennelId, currentEpoch, cursor } = args;
  const pageSize = clampLitterPageSize(args.limit);

  const litters = await db.litter.findMany({
    where: buildLitterPageWhere({ kennelId, cursor }),
    orderBy: [
      { bornEpoch: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: pageSize + 1,
    select: litterListSelect,
  });

  const hasMore = litters.length > pageSize;
  const pageLitters = hasMore ? litters.slice(0, pageSize) : litters;

  return {
    litters: pageLitters.map((litter) => mapLitterListItem(litter, currentEpoch)),
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
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListSummaryResult> {
  const { kennelId, currentEpoch, cursor, limit } = args;

  const [page, totals] = await Promise.all([
    loadLitterListPageForKennel({
      kennelId,
      currentEpoch,
      cursor,
      limit,
    }),
    db.litter.aggregate({
      where: visibleToKennelWhere(kennelId),
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
  cursor?: LitterListCursor | null;
  limit?: number;
}): Promise<LitterListPageResult> {
  return loadLitterListPageForKennel(args);
}

export async function listLittersForKennel(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<{
  litters: LitterListItemDto[];
  nextCursor: LitterListCursor | null;
  hasMore: boolean;
  totalCount: number;
  totalPuppyCount: number;
  activeBreedings: Awaited<
    ReturnType<typeof listBreedingsForKennelAfterProgressResolved>
  >;
}> {
  const { kennelId, currentEpoch } = args;

  await resolveDueBreedingProgressForKennel({ kennelId, currentEpoch });

  const [litterSummary, activeBreedings] = await Promise.all([
    loadLitterListSummaryForKennel({
      kennelId,
      currentEpoch,
      limit: DEFAULT_LITTER_PAGE_SIZE,
    }),
    listBreedingsForKennelAfterProgressResolved({ kennelId, currentEpoch }),
  ]);

  return {
    ...litterSummary,
    activeBreedings,
  };
}

export async function getLitterForKennel(args: {
  kennelId: string;
  litterId: string;
  currentEpoch: number;
}): Promise<LitterDetailDto | null> {
  const { kennelId, litterId, currentEpoch } = args;

  await resolveBreedingProgressForKennel({ kennelId, currentEpoch });

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

  return mapLitterDetail(litterWithFreshHealthTruths, currentEpoch);
}
