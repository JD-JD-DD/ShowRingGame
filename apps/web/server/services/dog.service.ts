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
  type DogProfilePointWinDto,
  type DogProfileShowResultDto,
  type DogProfileVisibleCategoryDto,
} from "@/server/mappers/dog.mapper";
import { epochToDate } from "@/lib/gameClock";
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
  deriveHealthAdjustedExpressedTraits,
  deriveVisibleCategoriesFromTraits,
  getPuppyRehomePayoutForAgeHours,
  getPhenotypeHealthResultLabel,
  getShowDistrictRegionName,
  type PhenotypeHealthTestCode,
} from "@showring/rules";
import { DogLifecycleState, DogMarketState, DogOriginType, Sex } from "@prisma/client";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const RECENT_SHOW_RESULT_LIMIT = 6;
const INVITATIONAL_PLACEMENT_CODES = ["BIS", "RBIS", "G1", "G2", "G3", "G4"];

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

function formatTestedDateLabel(testedAtEpoch: number | null): string | null {
  if (testedAtEpoch === null) return null;

  return `Tested ${epochToDate(testedAtEpoch).toISOString().slice(0, 10)}`;
}

function getHealthImpactStatement(args: {
  testCode: PhenotypeHealthTestCode;
  severityKey: "green" | "yellow" | "red";
}): string | null {
  if (
    args.testCode !== "HIP_DYSPLASIA" &&
    args.testCode !== "ELBOW_DYSPLASIA" &&
    args.testCode !== "THYROID" &&
    args.testCode !== "CARDIAC" &&
    args.testCode !== "CAER_EYE"
  ) {
    return null;
  }

  if (args.testCode === "HIP_DYSPLASIA" && args.severityKey === "yellow") {
    return "Hip result is mildly affecting rear movement and structure.";
  }

  if (args.testCode === "HIP_DYSPLASIA" && args.severityKey === "red") {
    return "Red hips are limiting rear movement and affecting this dog’s Movement and Structure & Balance.";
  }

  if (args.testCode === "ELBOW_DYSPLASIA" && args.severityKey === "yellow") {
    return "Elbow result is mildly affecting front assembly and movement.";
  }

  if (args.testCode === "ELBOW_DYSPLASIA" && args.severityKey === "red") {
    return "Red elbows are limiting front assembly and affecting this dog’s Movement and Structure & Balance.";
  }

  if (args.testCode === "THYROID" && args.severityKey === "yellow") {
    return "Thyroid result is reducing coat improvement from grooming.";
  }

  if (args.testCode === "THYROID" && args.severityKey === "red") {
    return "Red thyroid is severely limiting coat condition improvement. Grooming has reduced effect on this dog.";
  }

  if (args.testCode === "CARDIAC" && args.severityKey === "yellow") {
    return "Cardiac result may modestly affect this dog’s expected longevity.";
  }

  if (args.testCode === "CARDIAC" && args.severityKey === "red") {
    return "Red cardiac result may significantly shorten this dog’s expected lifespan.";
  }

  if (args.testCode === "CAER_EYE" && args.severityKey === "yellow") {
    return "CAER result is mildly affecting this dog’s ring confidence.";
  }

  if (args.testCode === "CAER_EYE" && args.severityKey === "red") {
    return "Red CAER result is affecting this dog’s visual comfort, expression, and ring confidence.";
  }

  return null;
}

function formatGameDateLabel(epoch: number): string {
  return epochToDate(epoch).toISOString().slice(0, 10);
}

function formatBreedingAttemptStatus(status: string): string {
  switch (status) {
    case "INITIATED":
      return "Pending pregnancy confirmation";
    case "CHECKED_NOT_PREGNANT":
      return "Did not take";
    case "PREGNANT":
      return "Pregnant";
    case "WHELPED":
      return "Litter born";
    case "FAILED":
      return "Unsuccessful";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Status unavailable";
  }
}

function formatOffspringTitleSummary(dog: {
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  titleProgress: { currentTitleCode: string | null } | null;
}): string | null {
  const titleParts = [
    dog.visibleTitlePrefix,
    dog.titleProgress?.currentTitleCode,
    dog.visibleTitleSuffix,
  ].filter((part): part is string => Boolean(part?.trim()));

  return titleParts.length > 0 ? [...new Set(titleParts)].join(" / ") : null;
}

