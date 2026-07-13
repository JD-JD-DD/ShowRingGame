import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  listBreedingsForKennelAfterProgressResolved,
  resolveBreedingProgressForKennel,
} from "@/server/services/breeding.service";
import { DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES } from "@/server/services/dogVisibleCategories.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  mapLitterDetail,
  mapLitterListItem,
  type LitterDetailDto,
  type LitterListItemDto,
} from "@/server/mappers/litter.mapper";

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

export async function listLittersForKennel(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<{
  litters: LitterListItemDto[];
  activeBreedings: Awaited<
    ReturnType<typeof listBreedingsForKennelAfterProgressResolved>
  >;
}> {
  const { kennelId, currentEpoch } = args;

  await resolveBreedingProgressForKennel({ kennelId, currentEpoch });

  const [litters, activeBreedings] = await Promise.all([
    db.litter.findMany({
      where: visibleToKennelWhere(kennelId),
      orderBy: [{ bornEpoch: "desc" }, { createdAt: "desc" }],
      select: litterListSelect,
    }),
    listBreedingsForKennelAfterProgressResolved({ kennelId, currentEpoch }),
  ]);

  return {
    litters: litters.map((litter) => mapLitterListItem(litter, currentEpoch)),
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
