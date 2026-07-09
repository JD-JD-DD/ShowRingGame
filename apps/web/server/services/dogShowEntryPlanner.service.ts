import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";
import { getClubStewardingCommitmentForShow } from "@/server/services/kennelService.service";
import {
  canEnterShowDay,
  getSameWeekendClusterWhere,
} from "@/server/services/showEntry.service";
import { getShowEntryAvailability } from "@/server/services/showAvailability.service";
import {
  canEnterShows,
  getClusterEntryQuote,
  getShowDistrictRegionName,
  getShowWeekendKey,
  type DogStatus,
} from "@showring/rules";

type PlannerDog = Prisma.DogGetPayload<{
  select: {
    id: true;
    callName: true;
    registeredName: true;
    regNumber: true;
    visibleTitlePrefix: true;
    visibleTitleSuffix: true;
    breedCode2: true;
    sex: true;
    ownerKennelId: true;
    birthEpoch: true;
    lifecycleState: true;
    marketState: true;
    coatCondition: true;
    fatiguePoints: true;
    breed: { select: { code2: true; name: true; groupName: true } };
    ownerKennel: { select: { id: true; name: true; slug: true } };
    kennelRun: { select: { id: true; name: true } };
    breedingAttemptsAsDam: {
      where: {
        OR: [
          { status: "PREGNANT" },
          { status: "WHELPED"; whelpedEpoch: { not: null } },
        ];
      };
      orderBy: { whelpedEpoch: "desc" };
      select: { status: true; whelpedEpoch: true };
    };
    emergencyCareEvents: {
      where: { status: "PENDING" };
      select: { id: true };
      take: 1;
    };
  };
}>;

type PlannerCluster = Prisma.ShowClusterGetPayload<{
  include: {
    showDays: {
      orderBy: [{ dayIndex: "asc" }];
      include: {
        judge: { select: { name: true } };
        _count: { select: { showResults: true } };
      };
    };
  };
}>;

type SameWeekendConflict = {
  clusterId: string;
  clusterName: string;
  district: number;
  districtName: string;
} | null;

type ExistingEntry = {
  dogId: string;
  kennelId: string;
  showDayId: string;
  breedCode2: string;
  entryStatus: string;
  showDay: {
    clusterId: string;
  };
};

export type DogShowEntryPlannerDogDto = {
  dogId: string;
  callName: string | null;
  registeredName: string | null;
  displayName: string;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  sex: "M" | "F";
  ageHours: number;
  lifecycleState: string;
  marketState: string;
  ownerKennel: {
    kennelId: string;
    name: string;
    slug: string;
  };
  broadCanShow: boolean;
  currentRun: {
    runId: string;
    name: string;
  } | null;
  isPregnant: boolean;
  lastWhelpedEpoch: number | null;
  hasPendingEmergencyCare: boolean;
  coatCondition: number;
  fatiguePoints: number;
};

export type DogShowEntryPlannerDayDto = {
  showDayId: string;
  dayIndex: number;
  scheduledEpoch: number;
  label: string;
  judgeName: string;
  status: string;
  eligible: boolean;
  disabledReason: string | null;
  alreadyEntered: boolean;
  sameWeekendConflict: SameWeekendConflict;
  canSelect: boolean;
};

export type DogShowEntryImpactStatus =
  | "WOULD_SET_PRIMARY"
  | "EXISTING_PRIMARY_SAME_SHOW"
  | "EXISTING_PRIMARY_DIFFERENT_SHOW"
  | "STEWARDING_PRIMARY"
  | "ALREADY_REPRESENTED"
  | "DOG_ALREADY_ENTERED"
  | "NOT_APPLICABLE";

export type DogShowEntryImpactDto = {
  weekendKey: string;
  primaryStatus: DogShowEntryImpactStatus;
  primaryShowId: string | null;
  primaryShowName: string | null;
  notice: string | null;
  showRole: "PRIMARY" | "SECONDARY";
  travelCostAlreadyCovered: boolean;
  wouldCreateWeekendPlan: boolean;
};

