import { deriveVisibleCategoriesFromTraits } from "@showring/rules";
import { formatDogDisplayName } from "@/lib/dogNames";

type ParentDogInput = {
  id: string;
  callName: string | null;
  registeredName?: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
  sex: "M" | "F";
};

type PuppyDogInput = ParentDogInput & {
  birthEpoch: number;
  lifecycleState: string;
  marketState: string;
  litterOrder: number | null;
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
};

type LitterInput = {
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

export type LitterPuppyDto = LitterParentDto & {
  ageHours: number;
  lifecycleState: string;
  marketState: string;
  litterOrder: number | null;
  visibleCategories: ReturnType<typeof deriveVisibleCategoriesFromTraits>;
};

export type LitterListItemDto = {
  litterId: string;
  breedCode2: string;
  breedName: string;
  serial7: string;
  bornEpoch: number;
  ageHours: number;
  pupCount: number;
  maleCount: number;
  femaleCount: number;
  createdAt: string;
  bredByKennelName: string | null;
  sire: LitterParentDto;
  dam: LitterParentDto;
  puppiesPreview: LitterPuppyDto[];
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
  return {
    ...mapParent(dog),
    ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
    lifecycleState: dog.lifecycleState,
    marketState: dog.marketState,
    litterOrder: dog.litterOrder,
    visibleCategories: deriveVisibleCategoriesFromTraits({
      head: dog.traitHead,
      forequarters: dog.traitForequarters,
      hindquarters: dog.traitHindquarters,
      gait: dog.traitGait,
      coat: dog.traitCoat,
      size: dog.traitSize,
      temperament: dog.traitTemperament,
      show_shine: dog.traitShowShine,
      feet: dog.traitFeet,
      topline: dog.traitTopline,
    }),
  };
}

export function mapLitterListItem(
  litter: LitterInput,
  currentEpoch: number
): LitterListItemDto {
  const puppies = litter.puppies.map((puppy) => mapPuppy(puppy, currentEpoch));

  return {
    litterId: litter.id,
    breedCode2: litter.breedCode2,
    breedName: litter.breed.name,
    serial7: litter.serial7,
    bornEpoch: litter.bornEpoch,
    ageHours: Math.max(0, currentEpoch - litter.bornEpoch),
    pupCount: litter.pupCount,
    maleCount: puppies.filter((puppy) => puppy.sex === "M").length,
    femaleCount: puppies.filter((puppy) => puppy.sex === "F").length,
    createdAt: litter.createdAt.toISOString(),
    bredByKennelName: litter.bredByKennel?.name ?? null,
    sire: mapParent(litter.sire),
    dam: mapParent(litter.dam),
    puppiesPreview: puppies.slice(0, 4),
  };
}

export function mapLitterDetail(
  litter: LitterInput,
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
