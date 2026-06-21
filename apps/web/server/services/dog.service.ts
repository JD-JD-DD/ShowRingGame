import { db } from "@/lib/db";
import {
  getPhenotypeHealthBadgeStatus,
  getPhenotypeHealthSeverity,
  hasAllGreenPhenotypeHealthTests,
} from "@/lib/dogHealth";
import { formatDogDisplayName } from "@/lib/dogNames";
import {
  mapDogProfile,
  type DogProfileBadgeDto,
  type DogProfileDto,
  type DogProfilePedigreeDogDto,
  type DogProfileVisibleCategoryDto,
} from "@/server/mappers/dog.mapper";
import {
  getKennelGroomingSummary,
  getOwnedDogGroomingStatuses,
} from "@/server/services/grooming.service";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import { getStoredProducerMeritForDog } from "@/server/services/producerMerit.service";
import type { Dog as EngineDog } from "@showring/rules";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  PUPPY_SALE_MIN_AGE_HOURS,
  deriveConditioningHandlingScore,
  deriveVisibleCategoriesFromTraits,
  getPhenotypeHealthResultLabel,
  type PhenotypeHealthTestCode,
} from "@showring/rules";
import { DogLifecycleState, DogMarketState, DogOriginType, Sex } from "@prisma/client";

function mapSex(sex: "M" | "F"): Sex {
  return sex === "M" ? Sex.M : Sex.F;
}

function mapLifecycleState(status: string): DogLifecycleState {
  switch (status) {
    case "ALIVE":
      return DogLifecycleState.ALIVE;
    case "DECEASED":
      return DogLifecycleState.DECEASED;
    case "SOLD":
      return DogLifecycleState.TRANSFERRED;
    case "TRANSFERRED":
      return DogLifecycleState.TRANSFERRED;
    case "RETIRED":
      return DogLifecycleState.RETIRED;
    default:
      throw new Error(`Unsupported dog lifecycle state: ${status}`);
  }
}

function mapOriginType(isFoundation?: boolean): DogOriginType {
  return isFoundation ? DogOriginType.FOUNDATION : DogOriginType.PLAYER_BRED;
}

async function ensureBreedExists(breedCode2: string): Promise<void> {
  const breed = await db.breed.findUnique({
    where: { code2: breedCode2 },
    select: { code2: true },
  });

  if (!breed) {
    throw new Error(`Breed not found for code2: ${breedCode2}`);
  }
}

export async function saveEngineDog(args: {
  dog: EngineDog;
  ownerKennelId?: string;
  breederKennelId?: string;
  isFoundation?: boolean;
}) {
  const { dog, ownerKennelId, breederKennelId, isFoundation } = args;

  await ensureBreedExists(dog.breedCode2);

  return db.dog.create({
    data: {
      id: dog.dogId,
      regNumber: dog.regNumber,
      callName: null,
      registeredName: null,
      breedCode2: dog.breedCode2,
      ownerKennelId: ownerKennelId ?? null,
      breederKennelId: breederKennelId ?? null,
      sireId: dog.sireId ?? null,
      damId: dog.damId ?? null,
      litterId: dog.litterId ?? null,
      litterOrder: dog.litterOrder ?? null,
      sex: mapSex(dog.sex),
      birthEpoch: dog.birthEpoch,
      lifecycleState: mapLifecycleState(dog.status),
      marketState: DogMarketState.NOT_FOR_SALE,
      originType: mapOriginType(isFoundation),
      isFoundation: isFoundation ?? false,

      traitHead: dog.traits.head,
      traitForequarters: dog.traits.forequarters,
      traitHindquarters: dog.traits.hindquarters,
      traitGait: dog.traits.gait,
      traitCoat: dog.traits.coat,
      traitSize: dog.traits.size,
      traitTemperament: dog.traits.temperament,
      traitShowShine: dog.traits.show_shine,
      traitFeet: dog.traits.feet,
      traitTopline: dog.traits.topline,
      
    },
  });
}

