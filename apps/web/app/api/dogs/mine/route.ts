import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getPhenotypeHealthBadgeStatus,
  hasAllGreenPhenotypeHealthTests,
} from "@/lib/dogHealth";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getKennelGroomingSummary,
  getOwnedDogGroomingStatuses,
} from "@/server/services/grooming.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { resolveBreedingProgressForKennel } from "@/server/services/breeding.service";
import { getIndividualBreedingEligibility } from "@/server/services/breedingEligibility.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import {
  PHENOTYPE_HEALTH_TEST_CODES,
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
  kennelRunId: string | null;
  kennelRun: {
    id: string;
    name: string;
  } | null;
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
  healthConditionTruths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
  ringObedience: number;
  muscleTone: number;
  coatCondition: number;
  fatiguePoints: number;
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

type HealthConditionTruthSummary = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

type ActiveListingSummary = {
  dogId: string;
  listingType: string;
};

function toVisibleCategories(
  dog: RosterDogRecord,
  healthTests: Array<{ testTypeCode: string; resultCode: string }>
) {
  return deriveCurrentVisibleCategoriesForDogDisplay({
    storedTraits: dog,
    phenotypeHealthTruths: dog.healthConditionTruths,
    phenotypeHealthResults: healthTests,
    conditioning: {
      coatCondition: dog.coatCondition,
      muscleTone: dog.muscleTone,
      ringObedience: dog.ringObedience,
      fatiguePoints: dog.fatiguePoints,
    },
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
  const breedingEligibility = getIndividualBreedingEligibility({
    currentEpoch,
    birthEpoch: dog.birthEpoch,
    lifecycleState: dog.lifecycleState as
      | "ALIVE"
      | "RETIRED"
      | "DECEASED"
      | "TRANSFERRED",
    sex: dog.sex,
    activeBreedingAttemptStatus: breedingSummary.activeAttempt?.status ?? null,
    lastWhelpedEpoch: breedingSummary.latestWhelpedAttempt?.whelpedEpoch ?? null,
  });

  if (!breedingEligibility.isEligible) {
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
    breedingEligibility.cooldownUntilEpoch;

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

function groupHealthConditionTruthsByDog(
  healthConditionTruths: HealthConditionTruthSummary[]
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

function parseRunFilter(request: Request): string[] | Response {
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId")?.trim();
  const runIds = url.searchParams.get("runIds")?.trim();

  if (runId && runIds) {
    return fail("Use either runId or runIds, not both.", 400);
  }

  if (runId) {
    return [runId];
  }

  if (runIds) {
    return [
      ...new Set(
        runIds
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      ),
    ];
  }

  return [];
}

export async function GET(request: Request) {
  const perf = createPerfTimer({ route: "/api/dogs/mine" });
  try {
    const userId = await perf.measure("sessionMs", () => getSessionUserId());

    if (!userId) {
      perf.log({ userContextPresent: false, kennelContextPresent: false });
      return fail("Unauthorized.", 401);
    }

    const kennel = await perf.measure("kennelLookupMs", () =>
      getKennelForUser(userId)
    );

    if (!kennel) {
      perf.log({ userContextPresent: true, kennelContextPresent: false });
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    await perf.measure("resolveBreedingMs", () =>
      resolveBreedingProgressForKennel({ kennelId: kennel.id, currentEpoch })
    );
    const runFilter = parseRunFilter(request);

    if (runFilter instanceof Response) {
      return runFilter;
    }

    if (runFilter.length > 0) {
      const matchingRuns = await perf.measure("runFilterValidationMs", () =>
        db.kennelRun.findMany({
          where: {
            kennelId: kennel.id,
            id: {
              in: runFilter,
            },
          },
          select: {
            id: true,
          },
        })
      );

      if (matchingRuns.length !== runFilter.length) {
        return fail("One or more Kennel Runs were not found.", 400);
      }
    }

    const dogs: RosterDogRecord[] = await perf.measure("dogQueryMs", () =>
      db.dog.findMany({
        where: {
          ownerKennelId: kennel.id,
          lifecycleState: "ALIVE",
          isPlayerVisible: true,
          ...(runFilter.length > 0
            ? {
                kennelRunId: {
                  in: runFilter,
                },
              }
            : {}),
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
          kennelRunId: true,
          kennelRun: {
            select: {
              id: true,
              name: true,
            },
          },
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
          ringObedience: true,
          muscleTone: true,
          coatCondition: true,
          fatiguePoints: true,
        },
      })
    );
    const dogIds = dogs.map((dog) => dog.id);

    if (dogIds.length > 0) {
      await perf.measure("ensureHealthTruthsMs", () =>
        ensurePhenotypeHealthTruthsForDogs(db, dogIds)
      );
    }

    const [
      freshHealthConditionTruths,
      activeDamAttempts,
      latestWhelpedAttempts,
      recentNotPregnantAttempts,
      latestHealthTests,
      activeListings,
      groomingStatuses,
      groomingSummary,
    ] = dogIds.length
      ? await perf.measure("secondaryQueriesMs", () => Promise.all([
          db.dogHealthConditionTruth.findMany({
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
          getOwnedDogGroomingStatuses({
            kennelId: kennel.id,
            dogIds,
            currentEpoch,
          }),
          getKennelGroomingSummary({
            kennelId: kennel.id,
            currentEpoch,
          }),
        ]))
      : [
          [],
          [],
          [],
          [],
          [],
          [],
          new Map(),
          await getKennelGroomingSummary({
            kennelId: kennel.id,
            currentEpoch,
          }),
        ];
    const healthConditionTruthsByDogId = groupHealthConditionTruthsByDog(
      freshHealthConditionTruths
    );
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
      latestWhelpedAttempts.flatMap<LatestWhelpedAttemptSummary>((attempt) =>
        attempt.whelpedEpoch === null
          ? []
          : [
              {
                dogId: attempt.damId,
                whelpedEpoch: attempt.whelpedEpoch,
              },
            ]
      )
    );
    const recentNotPregnantByDogId = mapByDogId(
      recentNotPregnantAttempts.flatMap<RecentNotPregnantAttemptSummary>(
        (attempt) =>
          attempt.checkedEpoch === null
            ? []
            : [
                {
                  dogId: attempt.damId,
                  checkedEpoch: attempt.checkedEpoch,
                },
              ]
      )
    );
    const healthTestsByDogId = groupHealthTestsByDog(latestHealthTests);
    const activeListingTypesByDogId = groupActiveListingTypesByDog(activeListings);

    const payload = {
      groomingSummary,
      dogs: dogs.map((dog) => {
        const healthTests = healthTestsByDogId.get(dog.id) ?? [];
        const healthConditionTruths =
          healthConditionTruthsByDogId.get(dog.id) ?? dog.healthConditionTruths;
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
          hasAllGreenHealthTests: hasAllGreenPhenotypeHealthTests(
            healthTests,
            dog.breedCode2
          ),
          healthBadgeStatus: getPhenotypeHealthBadgeStatus(
            healthTests,
            dog.breedCode2
          ),
          isListedForSale: activeListingTypes.has(PLAYER_SALE_LISTING_TYPE),
          isListedAtStud: activeListingTypes.has(PLAYER_STUD_LISTING_TYPE),
          kennelRunId: dog.kennelRunId,
          currentRun: dog.kennelRun
            ? {
                id: dog.kennelRun.id,
                name: dog.kennelRun.name,
              }
            : null,
          groomingStatus: groomingStatuses.get(dog.id) ?? {
            dogId: dog.id,
            groomedThisWeek: false,
            listedForGrooming: false,
            openListingId: null,
            currentCoatCondition: 0,
            totalGroomingGain: 0,
            totalGroomingDecay: 0,
            netGroomingImpact: 0,
            lastGroomedEpoch: null,
            currentGroomingWeek: 0,
            groomingStatusLabel: "Needs grooming",
          },
          visibleCategories: toVisibleCategories(
            {
              ...dog,
              healthConditionTruths,
            },
            healthTests
          ),
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
    };
    perf.log({
      userContextPresent: true,
      kennelContextPresent: true,
      runFilterCount: runFilter.length,
      dogCount: payload.dogs.length,
      activeDamAttemptCount: activeDamAttempts.length,
      latestWhelpedAttemptCount: latestWhelpedAttempts.length,
      recentNotPregnantAttemptCount: recentNotPregnantAttempts.length,
      activeListingCount: activeListings.length,
      payloadSizeBytes: estimateJsonSizeBytes(payload),
    });
    return ok(payload);
  } catch (error) {
    console.error("GET /api/dogs/mine failed", error);
    return fail("Unable to load kennel dogs.", 500);
  }
}
