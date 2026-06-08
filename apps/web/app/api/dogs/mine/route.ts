import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getPhenotypeHealthBadgeStatus,
  hasAllGreenPhenotypeHealthTests,
} from "@/lib/dogHealth";
import { getKennelForUser } from "@/server/services/kennel.service";
import { resolveBreedingProgressForKennel } from "@/server/services/breeding.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  WHELPING_COOLDOWN_HOURS,
  deriveVisibleCategoriesFromTraits,
} from "@showring/rules";

const RECENT_BREEDING_RESULT_HOURS = 14;

type RosterDogRecord = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
  lifecycleState: string;
  marketState: string;
  breed: {
    name: string;
    groupName: string | null;
  };
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

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
    | "Did Not Take"
    | "Whelped"
    | "Post-Whelp Cooldown"
    | "Available for Stud"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
  cooldownInHours: number | null;
};

type ActiveDamAttemptSummary = {
  dogId: string;
  status: "INITIATED" | "PREGNANT";
  pregCheckEpoch: number | null;
  dueEpoch: number | null;
};

type LatestWhelpedAttemptSummary = {
  dogId: string;
  whelpedEpoch: number;
};

type RecentNotPregnantAttemptSummary = {
  dogId: string;
  checkedEpoch: number;
};

type HealthTestSummary = {
  dogId: string;
  testTypeCode: string;
  resultCode: string;
};

type ActiveListingSummary = {
  dogId: string;
  listingType: string;
};

function toVisibleCategories(dog: RosterDogRecord) {
  return deriveVisibleCategoriesFromTraits({
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
  });
}

function getBreedingCardStatus(
  dog: Pick<RosterDogRecord, "sex" | "birthEpoch" | "lifecycleState">,
  breedingSummary: {
    activeAttempt: ActiveDamAttemptSummary | null;
    latestWhelpedAttempt: LatestWhelpedAttemptSummary | null;
    recentNotPregnantAttempt: RecentNotPregnantAttemptSummary | null;
  },
  currentEpoch: number
): BreedingCardStatus {
  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
  const isAlive = dog.lifecycleState === "ALIVE";
  const oldEnough = ageHours >= MIN_BREED_AGE_HOURS;
  const notTooOldIfFemale =
    dog.sex === "F" ? ageHours <= DAM_MAX_BREED_AGE_HOURS : true;

  const isEligible = isAlive && oldEnough && notTooOldIfFemale;

  if (!isEligible) {
    return {
      label: "Not Eligible",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
    };
  }

  if (dog.sex === "M") {
    return {
      label: "Available for Stud",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
    };
  }

  if (breedingSummary.activeAttempt?.status === "PREGNANT") {
    return {
      label: "Pregnant",
      pregCheckInHours: null,
      dueInHours:
        breedingSummary.activeAttempt.dueEpoch == null
          ? null
          : Math.max(0, breedingSummary.activeAttempt.dueEpoch - currentEpoch),
      cooldownInHours: null,
    };
  }

  if (breedingSummary.activeAttempt?.status === "INITIATED") {
    return {
      label: "Pending Pregnancy Confirmation",
      pregCheckInHours:
        breedingSummary.activeAttempt.pregCheckEpoch == null
          ? null
          : Math.max(
              0,
              breedingSummary.activeAttempt.pregCheckEpoch - currentEpoch
            ),
      dueInHours: null,
      cooldownInHours: null,
    };
  }

  const cooldownUntil =
    breedingSummary.latestWhelpedAttempt?.whelpedEpoch == null
      ? null
      : breedingSummary.latestWhelpedAttempt.whelpedEpoch +
        WHELPING_COOLDOWN_HOURS;

  if (cooldownUntil !== null && currentEpoch < cooldownUntil) {
    return {
      label: "Post-Whelp Cooldown",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: cooldownUntil - currentEpoch,
    };
  }

  if (
    breedingSummary.latestWhelpedAttempt?.whelpedEpoch != null &&
    currentEpoch - breedingSummary.latestWhelpedAttempt.whelpedEpoch <=
      RECENT_BREEDING_RESULT_HOURS
  ) {
    return {
      label: "Whelped",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
    };
  }

  if (breedingSummary.recentNotPregnantAttempt) {
    return {
      label: "Did Not Take",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
    };
  }

  return {
    label: "Open",
    pregCheckInHours: null,
    dueInHours: null,
    cooldownInHours: null,
  };
}