const VISIBLE_CATEGORY_DEFINITIONS = [
  { key: "typeExpression", label: "Type & Expression" },
  { key: "structureBalance", label: "Structure & Balance" },
  { key: "movement", label: "Movement" },
  { key: "coatPresentation", label: "Coat & Presentation" },
  {
    key: "temperamentRingBehavior",
    label: "Temperament & Ring Behavior",
  },
  { key: "conditioningHandling", label: "Conditioning & Handling" },
] as const;

function formatLifecycleLabel(lifecycleState: DogLifecycleState): string {
  switch (lifecycleState) {
    case DogLifecycleState.ALIVE:
      return "Alive";
    case DogLifecycleState.DECEASED:
      return "Deceased";
    case DogLifecycleState.TRANSFERRED:
      return "Transferred";
    case DogLifecycleState.RETIRED:
      return "Retired";
  }
}

function formatMarketLabel(args: {
  marketState: DogMarketState;
  isListedForSale: boolean;
  isListedAtStud: boolean;
}): string {
  if (args.isListedForSale) return "For sale";
  if (args.isListedAtStud) return "At stud";

  switch (args.marketState) {
    case DogMarketState.SOLD_PENDING_TRANSFER:
      return "Sale pending";
    case DogMarketState.LISTED_PLAYER:
    case DogMarketState.LISTED_NPC:
      return "For sale";
    case DogMarketState.NOT_FOR_SALE:
      return "Not listed";
  }
}

function formatOriginLabel(args: {
  isFoundation: boolean;
  breederKennelName: string | null;
}): string {
  if (args.isFoundation) return "Foundation Dog";
  if (args.breederKennelName) return `Bred by ${args.breederKennelName}`;
  return "Breeder unknown";
}

function formatSexLabel(sex: Sex): string {
  return sex === Sex.M ? "Male" : "Female";
}

function formatAgeLabel(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years < 1) {
    return `${weeks}w`;
  }

  const remainingWeeks = weeks % 52;
  return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
}

function formatEligibilityLabel(isEligible: boolean): string {
  return isEligible ? "Eligible" : "Not eligible";
}

