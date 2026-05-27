import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  listBreedingsForKennel,
  resolveBreedingProgressForKennel,
} from "@/server/services/breeding.service";
import {
  mapLitterDetail,
  mapLitterListItem,
  type LitterDetailDto,
  type LitterListItemDto,
} from "@/server/mappers/litter.mapper";

const litterSelect = Prisma.validator<Prisma.LitterSelect>()({
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
      lifecycleState: true,
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
    },
  },
});

function visibleToKennelWhere(kennelId: string) {
  return {
    OR: [
      { bredByKennelId: kennelId },
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
  activeBreedings: Awaited<ReturnType<typeof listBreedingsForKennel>>;
}> {
  const { kennelId, currentEpoch } = args;

  await resolveBreedingProgressForKennel({ kennelId, currentEpoch });

  const [litters, activeBreedings] = await Promise.all([
    db.litter.findMany({
      where: visibleToKennelWhere(kennelId),
      orderBy: [{ bornEpoch: "desc" }, { createdAt: "desc" }],
      select: litterSelect,
    }),
    listBreedingsForKennel({ kennelId, currentEpoch }),
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
    select: litterSelect,
  });

  return litter ? mapLitterDetail(litter, currentEpoch) : null;
}