function groupAreaIdsByDog(
  memberships: Array<{ dogId: string; kennelAreaId: string }>
) {
  const areaIdsByDogId = new Map<string, string[]>();

  for (const membership of memberships) {
    const areaIds = areaIdsByDogId.get(membership.dogId) ?? [];
    areaIds.push(membership.kennelAreaId);
    areaIdsByDogId.set(membership.dogId, areaIds);
  }

  return areaIdsByDogId;
}

function groupHealthTestsByDog(healthTests: HealthTestSummary[]) {
  const testsByDogId = new Map<string, Array<{ testTypeCode: string; resultCode: string }>>();

  for (const test of healthTests) {
    const tests = testsByDogId.get(test.dogId) ?? [];
    tests.push({
      testTypeCode: test.testTypeCode,
      resultCode: test.resultCode,
    });
    testsByDogId.set(test.dogId, tests);
  }

  return testsByDogId;
}

function groupActiveListingTypesByDog(listings: ActiveListingSummary[]) {
  const listingTypesByDogId = new Map<string, Set<string>>();

  for (const listing of listings) {
    const listingTypes = listingTypesByDogId.get(listing.dogId) ?? new Set<string>();
    listingTypes.add(listing.listingType);
    listingTypesByDogId.set(listing.dogId, listingTypes);
  }

  return listingTypesByDogId;
}