export type DogShowEntryQuotePreviewDto = {
  previewKind: "ALL_SELECTABLE_DAYS";
  selectedDayCount: number;
  entryFees: number;
  travelCost: number;
  handlerFeeType: "RINGSIDE" | "TRAVELING";
  handlerDogs: number;
  handlerFee: number;
  estimatedTotalCost: number;
  balanceAfter: number;
  shortfall: number;
  canAfford: boolean;
  travelCostAlreadyCovered: boolean;
  wouldCreatePrimaryWeekendPlan: boolean;
  isSecondaryEntry: boolean;
} | null;

export type DogShowEntryPlannerClusterDto = {
  showId: string;
  name: string;
  weekendKey: string;
  year: number;
  district: number;
  districtName: string;
  startEpoch: number;
  endEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  entryStatus: string;
  entryStatusMessage: string;
  days: DogShowEntryPlannerDayDto[];
  hasSelectableDays: boolean;
  disabledReason: string | null;
  selectedByDefault: false;
  dogAlreadyEnteredInCluster: boolean;
  kennelRepresentedInCluster: boolean;
  hasEligibleDays: boolean;
  entryImpact: DogShowEntryImpactDto;
  quotePreview: DogShowEntryQuotePreviewDto;
};

export type DogShowEntryPlannerDto = {
  currentEpoch: number;
  kennelId: string;
  dog: DogShowEntryPlannerDogDto;
  clusters: DogShowEntryPlannerClusterDto[];
};

export type GetDogShowEntryPlannerArgs = {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
};

function getShowReproState(dog: PlannerDog): {
  isPregnant: boolean;
  lastWhelpedEpoch: number | null;
} {
  const latestWhelp = dog.breedingAttemptsAsDam.find(
    (attempt) => attempt.status === "WHELPED" && attempt.whelpedEpoch != null
  );

  return {
    isPregnant: dog.breedingAttemptsAsDam.some(
      (attempt) => attempt.status === "PREGNANT"
    ),
    lastWhelpedEpoch: latestWhelp?.whelpedEpoch ?? null,
  };
}

function hasJudgingActivity(cluster: PlannerCluster): boolean {
  return cluster.showDays.some(
    (day) =>
      day.status === "JUDGING" ||
      day.status === "RESULTS_PUBLISHED" ||
      day._count.showResults > 0
  );
}

function getWeekendLabel(weekendKey: string): string {
  const match = weekendKey.match(/^year-(\d+)-week-(\d+)$/);

  if (!match) {
    return weekendKey;
  }

  return `Year ${match[1]}, Week ${match[2]}`;
}

function getEntryImpact(args: {
  cluster: PlannerCluster;
  weekendKey: string;
  weekendPlan:
    | {
        primaryClusterId: string;
        primaryCluster: {
          name: string;
        };
      }
    | undefined;
  isStewardingThisShow: boolean;
  dogAlreadyEnteredInCluster: boolean;
  kennelRepresentedInCluster: boolean;
}): DogShowEntryImpactDto {
  const {
    cluster,
    weekendKey,
    weekendPlan,
    isStewardingThisShow,
    dogAlreadyEnteredInCluster,
    kennelRepresentedInCluster,
  } = args;
  const weekendLabel = getWeekendLabel(weekendKey);
  const primaryShowId = weekendPlan?.primaryClusterId ?? null;
  const primaryShowName = weekendPlan?.primaryCluster.name ?? null;
  const showRole: "PRIMARY" | "SECONDARY" =
    weekendPlan && weekendPlan.primaryClusterId !== cluster.id
      ? "SECONDARY"
      : "PRIMARY";
  const base = {
    weekendKey,
    primaryShowId,
    primaryShowName,
    showRole,
    travelCostAlreadyCovered: Boolean(weekendPlan),
    wouldCreateWeekendPlan: !weekendPlan,
  };

  if (isStewardingThisShow) {
    return {
      ...base,
      primaryStatus: "STEWARDING_PRIMARY",
      notice:
        "Your kennel is stewarding this show, so owner-handled entries are unavailable.",
    };
  }

  if (dogAlreadyEnteredInCluster) {
    return {
      ...base,
      primaryStatus: "DOG_ALREADY_ENTERED",
      notice: "This dog is already entered in this show.",
    };
  }

  if (kennelRepresentedInCluster) {
    return {
      ...base,
      primaryStatus: "ALREADY_REPRESENTED",
      notice: "Your kennel is already represented at this show.",
    };
  }

  if (!weekendPlan) {
    return {
      ...base,
      primaryStatus: "WOULD_SET_PRIMARY",
      notice: `This will mark ${cluster.name} as your primary show for ${weekendLabel}.`,
    };
  }

  if (weekendPlan.primaryClusterId === cluster.id) {
    return {
      ...base,
      primaryStatus: "EXISTING_PRIMARY_SAME_SHOW",
      notice: `This is your primary show for ${weekendLabel}. Travel is already planned.`,
    };
  }

  return {
    ...base,
    primaryStatus: "EXISTING_PRIMARY_DIFFERENT_SHOW",
    notice: `Entries for ${cluster.name} will be travel entries because your primary show for ${weekendLabel} is ${weekendPlan.primaryCluster.name}.`,
  };
}