function formatHealthStatusLabel(
  status: "green" | "yellow" | "red"
): string {
  return `Health ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function mapPedigreeDog(
  dog: {
    id: string;
    callName: string | null;
    registeredName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
    sex: "M" | "F";
  } | null
): DogProfilePedigreeDogDto | null {
  if (!dog) return null;

  return {
    dogId: dog.id,
    displayName: formatDogDisplayName(dog),
    regNumber: dog.regNumber,
    sex: dog.sex,
  };
}

function buildVisibleCategories(scores: {
  typeExpression: number;
  structureBalance: number;
  movement: number;
  coatPresentation: number;
  temperamentRingBehavior: number;
  conditioningHandling: number;
}): DogProfileVisibleCategoryDto[] {
  return VISIBLE_CATEGORY_DEFINITIONS.map(({ key, label }) => ({
    key,
    label,
    score: scores[key],
    min: 0,
    ideal: 10,
    max: 20,
    leftLabel: "Under ideal",
    centerLabel: "Ideal",
    rightLabel: "Over ideal",
  }));
}

export async function getDogProfile(args: {
  dogId: string;
  viewerKennelId: string | null;
  currentEpoch: number;
}): Promise<DogProfileDto | null> {
  const { dogId, viewerKennelId, currentEpoch } = args;

  await resolveDogDeaths({ currentEpoch, dogIds: [dogId] });

  const dog = await db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      marketState: true,
      isFoundation: true,
      isPlayerVisible: true,
      ownerKennelId: true,
      coiPercent: true,
      coiGenerationDepth: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      ringObedience: true,
      muscleTone: true,
      coatCondition: true,
      fatiguePoints: true,
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
      breed: {
        select: { name: true },
      },
      ownerKennel: {
        select: { id: true, name: true, slug: true },
      },
      breederKennel: {
        select: { id: true, name: true, slug: true },
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
      titleProgress: {
        select: {
          currentTitleCode: true,
          championshipPoints: true,
          majorCount: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
          testTypeCode: { in: [...PHENOTYPE_HEALTH_TEST_CODES] },
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          testTypeCode: true,
          resultCode: true,
          testedAtEpoch: true,
        },
      },
      showResults: {
        select: { pointsAwarded: true },
      },
      breedingAttemptsAsDam: {
        where: { status: { in: ["INITIATED", "PREGNANT"] } },
        select: { id: true },
      },
      listings: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          listingType: true,
          sellerKennelId: true,
        },
      },
      _count: {
        select: { sireOf: true, damOf: true },
      },
    },
  });

  if (!dog?.isPlayerVisible) {
    return null;
  }

  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
  const isAlive = dog.lifecycleState === DogLifecycleState.ALIVE;
  const isOwnedByCurrentKennel =
    viewerKennelId !== null && dog.ownerKennelId === viewerKennelId;
  const activeSaleListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
    ) ?? null;
  const activeStudListing =
    dog.listings.find(
      (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
    ) ?? null;
  const hasActiveListing = dog.listings.length > 0;
  const showEligible =
    isAlive && ageHours >= MIN_SHOW_AGE_HOURS && ageHours <= MAX_SHOW_AGE_HOURS;
  const breedingEligible =
    isAlive &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    (dog.sex === Sex.M ||
      (ageHours <= DAM_MAX_BREED_AGE_HOURS &&
        dog.breedingAttemptsAsDam.length === 0));

  const ownerData = isOwnedByCurrentKennel
    ? await db.dog.findUnique({
        where: { id: dog.id },
        select: {
          privateKennelNotes: {
            where: { kennelId: viewerKennelId },
            select: { notes: true },
            take: 1,
          },
          plannerTags: {
            where: {
              kennelId: viewerKennelId,
              source: "PROGRAM_PLANNER",
              isVisibleOnDogPage: true,
            },
            orderBy: [{ updatedAt: "desc" }],
            select: {
              tagType: true,
              goalKey: true,
              note: true,
              updatedAt: true,
            },
          },
          showEntries: {
            where: {
              entryStatus: { in: ["ENTERED", "ABSENT"] },
              showDay: { scheduledEpoch: { gt: currentEpoch } },
            },
            orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
            select: {
              id: true,
              entryStatus: true,
              breed: { select: { name: true } },
              showDay: {
                select: {
                  dayIndex: true,
                  scheduledEpoch: true,
                  judge: {
                    select: { judgeCode: true, name: true },
                  },
                  cluster: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const [producerMerit, groomingSummary, groomingStatuses] = await Promise.all([
    getStoredProducerMeritForDog({ dogId: dog.id }),
    isOwnedByCurrentKennel
      ? getKennelGroomingSummary({
          kennelId: viewerKennelId,
          currentEpoch,
        })
      : Promise.resolve(null),
    isOwnedByCurrentKennel
      ? getOwnedDogGroomingStatuses({
          kennelId: viewerKennelId,
          dogIds: [dog.id],
          currentEpoch,
        })
      : Promise.resolve(null),
  ]);
  const groomingStatus = groomingStatuses?.get(dog.id) ?? null;
  const latestHealthTests = PHENOTYPE_HEALTH_TEST_CODES.flatMap(
    (testTypeCode) => {
      const latest = dog.healthTests.find(
        (test) => test.testTypeCode === testTypeCode
      );
      return latest ? [latest] : [];
    }
  );
  const healthBadgeStatus = getPhenotypeHealthBadgeStatus(latestHealthTests);
  const hasFullClearance = hasAllGreenPhenotypeHealthTests(latestHealthTests);
  const originLabel = formatOriginLabel({
    isFoundation: dog.isFoundation,
    breederKennelName: dog.breederKennel?.name ?? null,
  });
  const healthSummary = {
    completedCount: latestHealthTests.length,
    totalCount: PHENOTYPE_HEALTH_TEST_CODES.length,
    label: `${latestHealthTests.length}/${PHENOTYPE_HEALTH_TEST_CODES.length} tested`,
    badgeStatus: healthBadgeStatus,
    hasFullClearance,
  };
  const visibleScores = {
    ...deriveVisibleCategoriesFromTraits({
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
    conditioningHandling: deriveConditioningHandlingScore({
      coatCondition: dog.coatCondition,
      muscleTone: dog.muscleTone,
      ringObedience: dog.ringObedience,
      fatiguePoints: dog.fatiguePoints,
    }),
  };
  const badges: DogProfileBadgeDto[] = [];

  if (healthBadgeStatus) {
    badges.push({
      code: `health-${healthBadgeStatus}`,
      label: formatHealthStatusLabel(healthBadgeStatus),
      tone: healthBadgeStatus,
    });
  }
  if (hasFullClearance) {
    badges.push({ code: "health-clear", label: "Health Clear", tone: "green" });
  }
  if (dog.isFoundation) {
    badges.push({ code: "foundation", label: "Foundation Dog", tone: "purple" });
  }
  if (activeSaleListing) {
    badges.push({ code: "for-sale", label: "Listed for Sale", tone: "green" });
  }
  if (activeStudListing) {
    badges.push({ code: "at-stud", label: "At Stud", tone: "blue" });
  }

  const canOfferForSale =
    isOwnedByCurrentKennel &&
    isAlive &&
    ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
    dog.marketState === DogMarketState.NOT_FOR_SALE &&
    !hasActiveListing;
  const canOfferAtStud =
    isOwnedByCurrentKennel &&
    isAlive &&
    dog.sex === Sex.M &&
    ageHours >= MIN_BREED_AGE_HOURS &&
    dog.marketState === DogMarketState.NOT_FOR_SALE &&
    !hasActiveListing;
  const canPullEntries = Boolean(
    ownerData?.showEntries.some((entry) => entry.entryStatus === "ENTERED")
  );
  const producerRecord = producerMerit ?? {
    championOffspringCount: 0,
    producerMeritLabel: null,
    producerMeritSuffix: null,
    producerMeritLevel: "NONE",
    nextMeritLabel: dog.sex === Sex.M ? "Sire of Merit" : "Dam of Merit",
    nextMeritThreshold: dog.sex === Sex.M ? 10 : 5,
  };

  if (producerRecord.producerMeritLabel) {
    badges.push({
      code: "producer-merit",
      label: producerRecord.producerMeritLabel,
      tone: "purple",
    });
  }

  return mapDogProfile({
    header: {
      dogId: dog.id,
      displayName: formatDogDisplayName(dog),
      registeredName: dog.registeredName,
      callName: dog.callName,
      visibleTitlePrefix: dog.visibleTitlePrefix,
      visibleTitleSuffix: dog.visibleTitleSuffix,
      breedName: dog.breed.name,
      regNumber: dog.regNumber,
      sexLabel: formatSexLabel(dog.sex),
      ageHours,
      ageLabel: formatAgeLabel(ageHours),
      lifecycleLabel: formatLifecycleLabel(dog.lifecycleState),
      originLabel,
      badges,
    },
    snapshot: {
      owner: dog.ownerKennel
        ? {
            kennelId: dog.ownerKennel.id,
            name: dog.ownerKennel.name,
            slug: dog.ownerKennel.slug,
          }
        : null,
      breeder: !dog.isFoundation && dog.breederKennel
        ? {
            kennelId: dog.breederKennel.id,
            name: dog.breederKennel.name,
            slug: dog.breederKennel.slug,
          }
        : null,
      originLabel,
      marketLabel: formatMarketLabel({
        marketState: dog.marketState,
        isListedForSale: Boolean(activeSaleListing),
        isListedAtStud: Boolean(activeStudListing),
      }),
      showEligibilityLabel: formatEligibilityLabel(showEligible),
      breedingEligibilityLabel: formatEligibilityLabel(breedingEligible),
      groomingLabel: groomingStatus?.groomingStatusLabel ?? null,
      healthTestingSummary: healthSummary,
      coatConditionDisplay: dog.coatCondition.toFixed(2),
    },
    qualityAndPresentation: {
      visibleCategories: buildVisibleCategories(visibleScores),
    },
    titlesAndShowCareer: {
      currentTitleCode: dog.titleProgress?.currentTitleCode ?? null,
      championshipPoints: dog.titleProgress?.championshipPoints ?? 0,
      majorCount: dog.titleProgress?.majorCount ?? 0,
      resultCount: dog.showResults.length,
      totalPoints: dog.showResults.reduce(
        (total, result) => total + result.pointsAwarded,
        0
      ),
    },
    healthTesting: {
      summary: healthSummary,
      tests: PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => {
        const definition = PHENOTYPE_HEALTH_TESTS[testTypeCode];
        const result = latestHealthTests.find(
          (test) => test.testTypeCode === testTypeCode
        );

        return {
          testTypeCode,
          label: definition.label,
          resultLabel: result
            ? getPhenotypeHealthResultLabel(
                testTypeCode as PhenotypeHealthTestCode,
                result.resultCode
              )
            : null,
          severity: result
            ? getPhenotypeHealthSeverity(testTypeCode, result.resultCode)
            : null,
          testedAtEpoch: result?.testedAtEpoch ?? null,
          isComplete: Boolean(result),
          isAvailable: ageHours >= definition.minimumAgeHours,
          availabilityLabel: definition.minimumAgeLabel,
          fee: definition.fee,
        };
      }),
    },
    breedingAndProduction: {
      championOffspringCount: producerRecord.championOffspringCount,
      producerMeritLabel: producerRecord.producerMeritLabel,
      producerMeritSuffix: producerRecord.producerMeritSuffix,
      producerMeritLevel: producerRecord.producerMeritLevel,
      nextMeritLabel: producerRecord.nextMeritLabel,
      nextMeritThreshold: producerRecord.nextMeritThreshold,
      progenyCount: dog.sex === Sex.M ? dog._count.sireOf : dog._count.damOf,
    },
    pedigree: {
      coiPercent: dog.coiPercent,
      generationDepth: dog.coiGenerationDepth,
      sire: mapPedigreeDog(dog.sire),
      dam: mapPedigreeDog(dog.dam),
      ancestors: [],
    },
    entries: {
      isOwnerOnly: true,
      upcoming:
        ownerData?.showEntries.map((entry) => ({
          entryId: entry.id,
          entryStatus: entry.entryStatus,
          showId: entry.showDay.cluster.id,
          showName: entry.showDay.cluster.name,
          showDayIndex: entry.showDay.dayIndex,
          scheduledEpoch: entry.showDay.scheduledEpoch,
          breedName: entry.breed.name,
          judgeCode: entry.showDay.judge?.judgeCode ?? null,
          judgeName: entry.showDay.judge?.name ?? null,
          canPull: entry.entryStatus === "ENTERED",
        })) ?? [],
    },
    privatePlanning: isOwnedByCurrentKennel
      ? {
          notes: ownerData?.privateKennelNotes[0]?.notes ?? null,
          plannerTags:
            ownerData?.plannerTags.map((tag) => ({
              tagType: tag.tagType,
              goalKey: tag.goalKey,
              note: tag.note,
              updatedAt: tag.updatedAt.toISOString(),
            })) ?? [],
        }
      : null,
    actions: {
      canBreed: isOwnedByCurrentKennel && breedingEligible,
      canGroom:
        isOwnedByCurrentKennel &&
        isAlive &&
        Boolean(groomingStatus) &&
        !groomingStatus?.groomedThisWeek &&
        !groomingStatus?.openListingId &&
        (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) > 0,
      canOfferForSale,
      canEditSaleListing:
        isOwnedByCurrentKennel &&
        activeSaleListing?.sellerKennelId === viewerKennelId,
      canCancelSaleListing:
        isOwnedByCurrentKennel &&
        activeSaleListing?.sellerKennelId === viewerKennelId,
      canOfferAtStud,
      canEditStudFee:
        isOwnedByCurrentKennel &&
        activeStudListing?.sellerKennelId === viewerKennelId,
      canCancelStudListing:
        isOwnedByCurrentKennel &&
        activeStudListing?.sellerKennelId === viewerKennelId,
      canRehome:
        isOwnedByCurrentKennel &&
        isAlive &&
        ageHours >= PUPPY_SALE_MIN_AGE_HOURS,
      canPullEntries,
    },
    viewerContext: {
      isAuthenticated: true,
      viewerKennelId,
      isOwnedByCurrentKennel,
      canManage: isOwnedByCurrentKennel,
      canViewPrivatePlanning: isOwnedByCurrentKennel,
    },
  });
}