function formatEntryStatusLabel(status: string): string {
  switch (status) {
    case "ENTERED":
      return "Entered";
    case "ABSENT":
      return "Absent";
    case "WITHDRAWN":
      return "Withdrawn";
    case "INELIGIBLE":
      return "Ineligible";
    case "JUDGED":
      return "Judged";
    default:
      return "Status unavailable";
  }
}

function formatPlannerTagLabel(tagType: string): string {
  switch (tagType) {
    case "KEEP":
      return "Keep";
    case "WATCH":
      return "Watch";
    case "SELL_CANDIDATE":
      return "Sell candidate";
    case "REHOME_CANDIDATE":
      return "Re-home candidate";
    case "NO_ACTION":
      return "No action";
    default:
      return "Planner tag";
  }
}

function formatGoalLabel(goalKey: string): string {
  return goalKey
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getRecentPointWins(value: unknown): DogProfilePointWinDto[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray(
      (value as { championshipPointWins?: unknown }).championshipPointWins
    )
  ) {
    return [];
  }

  return (value as { championshipPointWins: unknown[] }).championshipPointWins
    .filter(
      (win): win is DogProfilePointWinDto =>
        typeof win === "object" &&
        win !== null &&
        typeof (win as DogProfilePointWinDto).showDayId === "string" &&
        typeof (win as DogProfilePointWinDto).awardCode === "string" &&
        typeof (win as DogProfilePointWinDto).pointsAwarded === "number" &&
        typeof (win as DogProfilePointWinDto).isMajor === "boolean"
    )
    .slice(-RECENT_SHOW_RESULT_LIMIT)
    .reverse();
}

async function listPublishedDogShowResults(args: {
  dogId: string;
  take?: number;
}): Promise<DogProfileShowResultDto[]> {
  const results = await db.showResult.findMany({
    where: { dogId: args.dogId },
    orderBy: [{ publishedAtEpoch: "desc" }, { finalRank: "asc" }],
    ...(args.take ? { take: args.take } : {}),
    select: {
      id: true,
      pointsAwarded: true,
      isMajor: true,
      breed: {
        select: { code2: true },
      },
      judge: {
        select: { judgeCode: true, name: true },
      },
      showAwards: {
        orderBy: [{ rank: "asc" }, { awardCode: "asc" }],
        select: { awardCode: true },
      },
      showDay: {
        select: {
          dayIndex: true,
          scheduledEpoch: true,
          cluster: {
            select: {
              id: true,
              name: true,
              district: true,
            },
          },
        },
      },
    },
  });

  return results.map((result) => {
    const showId = result.showDay.cluster.id;
    const breedCode2 = result.breed.code2;

    return {
      resultId: result.id,
      showId,
      showUrl: `/shows/${showId}`,
      showName: result.showDay.cluster.name,
      scheduledEpoch: result.showDay.scheduledEpoch,
      showDateLabel: epochToDate(result.showDay.scheduledEpoch)
        .toISOString()
        .slice(0, 10),
      showDayNumber: result.showDay.dayIndex,
      districtRegion: getShowDistrictRegionName(
        result.showDay.cluster.district
      ),
      breedCode2,
      breedResultUrl: `/shows/${showId}/results/${breedCode2}`,
      judgeCode: result.judge.judgeCode,
      judgeName: result.judge.name,
      judgeProfileUrl: `/judges/${result.judge.judgeCode}`,
      awardCodes: result.showAwards.map((award) => award.awardCode),
      pointsAwarded: result.pointsAwarded,
      isMajor: result.isMajor,
    };
  });
}

export async function getDogShowRecord(args: {
  dogId: string;
}): Promise<DogProfileShowResultDto[] | null> {
  const dog = await db.dog.findFirst({
    where: {
      id: args.dogId,
      isPlayerVisible: true,
    },
    select: { id: true },
  });

  if (!dog) return null;

  return listPublishedDogShowResults({ dogId: dog.id });
}