function getClusterDisabledReason(args: {
  days: DogShowEntryPlannerDayDto[];
  isStewardingThisShow: boolean;
  hasPendingEmergencyCare: boolean;
  sameWeekendConflict: SameWeekendConflict;
  dogAlreadyEnteredInCluster: boolean;
}): string | null {
  if (args.isStewardingThisShow) {
    return "Your kennel is stewarding this show and cannot create owner-handled entries in it.";
  }

  if (args.hasPendingEmergencyCare) {
    return "Emergency vet care must be resolved before this dog can be entered.";
  }

  if (args.sameWeekendConflict) {
    return `This dog is already entered in ${args.sameWeekendConflict.clusterName} this weekend.`;
  }

  if (args.days.some((day) => day.canSelect)) {
    return null;
  }

  if (
    args.dogAlreadyEnteredInCluster &&
    args.days.every((day) => day.alreadyEntered)
  ) {
    return "This dog is already entered on every available show day in this show.";
  }

  return (
    args.days.find((day) => day.disabledReason)?.disabledReason ??
    "This dog cannot currently be entered in this show."
  );
}

function buildZeroQuotePreview(): DogShowEntryQuotePreviewDto {
  return null;
}

function buildQuotePreview(args: {
  dog: PlannerDog;
  cluster: PlannerCluster;
  kennelBalance: number;
  homeDistrict: number;
  weekendPlanExists: boolean;
  showRole: "PRIMARY" | "SECONDARY";
  existingDogIdsForBreed: string[];
  selectedDayIndices: number[];
}): DogShowEntryQuotePreviewDto {
  if (args.selectedDayIndices.length === 0) {
    return buildZeroQuotePreview();
  }

  const baseQuote = getClusterEntryQuote({
    homeDistrict: args.homeDistrict,
    clusterDistrict: args.cluster.district,
    ledgerBalance: args.kennelBalance,
    showRole: args.showRole,
    existingDogIdsByBreed: {
      [args.dog.breedCode2]: args.existingDogIdsForBreed,
    },
    dogs: [
      {
        dogId: args.dog.id,
        dogName: formatDogDisplayName(args.dog),
        breed: args.dog.breedCode2,
        sex: args.dog.sex === "M" ? "Dog" : "Bitch",
        selectedShowDays: args.selectedDayIndices,
      },
    ],
  });
  const travelCost = args.weekendPlanExists ? 0 : baseQuote.travel.totalCost;
  const estimatedTotalCost =
    baseQuote.entryFees + travelCost + baseQuote.handlerFee;
  const balanceAfter = args.kennelBalance - estimatedTotalCost;
  const shortfall = balanceAfter < 0 ? Math.abs(balanceAfter) : 0;

  return {
    previewKind: "ALL_SELECTABLE_DAYS",
    selectedDayCount: args.selectedDayIndices.length,
    entryFees: baseQuote.entryFees,
    travelCost,
    handlerFeeType: baseQuote.handlerFeeType,
    handlerDogs: baseQuote.handlerDogs,
    handlerFee: baseQuote.handlerFee,
    estimatedTotalCost,
    balanceAfter,
    shortfall,
    canAfford: shortfall === 0,
    travelCostAlreadyCovered: args.weekendPlanExists,
    wouldCreatePrimaryWeekendPlan: !args.weekendPlanExists,
    isSecondaryEntry: args.showRole === "SECONDARY",
  };
}

