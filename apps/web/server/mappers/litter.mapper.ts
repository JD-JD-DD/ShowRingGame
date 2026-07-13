import type { VisibleCategories } from "@showring/rules";
import { formatDogDisplayName } from "@/lib/dogNames";
import { deriveCurrentVisibleCategoriesForDogDisplay } from "@/server/services/dogVisibleCategories.service";

type ParentDogInput = {
  id: string;
  callName: string | null;
  registeredName?: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
  sex: "M" | "F";
};

type LitterListPuppyPreviewInput = ParentDogInput & {
  visibilityState: string;
  litterOrder: number | null;
};

type PuppyDogInput = LitterListPuppyPreviewInput & {
  birthEpoch: number;
  deathEpoch: number | null;
  lifecycleState: string;
  isPlayerVisible: boolean;
  marketState: string;
  traitHead: number;
  traitForequarters: number;
  traitHindquarters: number;
  traitGait: number;
  traitCoat: number;
  traitSize: number;
  traitTemperament: number;
  traitShowShine: number;
  traitFeet: number;
  traitTopline: number;
  healthConditionTruths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
  healthTests: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
};

type LitterListInput = {
  id: string;
  breedCode2: string;
  serial7: string;
  bornEpoch: number;
  pupCount: number;
  createdAt: Date;
  breed: {
    name: string;
  };
  sire: ParentDogInput;
  dam: ParentDogInput;
  bredByKennel: {
    name: string;
  } | null;
  puppies: LitterListPuppyPreviewInput[];
};

type LitterDetailInput = {
  id: string;
  breedCode2: string;
  serial7: string;
  bornEpoch: number;
  pupCount: number;
  createdAt: Date;
  breed: {
    name: string;
  };
  sire: ParentDogInput;
  dam: ParentDogInput;
  bredByKennel: {
    id: string;
    name: string;
    slug: string;
  } | null;
  breedingAttempt: {
    id: string;
    status: string;
    createdEpoch: number;
    pregCheckEpoch: number | null;
    dueEpoch: number | null;
    checkedEpoch: number | null;
    whelpedEpoch: number | null;
  } | null;
  puppies: PuppyDogInput[];
};

export type LitterParentDto = {
  dogId: string;
  displayName: string;
  regNumber: string;
  sex: "M" | "F";
};

export type LitterPuppyPreviewDto = LitterParentDto & {
  litterOrder: number | null;
};

export type LitterPuppyDto = LitterParentDto & {
  ageHours: number;
  deathEpoch: number | null;
  lifecycleState: string;
  visibilityState: string;
  isPlayerVisible: boolean;
  isNeonatalLoss: boolean;
  marketState: string;
  litterOrder: number | null;
  visibleCategories: VisibleCategories;
};

export type LitterListItemDto = {
  litterId: string;
  breedCode2: string;
  breedName: string;
  serial7: string;
  bornEpoch: number;
  ageHours: number;
  pupCount: number;
  survivedCount: number;
  neonatalLossCount: number;
  maleCount: number;
  femaleCount: number;
  createdAt: string;
  bredByKennelName: string | null;
  sire: LitterParentDto;
  dam: LitterParentDto;
  puppiesPreview: LitterPuppyPreviewDto[];
};

export type LitterDetailDto = LitterListItemDto & {
  bredByKennel: {
    kennelId: string;
    name: string;
    slug: string;
  } | null;
  breedingAttempt: {
    attemptId: string;
    status: string;
    createdEpoch: number;
    pregCheckEpoch: number | null;
    dueEpoch: number | null;
    checkedEpoch: number | null;
    whelpedEpoch: number | null;
  } | null;
  puppies: LitterPuppyDto[];
};

function mapParent(dog: ParentDogInput): LitterParentDto {
  return {
    dogId: dog.id,
    displayName: formatDogDisplayName(dog),
    regNumber: dog.regNumber,
    sex: dog.sex,
  };
}

function mapPuppy(dog: PuppyDogInput, currentEpoch: number): LitterPuppyDto {
  const isNeonatalLoss = dog.visibilityState === "HIDDEN_NEONATAL_LOSS";

  return {
    ...mapParent(dog),
    ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
    deathEpoch: dog.deathEpoch,
    lifecycleState: dog.lifecycleState,
    visibilityState: dog.visibilityState,
    isPlayerVisible: dog.isPlayerVisible,
    isNeonatalLoss,
    marketState: dog.marketState,
    litterOrder: dog.litterOrder,
    visibleCategories: deriveCurrentVisibleCategoriesForDogDisplay({
      storedTraits: dog,
      phenotypeHealthTruths: dog.healthConditionTruths,
      phenotypeHealthResults: dog.healthTests,
    }),
  };
}

function mapPuppyPreview(dog: LitterListPuppyPreviewInput): LitterPuppyPreviewDto {
  return {
    ...mapParent(dog),
    litterOrder: dog.litterOrder,
  };
}

export function mapLitterListItem(
  litter: LitterListInput,
  currentEpoch: number
): LitterListItemDto {
  const visiblePuppies = litter.puppies.filter(
    (puppy) => puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"
  );
  const neonatalLossCount = litter.puppies.length - visiblePuppies.length;

  return {
    litterId: litter.id,
    breedCode2: litter.breedCode2,
    breedName: litter.breed.name,
    serial7: litter.serial7,
    bornEpoch: litter.bornEpoch,
    ageHours: Math.max(0, currentEpoch - litter.bornEpoch),
    pupCount: litter.pupCount,
    survivedCount: visiblePuppies.length,
    neonatalLossCount,
    maleCount: litter.puppies.filter((puppy) => puppy.sex === "M").length,
    femaleCount: litter.puppies.filter((puppy) => puppy.sex === "F").length,
    createdAt: litter.createdAt.toISOString(),
    bredByKennelName: litter.bredByKennel?.name ?? null,
    sire: mapParent(litter.sire),
    dam: mapParent(litter.dam),
    puppiesPreview: visiblePuppies.slice(0, 4).map(mapPuppyPreview),
  };
}

export function mapLitterDetail(
  litter: LitterDetailInput,
  currentEpoch: number
): LitterDetailDto {
  const listItem = mapLitterListItem(litter, currentEpoch);

  return {
    ...listItem,
    bredByKennel: litter.bredByKennel
      ? {
          kennelId: litter.bredByKennel.id,
          name: litter.bredByKennel.name,
          slug: litter.bredByKennel.slug,
        }
      : null,
    breedingAttempt: litter.breedingAttempt
      ? {
          attemptId: litter.breedingAttempt.id,
          status: litter.breedingAttempt.status,
          createdEpoch: litter.breedingAttempt.createdEpoch,
          pregCheckEpoch: litter.breedingAttempt.pregCheckEpoch,
          dueEpoch: litter.breedingAttempt.dueEpoch,
          checkedEpoch: litter.breedingAttempt.checkedEpoch,
          whelpedEpoch: litter.breedingAttempt.whelpedEpoch,
        }
      : null,
    puppies: litter.puppies.map((puppy) => mapPuppy(puppy, currentEpoch)),
  };
}
