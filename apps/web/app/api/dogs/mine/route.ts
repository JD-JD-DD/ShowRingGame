import { fail, ok } from "@/lib/http";
import type { PersistedDogTraitRecord } from "@/server/services/phenotypePersistence.service";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  getPhenotypeHealthBadgeStatus,
  getPhenotypeHealthSeverity,
  hasAllGreenPhenotypeHealthTests,
} from "@/lib/dogHealth";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  getKennelGroomingSummary,
  getOwnedDogGroomingStatuses,
} from "@/server/services/grooming.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { buildBrucellosisBreedingSafetyScreening } from "@/server/services/brucellosisPresentation.service";
import { resolveDueBreedingProgressForKennel } from "@/server/services/breeding.service";
import {
  getBreedingEligibilityMessage,
  getIndividualBreedingEligibility,
} from "@/server/services/breedingEligibility.service";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import { hasValidPublishedStudOffer } from "@/server/services/studOfferPresentation.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import {
  BRUCELLOSIS_DISEASE_CODE,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  getPhenotypeHealthResultLabel,
  getRequiredHealthTestsForBreed,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

const RECENT_BREEDING_RESULT_HOURS = 14;

type RosterDogRecord = PersistedDogTraitRecord & {
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
  ownerKennelId: string | null;
  kennelRunId: string | null;
  kennelRun: {
    id: string;
    name: string;
  } | null;
  breed: {
    name: string;
    groupName: string | null;
  };
  healthConditionTruths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
  studOffersAsSire: Array<{
    id: string;
    ownerKennelId: string;
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
    | "Post-Whelp Rest"
    | "Available"
    | "Recovery"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
  cooldownInHours: number | null;
  detail: string | null;
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

type BrucellosisTestSummary = {
  dogId: string;
  diseaseCode: string;
  resultCode: string;
  testedAtEpoch: number;
  validUntilEpoch: number | null;
};

type BrucellosisStatusSummary = {
  dogId: string;
  diseaseCode: string;
  status: string;
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
    latestSireAttemptCreatedEpoch: number | null;
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
    latestSireAttemptCreatedEpoch: breedingSummary.latestSireAttemptCreatedEpoch,
  });
  if (dog.sex === "M") {
    return {
      label:
        breedingEligibility.reasonCode === "STUD_RECOVERY"
          ? "Recovery"
          : breedingEligibility.isEligible
            ? "Available"
            : "Not Eligible",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours:
        breedingEligibility.reasonCode === "STUD_RECOVERY"
          ? breedingEligibility.remainingHours
          : null,
      detail: getBreedingEligibilityMessage(breedingEligibility),
    };
  }

  if (breedingEligibility.reasonCode === "PREGNANT") {
    const activeAttempt = breedingSummary.activeAttempt;

    return {
      label: "Pregnant",
      pregCheckInHours: null,
      dueInHours:
        activeAttempt?.dueEpoch == null
          ? null
          : Math.max(0, activeAttempt.dueEpoch - currentEpoch),
      cooldownInHours: null,
      detail: null,
    };
  }

  if (breedingEligibility.reasonCode === "PENDING_PREGNANCY_CONFIRMATION") {
    const activeAttempt = breedingSummary.activeAttempt;

    return {
      label: "Pending Pregnancy Confirmation",
      pregCheckInHours:
        activeAttempt?.pregCheckEpoch == null
          ? null
          : Math.max(0, activeAttempt.pregCheckEpoch - currentEpoch),
      dueInHours: null,
      cooldownInHours: null,
      detail: null,
    };
  }

  if (breedingEligibility.reasonCode === "POST_WHELP_COOLDOWN") {
    return {
      label: "Post-Whelp Rest",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: breedingEligibility.remainingHours,
      detail: null,
    };
  }

  if (!breedingEligibility.isEligible) {
    return {
      label: "Not Eligible",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
      detail: null,
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
      detail: null,
    };
  }

  if (breedingSummary.recentNotPregnantAttempt) {
    return {
      label: "Did Not Take",
      pregCheckInHours: null,
      dueInHours: null,
      cooldownInHours: null,
      detail: null,
    };
  }

  return {
    label: "Open",
    pregCheckInHours: null,
    dueInHours: null,
      cooldownInHours: null,
      detail: null,
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

function groupBrucellosisTestsByDog(tests: BrucellosisTestSummary[]) {
  const testsByDogId = new Map<string, BrucellosisTestSummary[]>();

  for (const test of tests) {
    const dogTests = testsByDogId.get(test.dogId) ?? [];
    dogTests.push(test);
    testsByDogId.set(test.dogId, dogTests);
  }

  return testsByDogId;
}

function groupBrucellosisStatusesByDog(statuses: BrucellosisStatusSummary[]) {
  const statusesByDogId = new Map<string, BrucellosisStatusSummary[]>();

  for (const status of statuses) {
    const dogStatuses = statusesByDogId.get(status.dogId) ?? [];
    dogStatuses.push(status);
    statusesByDogId.set(status.dogId, dogStatuses);
  }

  return statusesByDogId;
}

function buildRosterPhenotypeHealthPresentation(args: {
  breedCode2: string;
  ageHours: number;
  healthTests: Array<{ testTypeCode: string; resultCode: string }>;
}) {
  const applicableTestCodes = new Set(getRequiredHealthTestsForBreed(args.breedCode2));

  return Object.fromEntries(
    PHENOTYPE_HEALTH_TEST_CODES.map((testCode) => {
      const definition = PHENOTYPE_HEALTH_TESTS[testCode];
      const result = args.healthTests.find(
        (test) => test.testTypeCode === testCode
      );
      const isApplicable = applicableTestCodes.has(testCode);

      return [
        testCode,
        result
          ? {
              resultCode: result.resultCode,
              resultLabel: getPhenotypeHealthResultLabel(
                testCode as PhenotypeHealthTestCode,
                result.resultCode
              ),
              severity: getPhenotypeHealthSeverity(testCode, result.resultCode),
              state: "TESTED" as const,
              availabilityLabel: null,
            }
          : !isApplicable
            ? {
                resultCode: null,
                resultLabel: null,
                severity: null,
                state: "NOT_APPLICABLE" as const,
                availabilityLabel: null,
              }
            : {
                resultCode: null,
                resultLabel: null,
                severity: null,
                state: "UNTESTED" as const,
                availabilityLabel:
                  args.ageHours < definition.minimumAgeHours
                    ? definition.minimumAgeLabel
                    : null,
              },
      ];
    })
  );
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
    await perf.measure("resolveDueBreedingMs", () =>
      resolveDueBreedingProgressForKennel({
        kennelId: kennel.id,
        currentEpoch,
      })
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
          ownerKennelId: true,
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
          studOffersAsSire: {
            where: { status: "PUBLISHED" },
            select: { id: true, ownerKennelId: true },
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
      latestSireAttempts,
      latestHealthTests,
      brucellosisTests,
      brucellosisStatuses,
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
          db.breedingAttempt.findMany({
            where: { sireId: { in: dogIds } },
            orderBy: [
              { sireId: "asc" },
              { createdEpoch: "desc" },
              { id: "desc" },
            ],
            distinct: ["sireId"],
            select: { sireId: true, createdEpoch: true },
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
          db.infectiousDiseaseTestRecord.findMany({
            where: {
              dogId: { in: dogIds },
              diseaseCode: BRUCELLOSIS_DISEASE_CODE,
            },
            orderBy: [
              { dogId: "asc" },
              { testedAtEpoch: "desc" },
              { createdAt: "desc" },
            ],
            select: {
              dogId: true,
              diseaseCode: true,
              resultCode: true,
              testedAtEpoch: true,
              validUntilEpoch: true,
            },
          }),
          db.dogInfectiousDiseaseStatus.findMany({
            where: {
              dogId: { in: dogIds },
              diseaseCode: BRUCELLOSIS_DISEASE_CODE,
            },
            select: {
              dogId: true,
              diseaseCode: true,
              status: true,
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
    const latestSireAttemptEpochByDogId = new Map(
      latestSireAttempts.map((attempt) => [attempt.sireId, attempt.createdEpoch])
    );
    const healthTestsByDogId = groupHealthTestsByDog(latestHealthTests);
    const brucellosisTestsByDogId = groupBrucellosisTestsByDog(brucellosisTests);
    const brucellosisStatusesByDogId = groupBrucellosisStatusesByDog(
      brucellosisStatuses
    );
    const activeListingTypesByDogId = groupActiveListingTypesByDog(activeListings);

    const payload = await perf.measure("dtoMappingMs", async () => ({
      groomingSummary,
      dogs: dogs.map((dog) => {
        const healthTests = healthTestsByDogId.get(dog.id) ?? [];
        const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
        const brucellosisScreening = buildBrucellosisBreedingSafetyScreening({
          currentEpoch,
          infectiousDiseaseStatuses: brucellosisStatusesByDogId.get(dog.id) ?? [],
          infectiousDiseaseTests: brucellosisTestsByDogId.get(dog.id) ?? [],
        })[0];
        const healthConditionTruths =
          healthConditionTruthsByDogId.get(dog.id) ?? dog.healthConditionTruths;
        const activeListingTypes =
          activeListingTypesByDogId.get(dog.id) ?? new Set<string>();

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
          ageHours,
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
          health: {
            phenotype: buildRosterPhenotypeHealthPresentation({
              breedCode2: dog.breedCode2,
              ageHours,
              healthTests,
            }),
            brucellosis: {
              currentStatusLabel: brucellosisScreening.currentStatusLabel,
              isCurrentNegative: brucellosisScreening.isCurrentNegative,
              isPositiveOrInfected: brucellosisScreening.isPositiveOrInfected,
              testedAtEpoch: brucellosisScreening.testedAtEpoch,
            },
          },
          isListedForSale: activeListingTypes.has(PLAYER_SALE_LISTING_TYPE),
          isListedAtStud: hasValidPublishedStudOffer({
            ownerKennelId: dog.ownerKennelId,
            publishedStudOffers: dog.studOffersAsSire,
          }),
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
              latestSireAttemptCreatedEpoch:
                latestSireAttemptEpochByDogId.get(dog.id) ?? null,
            },
            currentEpoch
          ),
        };
      }),
    }));
    const payloadSizeBytes = await perf.measure(
      "payloadSerializationMs",
      async () => estimateJsonSizeBytes(payload)
    );
    perf.log({
      userContextPresent: true,
      kennelContextPresent: true,
      runFilterCount: runFilter.length,
      dogCount: payload.dogs.length,
      activeDamAttemptCount: activeDamAttempts.length,
      latestWhelpedAttemptCount: latestWhelpedAttempts.length,
      recentNotPregnantAttemptCount: recentNotPregnantAttempts.length,
      activeListingCount: activeListings.length,
      payloadSizeBytes,
    });
    return ok(payload);
  } catch (error) {
    console.error("GET /api/dogs/mine failed", error);
    return fail("Unable to load kennel dogs.", 500);
  }
}