async function getSameWeekendConflicts(args: {
  dogId: string;
  clusters: PlannerCluster[];
}): Promise<Map<string, SameWeekendConflict>> {
  const conflictEntries = await Promise.all(
    args.clusters.map(async (cluster) => {
      const entry = await db.showEntry.findFirst({
        where: {
          dogId: args.dogId,
          entryStatus: "ENTERED",
          showDay: {
            clusterId: {
              not: cluster.id,
            },
            cluster: getSameWeekendClusterWhere(cluster),
          },
        },
        select: {
          showDay: {
            select: {
              clusterId: true,
              cluster: {
                select: {
                  name: true,
                  district: true,
                },
              },
            },
          },
        },
      });

      return [cluster.id, entry] as const;
    })
  );
  const conflictsByClusterId = new Map<string, SameWeekendConflict>();

  for (const [clusterId, entry] of conflictEntries) {
    conflictsByClusterId.set(
      clusterId,
      entry
        ? {
            clusterId: entry.showDay.clusterId,
            clusterName: entry.showDay.cluster.name,
            district: entry.showDay.cluster.district,
            districtName: getShowDistrictRegionName(entry.showDay.cluster.district),
          }
        : null
    );
  }

  return conflictsByClusterId;
}

export async function getDogShowEntryPlanner({
  kennelId,
  dogId,
  currentEpoch,
}: GetDogShowEntryPlannerArgs): Promise<DogShowEntryPlannerDto> {
  const [kennel, dog] = await Promise.all([
    db.kennel.findUnique({
      where: { id: kennelId },
      select: { id: true, balance: true, homeDistrict: true },
    }),
    db.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        breedCode2: true,
        sex: true,
        ownerKennelId: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
        coatCondition: true,
        fatiguePoints: true,
        breed: { select: { code2: true, name: true, groupName: true } },
        ownerKennel: { select: { id: true, name: true, slug: true } },
        kennelRun: { select: { id: true, name: true } },
        breedingAttemptsAsDam: {
          where: {
            OR: [
              { status: "PREGNANT" },
              { status: "WHELPED", whelpedEpoch: { not: null } },
            ],
          },
          orderBy: { whelpedEpoch: "desc" },
          select: { status: true, whelpedEpoch: true },
        },
        emergencyCareEvents: {
          where: { status: "PENDING" },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  if (!kennel) {
    throw new Error("Kennel not found.");
  }

  if (!dog || dog.ownerKennelId !== kennelId || !dog.ownerKennel) {
    throw new Error("Dog not found for this kennel.");
  }

  const candidateClusters = await db.showCluster.findMany({
    where: {
      entryOpenEpoch: {
        lte: currentEpoch,
      },
      entryCloseEpoch: {
        gt: currentEpoch,
      },
      status: {
        notIn: ["CANCELLED", "COMPLETE"],
      },
    },
    orderBy: [{ startEpoch: "asc" }, { name: "asc" }],
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judge: { select: { name: true } },
          _count: { select: { showResults: true } },
        },
      },
    },
  });
  const clusters = candidateClusters.filter((cluster) =>
    getShowEntryAvailability({
      cluster,
      currentEpoch,
      hasJudgingActivity: hasJudgingActivity(cluster),
    }).canEnter
  );
  const clusterIds = clusters.map((cluster) => cluster.id);
  const weekendKeys = [
    ...new Set(
      clusters.map((cluster) =>
        getShowWeekendKey({
          clusterId: cluster.id,
          startEpoch: cluster.startEpoch,
        })
      )
    ),
  ];
  const [existingEntries, weekendPlans, stewardingCommitmentsByClusterId, sameWeekendConflicts] =
    await Promise.all([
      clusterIds.length > 0
        ? db.showEntry.findMany({
            where: {
              showDay: {
                clusterId: {
                  in: clusterIds,
                },
              },
              OR: [
                { dogId: dog.id },
                { kennelId, breedCode2: dog.breedCode2 },
                { kennelId, entryStatus: { in: ["ENTERED", "JUDGED"] } },
              ],
            },
            select: {
              dogId: true,
              kennelId: true,
              showDayId: true,
              breedCode2: true,
              entryStatus: true,
              showDay: {
                select: {
                  clusterId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      weekendKeys.length > 0
        ? db.kennelShowWeekendPlan.findMany({
            where: {
              kennelId,
              weekendKey: {
                in: weekendKeys,
              },
            },
            select: {
              weekendKey: true,
              primaryClusterId: true,
              primaryCluster: {
                select: {
                  name: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      Promise.all(
        clusters.map(async (cluster) => {
          const commitment = await getClubStewardingCommitmentForShow({
            kennelId,
            showClusterId: cluster.id,
          });

          return [cluster.id, commitment] as const;
        })
      ).then((entries) => new Map(entries)),
      getSameWeekendConflicts({ dogId: dog.id, clusters }),
    ]);
  const existingEntriesByDayId = new Map<string, ExistingEntry>();
  const dogEnteredClusterIds = new Set<string>();
  const representedClusterIds = new Set<string>();
  const existingBreedDogIdsByClusterId = new Map<string, Set<string>>();
  const weekendPlanByKey = new Map(
    weekendPlans.map((plan) => [plan.weekendKey, plan])
  );

  for (const entry of existingEntries) {
    const clusterId = entry.showDay.clusterId;

    if (entry.dogId === dog.id) {
      existingEntriesByDayId.set(entry.showDayId, entry);
      dogEnteredClusterIds.add(clusterId);
    }

    if (
      entry.kennelId === kennelId &&
      (entry.entryStatus === "ENTERED" || entry.entryStatus === "JUDGED")
    ) {
      representedClusterIds.add(clusterId);
    }

    if (entry.kennelId === kennelId && entry.breedCode2 === dog.breedCode2) {
      const dogIds =
        existingBreedDogIdsByClusterId.get(clusterId) ?? new Set<string>();
      dogIds.add(entry.dogId);
      existingBreedDogIdsByClusterId.set(clusterId, dogIds);
    }
  }

  const reproState = getShowReproState(dog);
  const hasPendingEmergencyCare = dog.emergencyCareEvents.length > 0;
  const dogDto: DogShowEntryPlannerDogDto = {
    dogId: dog.id,
    callName: dog.callName,
    registeredName: dog.registeredName,
    displayName: formatDogDisplayName(dog),
    regNumber: dog.regNumber,
    breedCode2: dog.breed.code2,
    breedName: dog.breed.name,
    breedGroupName: dog.breed.groupName,
    sex: dog.sex,
    ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
    lifecycleState: dog.lifecycleState,
    marketState: dog.marketState,
    ownerKennel: {
      kennelId: dog.ownerKennel.id,
      name: dog.ownerKennel.name,
      slug: dog.ownerKennel.slug,
    },
    broadCanShow: canEnterShows(
      currentEpoch,
      dog.birthEpoch,
      dog.lifecycleState as DogStatus,
      reproState
    ),
    currentRun: dog.kennelRun
      ? {
          runId: dog.kennelRun.id,
          name: dog.kennelRun.name,
        }
      : null,
    isPregnant: reproState.isPregnant,
    lastWhelpedEpoch: reproState.lastWhelpedEpoch,
    hasPendingEmergencyCare,
    coatCondition: dog.coatCondition,
    fatiguePoints: dog.fatiguePoints,
  };
  const clusterDtos = clusters.map((cluster) => {
    const availability = getShowEntryAvailability({
      cluster,
      currentEpoch,
      hasJudgingActivity: hasJudgingActivity(cluster),
    });
    const weekendKey = getShowWeekendKey({
      clusterId: cluster.id,
      startEpoch: cluster.startEpoch,
    });
    const weekendPlan = weekendPlanByKey.get(weekendKey);
    const stewardingCommitment = stewardingCommitmentsByClusterId.get(cluster.id);
    const isStewardingThisShow = Boolean(stewardingCommitment?.isCurrentShow);
    const sameWeekendConflict = sameWeekendConflicts.get(cluster.id) ?? null;
    const dogAlreadyEnteredInCluster = dogEnteredClusterIds.has(cluster.id);
    const kennelRepresentedInCluster = representedClusterIds.has(cluster.id);
    const showRole =
      weekendPlan && weekendPlan.primaryClusterId !== cluster.id
        ? "SECONDARY"
        : "PRIMARY";
    const days = cluster.showDays.map((showDay) => {
      const alreadyEntered = existingEntriesByDayId.has(showDay.id);
      const eligibility = canEnterShowDay({
        dog,
        cluster,
        showDay,
        breedCode2: dog.breedCode2,
        currentEpoch,
      });
      let disabledReason = eligibility.ok ? null : eligibility.reason ?? null;

      if (alreadyEntered) {
        disabledReason = "This dog is already entered on this show day.";
      } else if (isStewardingThisShow) {
        disabledReason =
          "Your kennel is stewarding this show and cannot create owner-handled entries in it.";
      } else if (hasPendingEmergencyCare) {
        disabledReason =
          "Emergency vet care must be resolved before this dog can be entered.";
      } else if (sameWeekendConflict) {
        disabledReason = `This dog is already entered in ${sameWeekendConflict.clusterName} this weekend.`;
      }

      const eligible = eligibility.ok;
      const canSelect =
        eligible &&
        !alreadyEntered &&
        !isStewardingThisShow &&
        !hasPendingEmergencyCare &&
        !sameWeekendConflict;

      return {
        showDayId: showDay.id,
        dayIndex: showDay.dayIndex,
        scheduledEpoch: showDay.scheduledEpoch,
        label: formatShowCalendarLabel(showDay.scheduledEpoch),
        judgeName: showDay.judge.name,
        status: showDay.status,
        eligible,
        disabledReason,
        alreadyEntered,
        sameWeekendConflict,
        canSelect,
      };
    });
    const hasSelectableDays = days.some((day) => day.canSelect);
    const entryImpact = getEntryImpact({
      cluster,
      weekendKey,
      weekendPlan,
      isStewardingThisShow,
      dogAlreadyEnteredInCluster,
      kennelRepresentedInCluster,
    });
    const selectedDayIndices = days
      .filter((day) => day.canSelect)
      .map((day) => day.dayIndex);
    const quotePreview = buildQuotePreview({
      dog,
      cluster,
      kennelBalance: kennel.balance,
      homeDistrict: kennel.homeDistrict ?? cluster.district,
      weekendPlanExists: Boolean(weekendPlan),
      showRole,
      existingDogIdsForBreed: [
        ...(existingBreedDogIdsByClusterId.get(cluster.id) ?? new Set<string>()),
      ],
      selectedDayIndices,
    });

    return {
      showId: cluster.id,
      name: cluster.name,
      weekendKey,
      year: cluster.year,
      district: cluster.district,
      districtName: getShowDistrictRegionName(cluster.district),
      startEpoch: cluster.startEpoch,
      endEpoch: cluster.endEpoch,
      entryOpenEpoch: cluster.entryOpenEpoch,
      entryCloseEpoch: cluster.entryCloseEpoch,
      entryStatus: availability.entryStatus,
      entryStatusMessage: availability.message,
      days,
      hasSelectableDays,
      disabledReason: getClusterDisabledReason({
        days,
        isStewardingThisShow,
        hasPendingEmergencyCare,
        sameWeekendConflict,
        dogAlreadyEnteredInCluster,
      }),
      selectedByDefault: false as const,
      dogAlreadyEnteredInCluster,
      kennelRepresentedInCluster,
      hasEligibleDays: days.some((day) => day.eligible),
      entryImpact,
      quotePreview,
    };
  });

  return {
    currentEpoch,
    kennelId,
    dog: dogDto,
    clusters: clusterDtos,
  };
}
