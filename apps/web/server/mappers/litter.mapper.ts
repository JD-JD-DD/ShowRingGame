import type { VisibleCategories } from "@showring/rules";
import type { PersistedDogTraitRecord } from "@/server/services/phenotypePersistence.service";
import { formatDogDisplayName } from "@/lib/dogNames";
import { deriveCurrentVisibleCategoriesForDogDisplay } from "@/server/services/dogVisibleCategories.service";
import { getDogSaleEligibility } from "@/server/services/market.service";
import { getDogRehomeEligibility } from "@/server/services/rehome.service";

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
  visibilityState?: string;
  litterOrder: number | null;
};

type PuppyDogInput = PersistedDogTraitRecord & Omit<LitterListPuppyPreviewInput, "visibilityState"> & {
  litterId: string | null;
  visibilityState: string;
  birthEpoch: number;
  deathEpoch: number | null;
  lifecycleState: string;
  isPlayerVisible: boolean;
  marketState: string;
  ownerKennel: {
    id: string;
    name: string;
  } | null;
  breederKennel: {
    id: string;
    name: string;
  } | null;
  kennelRun: {
    id: string;
    name: string;
  } | null;
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
  customName: string | null;
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
  puppySummary?: LitterPuppySummary;
};

export type LitterPuppySummary = {
  survivedCount: number;
  neonatalLossCount: number;
  maleCount: number;
  femaleCount: number;
};

type LitterDetailInput = {
  id: string;
  breedCode2: string;
  serial7: string;
  customName: string | null;
  breederNote: string | null;
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
  litterId: string | null;
  callName: string | null;
  registeredName: string | null;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  ageHours: number;
  deathEpoch: number | null;
  lifecycleState: string;
  visibilityState: string;
  isPlayerVisible: boolean;
  isNeonatalLoss: boolean;
  marketState: string;
  currentOwnerKennel: {
    kennelId: string;
    name: string;
  } | null;
  breederKennel: {
    kennelId: string;
    name: string;
  } | null;
  kennelRun: {
    runId: string;
    name: string;
  } | null;
  isManageableByBreeder: boolean;
  actionEligibility: {
    canName: boolean;
    nameDisabledReason: string | null;
    canAssignRegisteredName: boolean;
    canMoveRun: boolean;
    moveRunDisabledReason: string | null;
    canListForSale: boolean;
    saleDisabledReason: string | null;
    canRehome: boolean;
    rehomeDisabledReason: string | null;
  };
  litterOrder: number | null;
  visibleCategories: VisibleCategories;
};

export type LitterListItemDto = {
  litterId: string;
  breedCode2: string;
  breedName: string;
  serial7: string;
  customName: string | null;
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
  breederNote: string | null;
  isBreederView: boolean;
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

async function mapPuppy(
  dog: PuppyDogInput,
  currentEpoch: number,
  isBreederView: boolean,
  viewerKennelId: string,
  litterId: string
): Promise<LitterPuppyDto> {
  const isNeonatalLoss = dog.visibilityState === "HIDDEN_NEONATAL_LOSS";
  const isManageableByBreeder = !isNeonatalLoss && isBreederView && dog.ownerKennel?.id === viewerKennelId && dog.lifecycleState === "ALIVE";
  const hasLitterManagementAuthority = isManageableByBreeder && dog.litterId === litterId;
  const unavailableReason = dog.ownerKennel?.id !== viewerKennelId ? "This puppy is no longer owned by your kennel." : "This puppy is no longer available for kennel management.";
  const saleEligibility = hasLitterManagementAuthority
    ? await getDogSaleEligibility({ dogId: dog.id, sellerKennelId: viewerKennelId, currentEpoch })
    : null;
  const rehomeEligibility = hasLitterManagementAuthority
    ? await getDogRehomeEligibility({ dogId: dog.id, kennelId: viewerKennelId, currentEpoch })
    : null;

  return {
    ...mapParent(dog),
    litterId: dog.litterId,
    callName: dog.callName,
    registeredName: dog.registeredName ?? null,
    visibleTitlePrefix: dog.visibleTitlePrefix ?? null,
    visibleTitleSuffix: dog.visibleTitleSuffix ?? null,
    ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
    deathEpoch: dog.deathEpoch,
    lifecycleState: dog.lifecycleState,
    visibilityState: dog.visibilityState,
    isPlayerVisible: dog.isPlayerVisible,
    isNeonatalLoss,
    marketState: dog.marketState,
    currentOwnerKennel: dog.ownerKennel
      ? { kennelId: dog.ownerKennel.id, name: dog.ownerKennel.name }
      : null,
    breederKennel: dog.breederKennel
      ? { kennelId: dog.breederKennel.id, name: dog.breederKennel.name }
      : null,
    kennelRun: dog.kennelRun
      ? { runId: dog.kennelRun.id, name: dog.kennelRun.name }
      : null,
    isManageableByBreeder,
    actionEligibility: {
      canName: hasLitterManagementAuthority,
      nameDisabledReason: hasLitterManagementAuthority ? null : unavailableReason,
      canAssignRegisteredName: hasLitterManagementAuthority && !dog.registeredName?.trim(),
      canMoveRun: hasLitterManagementAuthority,
      moveRunDisabledReason: hasLitterManagementAuthority ? null : unavailableReason,
      canListForSale: saleEligibility?.eligible ?? false,
      saleDisabledReason: saleEligibility ? saleEligibility.reasonMessage : unavailableReason,
      canRehome: rehomeEligibility?.eligible ?? false,
      rehomeDisabledReason: rehomeEligibility ? rehomeEligibility.reason : unavailableReason,
    },
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
  const puppySummary = litter.puppySummary ?? {
    survivedCount: litter.puppies.filter(
      (puppy) => puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"
    ).length,
    neonatalLossCount: litter.puppies.filter(
      (puppy) => puppy.visibilityState === "HIDDEN_NEONATAL_LOSS"
    ).length,
    maleCount: litter.puppies.filter((puppy) => puppy.sex === "M").length,
    femaleCount: litter.puppies.filter((puppy) => puppy.sex === "F").length,
  };
  const previewPuppies = litter.puppySummary
    ? litter.puppies
    : litter.puppies.filter(
        (puppy) => puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"
      );

  return {
    litterId: litter.id,
    breedCode2: litter.breedCode2,
    breedName: litter.breed.name,
    serial7: litter.serial7,
    customName: litter.customName,
    bornEpoch: litter.bornEpoch,
    ageHours: Math.max(0, currentEpoch - litter.bornEpoch),
    pupCount: litter.pupCount,
    survivedCount: puppySummary.survivedCount,
    neonatalLossCount: puppySummary.neonatalLossCount,
    maleCount: puppySummary.maleCount,
    femaleCount: puppySummary.femaleCount,
    createdAt: litter.createdAt.toISOString(),
    bredByKennelName: litter.bredByKennel?.name ?? null,
    sire: mapParent(litter.sire),
    dam: mapParent(litter.dam),
    puppiesPreview: previewPuppies.slice(0, 4).map(mapPuppyPreview),
  };
}

export async function mapLitterDetail(
  litter: LitterDetailInput,
  currentEpoch: number,
  viewerKennelId: string
): LitterDetailDto {
  const listItem = mapLitterListItem(litter, currentEpoch);
  const isBreederView = litter.bredByKennel?.id === viewerKennelId;

  return {
    ...listItem,
    breederNote: litter.breederNote,
    isBreederView,
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
    puppies: await Promise.all(litter.puppies.map((puppy) =>
      mapPuppy(puppy, currentEpoch, isBreederView, viewerKennelId, litter.id)
    )),
  };
}