function mapByDogId<T extends { dogId: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.dogId, row]));
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    await resolveBreedingProgressForKennel({ kennelId: kennel.id, currentEpoch });

    const dogs: RosterDogRecord[] = await db.dog.findMany({
      where: {
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
      },
      orderBy: [{ birthEpoch: "desc" }],
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        breedCode2: true,
        sex: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
        breed: {
          select: {
            name: true,
            groupName: true,
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
      },
    });
    const dogIds = dogs.map((dog) => dog.id);
    const [
      areaMemberships,
      activeDamAttempts,
      latestWhelpedAttempts,
      recentNotPregnantAttempts,
      latestHealthTests,
      activeListings,
      areas,
    ] = dogIds.length
      ? await Promise.all([
          db.kennelAreaDog.findMany({
            where: {
              dogId: {
                in: dogIds,
              },
              area: {
                kennelId: kennel.id,
              },
            },
            select: {
              dogId: true,
              kennelAreaId: true,
            },
          }),
          db.breedingAttempt.findMany({
            where: {
              damId: {
                in: dogIds,
              },
              status: {
                in: ["INITIATED", "PREGNANT"],
              },
            },
            orderBy: [{ damId: "asc" }, { createdEpoch: "desc" }],
            distinct: ["damId"],
            select: {
              damId: true,
              status: true,
              pregCheckEpoch: true,
              dueEpoch: true,
            },
          }),
          db.breedingAttempt.findMany({
            where: {
              damId: {
                in: dogIds,
              },
              status: "WHELPED",
              whelpedEpoch: {
                not: null,
              },
            },
            orderBy: [{ damId: "asc" }, { whelpedEpoch: "desc" }],
            distinct: ["damId"],
            select: {
              damId: true,
              whelpedEpoch: true,
            },
          }),
          db.breedingAttempt.findMany({
            where: {
              damId: {
                in: dogIds,
              },
              status: "CHECKED_NOT_PREGNANT",
              checkedEpoch: {
                not: null,
                gte: currentEpoch - RECENT_BREEDING_RESULT_HOURS,
              },
            },
            orderBy: [{ damId: "asc" }, { checkedEpoch: "desc" }],
            distinct: ["damId"],
            select: {
              damId: true,
              checkedEpoch: true,
            },
          }),
          db.healthTestRecord.findMany({
            where: {
              dogId: {
                in: dogIds,
              },
              isPublic: true,
              testTypeCode: {
                in: [...PHENOTYPE_HEALTH_TEST_CODES],
              },
            },
            orderBy: [
              { dogId: "asc" },
              { testTypeCode: "asc" },
              { testedAtEpoch: "desc" },
              { createdAt: "desc" },
            ],
            distinct: ["dogId", "testTypeCode"],
            select: {
              dogId: true,
              testTypeCode: true,
              resultCode: true,
            },
          }),
          db.dogListing.findMany({
            where: {
              dogId: {
                in: dogIds,
              },
              sellerKennelId: kennel.id,
              status: "ACTIVE",
              listingType: {
                in: [PLAYER_SALE_LISTING_TYPE, PLAYER_STUD_LISTING_TYPE],
              },
            },
            select: {
              dogId: true,
              listingType: true,
            },
          }),
          db.kennelArea.findMany({
            where: {
              kennelId: kennel.id,
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          }),
        ])
      : [[], [], [], [], [], [], []];
    const areaIdsByDogId = groupAreaIdsByDog(areaMemberships);
    const activeAttemptByDogId = mapByDogId(
      activeDamAttempts.map((attempt) => ({
        dogId: attempt.damId,
        status: (
          attempt.status === "PREGNANT" ? "PREGNANT" : "INITIATED"
        ) as ActiveDamAttemptSummary["status"],
        pregCheckEpoch: attempt.pregCheckEpoch,
        dueEpoch: attempt.dueEpoch,
      }))
    );
    const latestWhelpedByDogId = mapByDogId(
      latestWhelpedAttempts
        .filter(
          (attempt): attempt is {
            damId: string;
            whelpedEpoch: number;
          } => attempt.whelpedEpoch !== null
        )
        .map((attempt) => ({
          dogId: attempt.damId,
          whelpedEpoch: attempt.whelpedEpoch,
        }))
    );
    const recentNotPregnantByDogId = mapByDogId(
      recentNotPregnantAttempts
        .filter(
          (attempt): attempt is {
            damId: string;
            checkedEpoch: number;
          } => attempt.checkedEpoch !== null
        )
        .map((attempt) => ({
          dogId: attempt.damId,
          checkedEpoch: attempt.checkedEpoch,
        }))
    );
    const healthTestsByDogId = groupHealthTestsByDog(latestHealthTests);
    const activeListingTypesByDogId = groupActiveListingTypesByDog(activeListings);

    return ok({
      areas,
      dogs: dogs.map((dog) => {
        const healthTests = healthTestsByDogId.get(dog.id) ?? [];
        const activeListingTypes = activeListingTypesByDogId.get(dog.id) ?? new Set<string>();

        return {
          dogId: dog.id,
          callName: dog.callName,
          registeredName: dog.registeredName,
          regNumber: dog.regNumber,
          visibleTitlePrefix: dog.visibleTitlePrefix,
          visibleTitleSuffix: dog.visibleTitleSuffix,
          breedCode2: dog.breedCode2,
          breedName: dog.breed.name,
          breedGroupName: dog.breed.groupName,
          sex: dog.sex,
          ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
          lifecycleState: dog.lifecycleState,
          marketState: dog.marketState,
          hasAllGreenHealthTests: hasAllGreenPhenotypeHealthTests(healthTests),
          healthBadgeStatus: getPhenotypeHealthBadgeStatus(healthTests),
          isListedForSale: activeListingTypes.has(PLAYER_SALE_LISTING_TYPE),
          isListedAtStud: activeListingTypes.has(PLAYER_STUD_LISTING_TYPE),
          areaIds: areaIdsByDogId.get(dog.id) ?? [],
          visibleCategories: toVisibleCategories(dog),
          breedingCardStatus: getBreedingCardStatus(
            dog,
            {
              activeAttempt: activeAttemptByDogId.get(dog.id) ?? null,
              latestWhelpedAttempt: latestWhelpedByDogId.get(dog.id) ?? null,
              recentNotPregnantAttempt:
                recentNotPregnantByDogId.get(dog.id) ?? null,
            },
            currentEpoch
          ),
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/dogs/mine failed", error);
    return fail("Unable to load kennel dogs.", 500);
  }
}