async function loadFourGenerationPedigree(args: {
  sireId: string | null;
  damId: string | null;
}): Promise<DogProfilePedigreeDogDto[]> {
  type PendingAncestor = {
    dogId: string;
    relationshipParts: string[];
  };

  let pending: PendingAncestor[] = [
    ...(args.sireId
      ? [{ dogId: args.sireId, relationshipParts: ["Sire"] }]
      : []),
    ...(args.damId
      ? [{ dogId: args.damId, relationshipParts: ["Dam"] }]
      : []),
  ];
  const ancestors: DogProfilePedigreeDogDto[] = [];

  for (let generation = 1; generation <= 4 && pending.length > 0; generation += 1) {
    const rows = await db.dog.findMany({
      where: {
        id: { in: [...new Set(pending.map((item) => item.dogId))] },
        isPlayerVisible: true,
      },
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        sireId: true,
        damId: true,
        healthTests: {
          where: {
            isPublic: true,
            testTypeCode: { in: [...PHENOTYPE_HEALTH_TEST_CODES] },
          },
          orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
          select: { testTypeCode: true, resultCode: true },
        },
      },
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const next: PendingAncestor[] = [];

    for (const item of pending) {
      const dog = rowsById.get(item.dogId);
      if (!dog) continue;

      const latestHealthTests = PHENOTYPE_HEALTH_TEST_CODES.flatMap(
        (testCode) => {
          const result = dog.healthTests.find(
            (test) => test.testTypeCode === testCode
          );
          return result ? [result] : [];
        }
      );
      const detailedHealthResults =
        generation <= 2
          ? latestHealthTests.map((test) => ({
              testCode: test.testTypeCode,
              displayName:
                PHENOTYPE_HEALTH_TESTS[
                  test.testTypeCode as PhenotypeHealthTestCode
                ].label,
              resultLabel: getPhenotypeHealthResultLabel(
                test.testTypeCode as PhenotypeHealthTestCode,
                test.resultCode
              ),
              severityKey: getPhenotypeHealthSeverity(
                test.testTypeCode,
                test.resultCode
              ),
            }))
          : [];
      const healthSeverityCounts =
        generation >= 3
          ? latestHealthTests.reduce(
              (counts, test) => {
                const severity = getPhenotypeHealthSeverity(
                  test.testTypeCode,
                  test.resultCode
                );
                counts[severity] += 1;
                return counts;
              },
              { green: 0, yellow: 0, red: 0 }
            )
          : null;

      ancestors.push({
        dogId: dog.id,
        displayName: formatDogDisplayName(dog),
        relationship: item.relationshipParts.join("'s "),
        profileUrl: `/dogs/${dog.id}`,
        healthStatusMarkers: {
          badgeStatus: getPhenotypeHealthBadgeStatus(latestHealthTests),
          hasFullClearance:
            hasAllGreenPhenotypeHealthTests(latestHealthTests),
        },
        colorLabel: "Color: Pending",
        detailedHealthResults,
        healthSeverityCounts,
      });

      if (generation < 4) {
        if (dog.sireId) {
          next.push({
            dogId: dog.sireId,
            relationshipParts: [...item.relationshipParts, "Sire"],
          });
        }
        if (dog.damId) {
          next.push({
            dogId: dog.damId,
            relationshipParts: [...item.relationshipParts, "Dam"],
          });
        }
      }
    }

    pending = next;
  }

  return ancestors;
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
    numericScore: scores[key],
    min: 0,
    ideal: 10,
    max: 20,
    leftLabel: "Under ideal",
    centerLabel: "Ideal",
    rightLabel: "Over ideal",
    scaleMeaning:
      "Scores below 10 appear under ideal; scores above 10 appear over ideal.",
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
      sireId: true,
      damId: true,
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
        },
      },
      titleProgress: {
        select: {
          currentTitleCode: true,
          championshipPoints: true,
          majorCount: true,
          winsByTypeJson: true,
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
      healthConditionTruths: {
        where: {
          conditionCode: {
            in: ["HIP_DYSPLASIA", "ELBOW_DYSPLASIA", "CAER_EYE"],
          },
        },
        select: {
          conditionCode: true,
          geneticLiability: true,
          environmentModifier: true,
        },
      },
      showAwards: {
        where: {
          awardCode: { in: INVITATIONAL_PLACEMENT_CODES },
          showDay: {
            cluster: { id: { startsWith: "invitational-year-" } },
          },
        },
        orderBy: [{ publishedAtEpoch: "desc" }],
        select: {
          awardCode: true,
          showDay: {
            select: {
              cluster: { select: { id: true, year: true } },
            },
          },
        },
      },
      breedingAttemptsAsDam: {
        orderBy: [{ createdEpoch: "desc" }],
        select: {
          id: true,
          createdEpoch: true,
          whelpedEpoch: true,
          status: true,
          sire: {
            select: {
              id: true,
              callName: true,
              registeredName: true,
              regNumber: true,
              visibleTitlePrefix: true,
              visibleTitleSuffix: true,
            },
          },
          litter: {
            select: {
              id: true,
              pupCount: true,
              puppies: {
                select: { visibilityState: true },
              },
            },
          },
        },
      },
      breedingAttemptsAsSire: {
        orderBy: [{ createdEpoch: "desc" }],
        select: {
          id: true,
          createdEpoch: true,
          status: true,
          createdByKennel: {
            select: { name: true, slug: true },
          },
          dam: {
            select: {
              id: true,
              callName: true,
              registeredName: true,
              regNumber: true,
              visibleTitlePrefix: true,
              visibleTitleSuffix: true,
            },
          },
          litter: {
            select: { id: true },
          },
        },
      },
      listings: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          listingType: true,
          sellerKennelId: true,
          askingPrice: true,
          status: true,
        },
      },
      sireOf: {
        where: { isPlayerVisible: true },
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
          titleProgress: {
            select: { currentTitleCode: true },
          },
        },
      },
      damOf: {
        where: { isPlayerVisible: true },
        orderBy: [{ birthEpoch: "desc" }, { regNumber: "asc" }],
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          sex: true,
          titleProgress: {
            select: { currentTitleCode: true },
          },
        },
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
        !dog.breedingAttemptsAsDam.some((attempt) =>
          ["INITIATED", "PREGNANT"].includes(attempt.status)
        )));

  const ownerData = isOwnedByCurrentKennel
    ? await db.dog.findUnique({
        where: { id: dog.id },
        select: {
          ownerKennel: {
            select: { balance: true },
          },
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
                    select: { id: true, name: true, district: true },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const [
    producerMerit,
    groomingSummary,
    groomingStatuses,
    recentShowResults,
    pedigreeAncestors,
  ] = await Promise.all([
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
    listPublishedDogShowResults({
      dogId: dog.id,
      take: RECENT_SHOW_RESULT_LIMIT,
    }),
    loadFourGenerationPedigree({
      sireId: dog.sireId,
      damId: dog.damId,
    }),
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
  const healthTests = PHENOTYPE_HEALTH_TEST_CODES.map((testCode) => {
    const definition = PHENOTYPE_HEALTH_TESTS[testCode];
    const result = latestHealthTests.find(
      (test) => test.testTypeCode === testCode
    );
    const severityKey = result
      ? getPhenotypeHealthSeverity(testCode, result.resultCode)
      : null;

    return {
      testCode,
      displayName: definition.label,
      resultLabel: result
        ? getPhenotypeHealthResultLabel(
            testCode as PhenotypeHealthTestCode,
            result.resultCode
          )
        : null,
      severityKey,
      healthImpactStatement: severityKey
        ? getHealthImpactStatement({
            testCode,
            severityKey,
          })
        : null,
      testedDateLabel: result
        ? formatTestedDateLabel(result.testedAtEpoch)
        : null,
      isComplete: Boolean(result),
      minimumAgeLabel: definition.minimumAgeLabel,
      isCurrentlyAvailable: ageHours >= definition.minimumAgeHours,
      cost: definition.fee,
    };
  });
  const availableHealthTests = healthTests.filter(
    (test) => isAlive && !test.isComplete && test.isCurrentlyAvailable
  );
  const kennelBalance = ownerData?.ownerKennel?.balance ?? 0;
  const checkoutNeeded =
    isOwnedByCurrentKennel && availableHealthTests.length > 0;
  const storedTraits = {
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
  };
  const expressedTraits = deriveHealthAdjustedExpressedTraits({
    storedTraits,
    phenotypeHealthTruths: dog.healthConditionTruths,
    phenotypeHealthResults: dog.healthTests,
  });
  const visibleScores = {
    ...deriveVisibleCategoriesFromTraits(expressedTraits),
    conditioningHandling: deriveConditioningHandlingScore({
      coatCondition: dog.coatCondition,
      muscleTone: dog.muscleTone,
      ringObedience: dog.ringObedience,
      fatiguePoints: dog.fatiguePoints,
    }),
  };
  const badges: DogProfileBadgeDto[] = [];

  if (hasFullClearance) {
    badges.push({ code: "health-clear", label: "Health Clear", tone: "green" });
  }
  if (activeSaleListing) {
    badges.push({ code: "for-sale", label: "Listed for Sale", tone: "green" });
  }
  if (activeStudListing) {
    badges.push({ code: "at-stud", label: "At Stud", tone: "blue" });
  }
  if (dog.breedingAttemptsAsDam.some((attempt) => attempt.status === "PREGNANT")) {
    badges.push({ code: "pregnant", label: "Bred", tone: "yellow" });
  }
  for (const award of dog.showAwards) {
    badges.push({
      code: `invitational-${award.showDay.cluster.id}-${award.awardCode}`,
      label: `Year ${award.showDay.cluster.year} Invitational ${award.awardCode}`,
      tone: "yellow",
      href: `/shows/${award.showDay.cluster.id}/results`,
    });
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
  const canGroom =
    isOwnedByCurrentKennel &&
    isAlive &&
    Boolean(groomingStatus) &&
    !groomingStatus?.groomedThisWeek &&
    !groomingStatus?.openListingId &&
    (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) > 0;
  const canOfferOutsideGrooming = canGroom;
  const canCancelOutsideGrooming =
    isOwnedByCurrentKennel && Boolean(groomingStatus?.openListingId);
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
  const pointsEarned = dog.titleProgress?.championshipPoints ?? 0;
  const majorsEarned = dog.titleProgress?.majorCount ?? 0;
  const currentTitleCode = dog.titleProgress?.currentTitleCode ?? null;
  const isChampionFinished = currentTitleCode === "CH";
  const pointsRemaining = Math.max(
    0,
    CHAMPIONSHIP_POINTS_REQUIRED - pointsEarned
  );
  const majorsRemaining = Math.max(
    0,
    CHAMPIONSHIP_MAJORS_REQUIRED - majorsEarned
  );
  const sireHistory =
    dog.sex === Sex.M
      ? dog.breedingAttemptsAsSire.map((attempt) => ({
          attemptId: attempt.id,
          usingKennelName:
            attempt.createdByKennel?.name ?? "Kennel unavailable",
          usingKennelSlug: attempt.createdByKennel?.slug ?? null,
          dateUsedLabel: formatGameDateLabel(attempt.createdEpoch),
          damDogId: attempt.dam.id,
          damName: formatDogDisplayName(attempt.dam),
          damUrl: `/dogs/${attempt.dam.id}`,
          litterId: attempt.litter?.id ?? null,
          litterUrl: attempt.litter ? `/litters/${attempt.litter.id}` : null,
          attemptStatusLabel: formatBreedingAttemptStatus(attempt.status),
        }))
      : [];
  const damHistory =
    dog.sex === Sex.F
      ? dog.breedingAttemptsAsDam.map((attempt) => ({
          attemptId: attempt.id,
          sireDogId: attempt.sire.id,
          sireName: formatDogDisplayName(attempt.sire),
          sireUrl: `/dogs/${attempt.sire.id}`,
          litterId: attempt.litter?.id ?? null,
          litterUrl: attempt.litter ? `/litters/${attempt.litter.id}` : null,
          breedingDateLabel: formatGameDateLabel(attempt.createdEpoch),
          whelpedDateLabel:
            attempt.whelpedEpoch === null
              ? null
              : formatGameDateLabel(attempt.whelpedEpoch),
          puppyCount: attempt.litter?.pupCount ?? null,
          survivedCount: attempt.litter
            ? attempt.litter.puppies.filter(
                (puppy) => puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"
              ).length
            : null,
          attemptStatusLabel: formatBreedingAttemptStatus(attempt.status),
        }))
      : [];
  const progenyDogs = dog.sex === Sex.M ? dog.sireOf : dog.damOf;
  const progeny = progenyDogs.map((offspring) => ({
    dogId: offspring.id,
    displayName: formatDogDisplayName(offspring),
    dogUrl: `/dogs/${offspring.id}`,
    sexLabel: formatSexLabel(offspring.sex),
    titleSummary: formatOffspringTitleSummary(offspring),
  }));
  const highestMeritReached = producerRecord.nextMeritThreshold === null;
  const producerProgressLabel = highestMeritReached
    ? "Highest producer merit reached"
    : `${producerRecord.championOffspringCount} of ${producerRecord.nextMeritThreshold} champion offspring toward ${producerRecord.nextMeritLabel}`;
  const allEntries =
    ownerData?.showEntries.map((entry) => {
      const showId = entry.showDay.cluster.id;
      const canPullEntry = entry.entryStatus === "ENTERED";

      return {
        entryId: entry.id,
        showId,
        showUrl: `/shows/${showId}`,
        showName: entry.showDay.cluster.name,
        showDateLabel: formatGameDateLabel(entry.showDay.scheduledEpoch),
        showDayNumber: entry.showDay.dayIndex,
        scheduledEpoch: entry.showDay.scheduledEpoch,
        district: getShowDistrictRegionName(
          entry.showDay.cluster.district
        ),
        breedName: entry.breed.name,
        judgeCode: entry.showDay.judge?.judgeCode ?? null,
        judgeName: entry.showDay.judge?.name ?? null,
        judgeProfileUrl: entry.showDay.judge
          ? `/judges/${entry.showDay.judge.judgeCode}`
          : null,
        entryStatusLabel: formatEntryStatusLabel(entry.entryStatus),
        canPullEntry,
        pullEntryActionUrl: canPullEntry
          ? `/api/show-entries/${entry.id}/pull`
          : null,
      };
    }) ?? [];
  const programPlannerTags =
    ownerData?.plannerTags.map((tag) => ({
      tagTypeLabel: formatPlannerTagLabel(tag.tagType),
      goalLabel: formatGoalLabel(tag.goalKey),
      note: tag.note,
      updatedAt: tag.updatedAt.toISOString(),
    })) ?? [];
  const primaryPlannerTag = ownerData?.plannerTags[0] ?? null;

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
      sire: dog.sire
        ? {
            dogId: dog.sire.id,
            displayName: formatDogDisplayName(dog.sire),
            profileUrl: `/dogs/${dog.sire.id}`,
          }
        : null,
      dam: dog.dam
        ? {
            dogId: dog.dam.id,
            displayName: formatDogDisplayName(dog.dam),
            profileUrl: `/dogs/${dog.dam.id}`,
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
      currentTitleCode,
      isChampionFinished,
      pointsEarned,
      pointsRequired: CHAMPIONSHIP_POINTS_REQUIRED,
      majorsEarned,
      majorsRequired: CHAMPIONSHIP_MAJORS_REQUIRED,
      pointsRemaining,
      majorsRemaining,
      pointRequirementMet: pointsRemaining === 0,
      majorRequirementMet: majorsRemaining === 0,
      summaryLabel: isChampionFinished
        ? `Champion, finished with ${pointsEarned} points and ${majorsEarned} majors`
        : `Not yet champion — ${pointsEarned} points, ${majorsEarned} majors`,
      recentPointWins: getRecentPointWins(
        dog.titleProgress?.winsByTypeJson
      ),
      recentShowResults,
      fullShowRecordUrl: `/dogs/${dog.id}/show-record`,
    },
    healthTesting: {
      completedCount: healthSummary.completedCount,
      totalCount: healthSummary.totalCount,
      summaryLabel: healthSummary.label,
      tests: healthTests,
      ownerControls: isOwnedByCurrentKennel
        ? {
            canRunAnyTests:
              checkoutNeeded &&
              availableHealthTests.some((test) => test.cost <= kennelBalance),
            availableTests: availableHealthTests.map((test) => ({
              testCode: test.testCode,
              displayName: test.displayName,
              minimumAgeLabel: test.minimumAgeLabel,
              cost: test.cost,
            })),
            kennelBalance,
            checkoutNeeded,
            selectedTestSupportData: {
              selectableTestCodes: availableHealthTests.map(
                (test) => test.testCode
              ),
              totalAvailableCost: availableHealthTests.reduce(
                (total, test) => total + test.cost,
                0
              ),
            },
          }
        : null,
    },
    groomingDetails:
      isOwnedByCurrentKennel && groomingSummary && groomingStatus
        ? {
            weeklyActionsRemaining:
              groomingSummary.groomingActionsRemainingThisWeek,
            weeklyActionLimit: groomingSummary.totalGroomingActionLimit,
            currentCoatCondition: groomingStatus.currentCoatCondition,
            netGroomingEffect: groomingStatus.netGroomingImpact,
            groomingStatus: groomingStatus.groomingStatusLabel,
            listedForOutsideGrooming: groomingStatus.listedForGrooming,
            outsideGroomingListingId: groomingStatus.openListingId,
            totalHistoricalGain: groomingStatus.totalGroomingGain,
            totalHistoricalDecay: groomingStatus.totalGroomingDecay,
            canGroom,
            canOfferOutsideGrooming,
            canCancelOutsideGrooming,
          }
        : null,
    breedingAndProduction: {
      breedingEligibilityLabel: formatEligibilityLabel(breedingEligible),
      productionRoleLabel: dog.sex === Sex.M ? "Stud/Sire" : "Dam/Brood",
      activeStudListing: activeStudListing
        ? {
            isAtStud: true,
            studFee: activeStudListing.askingPrice,
            listingId: activeStudListing.id,
            listingStatusLabel: "Active",
          }
        : null,
      activeSaleListing: activeSaleListing
        ? {
            isForSale: true,
            askingPrice: activeSaleListing.askingPrice,
            listingId: activeSaleListing.id,
            listingStatusLabel: "Active",
          }
        : null,
      sireHistory,
      damHistory,
      progeny,
      championOffspringCount: producerRecord.championOffspringCount,
      producerMerit: {
        currentMeritLabel: producerRecord.producerMeritLabel,
        currentMeritSuffix: producerRecord.producerMeritSuffix,
        nextMeritLabel: producerRecord.nextMeritLabel,
        progressCurrent: producerRecord.championOffspringCount,
        progressRequired: producerRecord.nextMeritThreshold,
        progressLabel: producerProgressLabel,
        highestMeritReached,
      },
    },
    pedigree: {
      coiValue: dog.coiPercent,
      coiLabel:
        dog.coiPercent === null
          ? "COI: Pending"
          : `COI: ${dog.coiPercent.toFixed(2)}%`,
      generationDepth: dog.coiGenerationDepth,
      colorLabel: "Color: Pending",
      healthTestsSummary: `Health tests: ${healthSummary.completedCount}/${healthSummary.totalCount}`,
      ancestors: pedigreeAncestors,
    },
    entries: isOwnedByCurrentKennel
      ? {
          currentEntriesCount: allEntries.length,
          nextEntries: allEntries.slice(0, 3),
          allEntries,
        }
      : null,
    privatePlanning: isOwnedByCurrentKennel
      ? {
          notes: ownerData?.privateKennelNotes[0]?.notes ?? null,
          programPlannerTags,
          breedingProgramGoal: primaryPlannerTag
            ? formatGoalLabel(primaryPlannerTag.goalKey)
            : null,
          privatePlannerNote: primaryPlannerTag?.note ?? null,
          isWatchlisted: Boolean(
            ownerData?.plannerTags.some((tag) => tag.tagType === "WATCH")
          ),
          isKeeper: Boolean(
            ownerData?.plannerTags.some((tag) => tag.tagType === "KEEP")
          ),
          canEditNotes: true,
        }
      : null,
    actions: {
      canName: isOwnedByCurrentKennel && !dog.registeredName?.trim(),
      canBreed: isOwnedByCurrentKennel && breedingEligible,
      canBuyActiveListing:
        !isOwnedByCurrentKennel && isAlive && Boolean(activeSaleListing),
      canUseActiveStudListing:
        !isOwnedByCurrentKennel &&
        isAlive &&
        dog.sex === Sex.M &&
        Boolean(activeStudListing),
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
      rehomePayout:
        isOwnedByCurrentKennel &&
        isAlive &&
        ageHours >= PUPPY_SALE_MIN_AGE_HOURS
          ? getPuppyRehomePayoutForAgeHours(ageHours)
          : null,
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

