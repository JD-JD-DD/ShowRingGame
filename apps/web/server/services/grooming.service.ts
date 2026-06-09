import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { MIN_SHOW_AGE_HOURS } from "@showring/rules";

type DbClient = typeof db | Prisma.TransactionClient;

export const GROOMING_BASE_PAY = 500;
export const TOTAL_GROOMING_ACTION_LIMIT_PER_WEEK = 10;
export const DOG_GROOM_LIMIT_PER_WEEK = 1;
export const BASE_COAT_CONDITION_GAIN = 0.2;
export const MISSED_GROOMING_DECAY = 0.05;
export const GROOMING_XP_PER_ACTION = 1;
export const GROOMING_LEVEL_XP_INTERVAL = 10;
export const GROOMING_WEEK_HOURS = 7;

const MAX_COAT_CONDITION = 20;
const MIN_COAT_CONDITION = 0;

export type KennelGroomingSummaryDto = {
  groomingActionsUsedThisWeek: number;
  groomingActionsRemainingThisWeek: number;
  totalGroomingActionLimit: number;
  selfGroomsCompletedThisWeek: number;
  outsideGroomsCompletedThisWeek: number;
  openListingsOwnedCount: number;
  groomingXp: number;
  groomingLevel: number;
  groomingActionsCompleted: number;
  outsideGroomingJobsCompleted: number;
  selfGroomingActionsCompleted: number;
};

export type OpenGroomingJobDto = {
  listingId: string;
  dogId: string;
  dogDisplayName: string;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  ownerKennelName: string;
  currentCoatCondition: number;
  groomingStatusLabel: "Groomed this week" | "Listed for grooming" | "Needs grooming";
  totalGroomingGain: number;
  totalGroomingDecay: number;
  netGroomingImpact: number;
  price: number;
  listedAtEpoch: number;
};

export type OwnedDogGroomingStatusDto = {
  dogId: string;
  groomedThisWeek: boolean;
  listedForGrooming: boolean;
  openListingId: string | null;
  currentCoatCondition: number;
  totalGroomingGain: number;
  totalGroomingDecay: number;
  netGroomingImpact: number;
  lastGroomedEpoch: number | null;
  currentGroomingWeek: number;
  groomingStatusLabel: "Groomed this week" | "Listed for grooming" | "Needs grooming";
};

export type DogGroomingConditionSummaryDto = OwnedDogGroomingStatusDto;

export type MissedGroomingDecayResultDto = {
  dogId: string;
  groomingWeek: number;
  applied: boolean;
  decayAmount: number;
  reason: string | null;
};

export type GroomingDecayMaintenanceResultDto = {
  currentGroomingWeek: number;
  completedGroomingWeek: number | null;
  checked: number;
  applied: number;
  skipped: number;
  results: MissedGroomingDecayResultDto[];
};

export type GroomingActionResultDto = {
  message: string;
  summary: KennelGroomingSummaryDto;
  dog: {
    dogId: string;
    coatCondition: number;
    coatGain: number;
  };
};

export type GroomingListingResultDto = {
  message: string;
  listing: {
    listingId: string;
    dogId: string;
    status: string;
    price: number;
  };
};

export function getGroomingWeekIndex(currentEpoch: number): number {
  return Math.floor(currentEpoch / GROOMING_WEEK_HOURS);
}

export function getGroomingWeekStartEpoch(currentEpoch: number): number {
  return getGroomingWeekIndex(currentEpoch) * GROOMING_WEEK_HOURS;
}

function getGroomingWeekStartEpochByIndex(groomingWeek: number): number {
  return groomingWeek * GROOMING_WEEK_HOURS;
}

function getGroomingWeekEndEpochByIndex(groomingWeek: number): number {
  return getGroomingWeekStartEpochByIndex(groomingWeek) + GROOMING_WEEK_HOURS;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatCoatGain(gain: number): string {
  return gain.toFixed(2);
}

function calculateGroomingLevel(xp: number): number {
  return Math.floor(xp / GROOMING_LEVEL_XP_INTERVAL);
}

function getMissedGroomingDecayKey(dogId: string, groomingWeek: number): string {
  return `missed-grooming:${dogId}:${groomingWeek}`;
}

function applyCoatGain(currentCoatCondition: number): {
  nextCoatCondition: number;
  actualGain: number;
} {
  const nextCoatCondition = Math.min(
    MAX_COAT_CONDITION,
    currentCoatCondition + BASE_COAT_CONDITION_GAIN
  );

  return {
    nextCoatCondition,
    actualGain: Math.max(0, nextCoatCondition - currentCoatCondition),
  };
}

function applyCoatDecay(
  currentCoatCondition: number,
  decayAmount: number
): {
  nextCoatCondition: number;
  actualDecay: number;
} {
  const nextCoatCondition = Math.max(
    MIN_COAT_CONDITION,
    currentCoatCondition - decayAmount
  );

  return {
    nextCoatCondition,
    actualDecay: Math.max(0, currentCoatCondition - nextCoatCondition),
  };
}

async function createGroomingGainConditionEvent(args: {
  client: DbClient;
  dogId: string;
  actorKennelId: string;
  ownerKennelIdAtEvent: string;
  conditionBefore: number;
  conditionAfter: number;
  amount: number;
  currentEpoch: number;
}) {
  if (args.amount <= 0) {
    return null;
  }

  return args.client.dogConditionEvent.create({
    data: {
      dogId: args.dogId,
      actorKennelId: args.actorKennelId,
      ownerKennelIdAtEvent: args.ownerKennelIdAtEvent,
      eventType: "GROOMING_GAIN",
      amount: args.amount,
      conditionBefore: args.conditionBefore,
      conditionAfter: args.conditionAfter,
      groomingWeek: getGroomingWeekIndex(args.currentEpoch),
      occurredAtEpoch: args.currentEpoch,
    },
  });
}

async function getOrCreateServiceProfile(args: {
  client: DbClient;
  kennelId: string;
}) {
  return args.client.kennelServiceProfile.upsert({
    where: {
      kennelId: args.kennelId,
    },
    create: {
      kennelId: args.kennelId,
    },
    update: {},
  });
}

async function incrementServiceProfile(args: {
  client: DbClient;
  kennelId: string;
  actionType: "SELF_GROOM" | "OUTSIDE_GROOM";
}) {
  const existing = await getOrCreateServiceProfile(args);
  const groomingXp = existing.groomingXp + GROOMING_XP_PER_ACTION;

  return args.client.kennelServiceProfile.update({
    where: {
      kennelId: args.kennelId,
    },
    data: {
      groomingXp,
      groomingLevel: calculateGroomingLevel(groomingXp),
      groomingActionsCompleted: {
        increment: 1,
      },
      ...(args.actionType === "SELF_GROOM"
        ? {
            selfGroomingActionsCompleted: {
              increment: 1,
            },
          }
        : {
            outsideGroomingJobsCompleted: {
              increment: 1,
            },
          }),
    },
  });
}

async function countKennelActionsThisWeek(args: {
  client: DbClient;
  kennelId: string;
  currentEpoch: number;
}) {
  const weekStartEpoch = getGroomingWeekStartEpoch(args.currentEpoch);

  return args.client.groomingServiceAction.groupBy({
    by: ["actionType"],
    where: {
      groomerKennelId: args.kennelId,
      occurredAtEpoch: {
        gte: weekStartEpoch,
      },
    },
    _count: {
      _all: true,
    },
  });
}

async function getDogGroomingActionThisWeek(args: {
  client: DbClient;
  dogId: string;
  currentEpoch: number;
}) {
  return args.client.groomingServiceAction.findFirst({
    where: {
      dogId: args.dogId,
      occurredAtEpoch: {
        gte: getGroomingWeekStartEpoch(args.currentEpoch),
      },
    },
    select: {
      id: true,
    },
  });
}

async function assertKennelHasGroomingCapacity(args: {
  client: DbClient;
  kennelId: string;
  currentEpoch: number;
}) {
  const actionsUsed = await args.client.groomingServiceAction.count({
    where: {
      groomerKennelId: args.kennelId,
      occurredAtEpoch: {
        gte: getGroomingWeekStartEpoch(args.currentEpoch),
      },
    },
  });

  if (actionsUsed >= TOTAL_GROOMING_ACTION_LIMIT_PER_WEEK) {
    throw new Error("Your kennel has used all 10 grooming actions this week.");
  }
}

async function assertDogNotGroomedThisWeek(args: {
  client: DbClient;
  dogId: string;
  currentEpoch: number;
}) {
  const existing = await getDogGroomingActionThisWeek(args);

  if (existing) {
    throw new Error("This dog has already been groomed this week.");
  }
}

export async function getKennelGroomingSummary(args: {
  kennelId: string;
  currentEpoch: number;
  client?: DbClient;
}): Promise<KennelGroomingSummaryDto> {
  const client = args.client ?? db;
  const [actionCounts, openListingsOwnedCount, profile] = await Promise.all([
    countKennelActionsThisWeek({
      client,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
    }),
    client.groomingListing.count({
      where: {
        ownerKennelId: args.kennelId,
        status: "OPEN",
      },
    }),
    getOrCreateServiceProfile({
      client,
      kennelId: args.kennelId,
    }),
  ]);
  const selfGroomsCompletedThisWeek =
    actionCounts.find((row) => row.actionType === "SELF_GROOM")?._count._all ??
    0;
  const outsideGroomsCompletedThisWeek =
    actionCounts.find((row) => row.actionType === "OUTSIDE_GROOM")?._count
      ._all ?? 0;
  const groomingActionsUsedThisWeek =
    selfGroomsCompletedThisWeek + outsideGroomsCompletedThisWeek;

  return {
    groomingActionsUsedThisWeek,
    groomingActionsRemainingThisWeek: Math.max(
      0,
      TOTAL_GROOMING_ACTION_LIMIT_PER_WEEK - groomingActionsUsedThisWeek
    ),
    totalGroomingActionLimit: TOTAL_GROOMING_ACTION_LIMIT_PER_WEEK,
    selfGroomsCompletedThisWeek,
    outsideGroomsCompletedThisWeek,
    openListingsOwnedCount,
    groomingXp: profile.groomingXp,
    groomingLevel: profile.groomingLevel,
    groomingActionsCompleted: profile.groomingActionsCompleted,
    outsideGroomingJobsCompleted: profile.outsideGroomingJobsCompleted,
    selfGroomingActionsCompleted: profile.selfGroomingActionsCompleted,
  };
}

export async function getOwnedDogGroomingStatuses(args: {
  kennelId: string;
  dogIds: string[];
  currentEpoch: number;
}): Promise<Map<string, OwnedDogGroomingStatusDto>> {
  const dogIds = [...new Set(args.dogIds)].filter(Boolean);
  const statuses = new Map<string, OwnedDogGroomingStatusDto>();
  const currentGroomingWeek = getGroomingWeekIndex(args.currentEpoch);

  for (const dogId of dogIds) {
    statuses.set(dogId, {
      dogId,
      groomedThisWeek: false,
      listedForGrooming: false,
      openListingId: null,
      currentCoatCondition: 0,
      totalGroomingGain: 0,
      totalGroomingDecay: 0,
      netGroomingImpact: 0,
      lastGroomedEpoch: null,
      currentGroomingWeek,
      groomingStatusLabel: "Needs grooming",
    });
  }

  if (dogIds.length === 0) {
    return statuses;
  }

  const weekStartEpoch = getGroomingWeekStartEpoch(args.currentEpoch);
  const [dogs, actions, lastGrooms, listings, conditionTotals] = await Promise.all([
    db.dog.findMany({
      where: {
        id: {
          in: dogIds,
        },
        ownerKennelId: args.kennelId,
      },
      select: {
        id: true,
        coatCondition: true,
      },
    }),
    db.groomingServiceAction.findMany({
      where: {
        dogId: {
          in: dogIds,
        },
        occurredAtEpoch: {
          gte: weekStartEpoch,
        },
      },
      select: {
        dogId: true,
      },
    }),
    db.groomingServiceAction.findMany({
      where: {
        dogId: {
          in: dogIds,
        },
      },
      orderBy: [{ dogId: "asc" }, { occurredAtEpoch: "desc" }],
      distinct: ["dogId"],
      select: {
        dogId: true,
        occurredAtEpoch: true,
      },
    }),
    db.groomingListing.findMany({
      where: {
        dogId: {
          in: dogIds,
        },
        ownerKennelId: args.kennelId,
        status: "OPEN",
      },
      select: {
        id: true,
        dogId: true,
      },
    }),
    db.dogConditionEvent.groupBy({
      by: ["dogId", "eventType"],
      where: {
        dogId: {
          in: dogIds,
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  for (const dog of dogs) {
    const status = statuses.get(dog.id);
    if (!status) continue;
    status.currentCoatCondition = dog.coatCondition;
  }

  for (const action of actions) {
    const status = statuses.get(action.dogId);
    if (!status) continue;
    status.groomedThisWeek = true;
    status.groomingStatusLabel = "Groomed this week";
  }

  for (const lastGroom of lastGrooms) {
    const status = statuses.get(lastGroom.dogId);
    if (!status) continue;
    status.lastGroomedEpoch = lastGroom.occurredAtEpoch;
  }

  for (const listing of listings) {
    const status = statuses.get(listing.dogId);
    if (!status) continue;
    status.listedForGrooming = true;
    status.openListingId = listing.id;
    if (!status.groomedThisWeek) {
      status.groomingStatusLabel = "Listed for grooming";
    }
  }

  for (const total of conditionTotals) {
    const status = statuses.get(total.dogId);
    const amount = total._sum.amount ?? 0;
    if (!status) continue;

    if (total.eventType === "GROOMING_GAIN") {
      status.totalGroomingGain = amount;
    } else if (total.eventType === "MISSED_GROOMING_DECAY") {
      status.totalGroomingDecay = Math.abs(amount);
    }
  }

  for (const status of statuses.values()) {
    status.netGroomingImpact = Math.max(
      0,
      status.totalGroomingGain - status.totalGroomingDecay
    );
  }

  return statuses;
}

export async function getDogGroomingConditionSummary(args: {
  dogId: string;
  currentEpoch: number;
}): Promise<DogGroomingConditionSummaryDto | null> {
  const dog = await db.dog.findUnique({
    where: {
      id: args.dogId,
    },
    select: {
      ownerKennelId: true,
    },
  });

  if (!dog?.ownerKennelId) {
    return null;
  }

  const summaries = await getOwnedDogGroomingStatuses({
    kennelId: dog.ownerKennelId,
    dogIds: [args.dogId],
    currentEpoch: args.currentEpoch,
  });

  return summaries.get(args.dogId) ?? null;
}

export async function selfGroomDog(args: {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
}): Promise<GroomingActionResultDto> {
  return db.$transaction(async (tx) => {
    const dog = await tx.dog.findUnique({
      where: {
        id: args.dogId,
      },
      select: {
        id: true,
        regNumber: true,
        registeredName: true,
        callName: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        ownerKennelId: true,
        lifecycleState: true,
        coatCondition: true,
        isPlayerVisible: true,
      },
    });

    if (!dog || dog.ownerKennelId !== args.kennelId || !dog.isPlayerVisible) {
      throw new Error("Dog not found.");
    }

    if (dog.lifecycleState !== "ALIVE") {
      throw new Error("Only living dogs can be groomed.");
    }

    await assertDogNotGroomedThisWeek({
      client: tx,
      dogId: dog.id,
      currentEpoch: args.currentEpoch,
    });
    await assertKennelHasGroomingCapacity({
      client: tx,
      kennelId: args.kennelId,
      currentEpoch: args.currentEpoch,
    });

    const openListing = await tx.groomingListing.findFirst({
      where: {
        dogId: dog.id,
        ownerKennelId: args.kennelId,
        status: "OPEN",
      },
      select: {
        id: true,
      },
    });

    if (openListing) {
      throw new Error(
        "This dog is currently listed for outside grooming. Cancel the listing before grooming this dog yourself."
      );
    }

    const { nextCoatCondition, actualGain } = applyCoatGain(dog.coatCondition);
    const updatedDog = await tx.dog.update({
      where: {
        id: dog.id,
      },
      data: {
        coatCondition: nextCoatCondition,
      },
      select: {
        coatCondition: true,
      },
    });

    await tx.groomingServiceAction.create({
      data: {
        dogId: dog.id,
        ownerKennelId: args.kennelId,
        groomerKennelId: args.kennelId,
        actionType: "SELF_GROOM",
        amountPaid: 0,
        coatGain: actualGain,
        occurredAtEpoch: args.currentEpoch,
      },
    });
    await createGroomingGainConditionEvent({
      client: tx,
      dogId: dog.id,
      actorKennelId: args.kennelId,
      ownerKennelIdAtEvent: args.kennelId,
      conditionBefore: dog.coatCondition,
      conditionAfter: updatedDog.coatCondition,
      amount: actualGain,
      currentEpoch: args.currentEpoch,
    });
    await incrementServiceProfile({
      client: tx,
      kennelId: args.kennelId,
      actionType: "SELF_GROOM",
    });

    return {
      message: `You groomed ${formatDogDisplayName(
        dog
      )}. Coat condition improved by ${formatCoatGain(actualGain)}.`,
      summary: await getKennelGroomingSummary({
        kennelId: args.kennelId,
        currentEpoch: args.currentEpoch,
        client: tx,
      }),
      dog: {
        dogId: dog.id,
        coatCondition: updatedDog.coatCondition,
        coatGain: actualGain,
      },
    };
  });
}

export async function listDogForOutsideGrooming(args: {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
}): Promise<GroomingListingResultDto> {
  return db.$transaction(async (tx) => {
    const dog = await tx.dog.findUnique({
      where: {
        id: args.dogId,
      },
      select: {
        id: true,
        regNumber: true,
        registeredName: true,
        callName: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        ownerKennelId: true,
        lifecycleState: true,
        isPlayerVisible: true,
      },
    });

    if (!dog || dog.ownerKennelId !== args.kennelId || !dog.isPlayerVisible) {
      throw new Error("Dog not found.");
    }

    if (dog.lifecycleState !== "ALIVE") {
      throw new Error("Only living dogs can be offered for grooming.");
    }

    await assertDogNotGroomedThisWeek({
      client: tx,
      dogId: dog.id,
      currentEpoch: args.currentEpoch,
    });

    const openListing = await tx.groomingListing.findFirst({
      where: {
        dogId: dog.id,
        ownerKennelId: args.kennelId,
        status: "OPEN",
      },
      select: {
        id: true,
      },
    });

    if (openListing) {
      throw new Error("This dog already has an open grooming listing.");
    }

    const listing = await tx.groomingListing.create({
      data: {
        dogId: dog.id,
        ownerKennelId: args.kennelId,
        status: "OPEN",
        price: GROOMING_BASE_PAY,
        listedAtEpoch: args.currentEpoch,
      },
      select: {
        id: true,
        dogId: true,
        status: true,
        price: true,
      },
    });

    return {
      message: `${formatDogDisplayName(
        dog
      )} has been offered for outside grooming. The grooming kennel will be paid ${formatMoney(
        GROOMING_BASE_PAY
      )} by the game. Your kennel will not be charged during this stage of development.`,
      listing: {
        listingId: listing.id,
        dogId: listing.dogId,
        status: listing.status,
        price: listing.price,
      },
    };
  });
}

export async function cancelGroomingListing(args: {
  kennelId: string;
  listingId: string;
}) {
  const listing = await db.groomingListing.findUnique({
    where: {
      id: args.listingId,
    },
    select: {
      id: true,
      ownerKennelId: true,
      status: true,
    },
  });

  if (!listing || listing.ownerKennelId !== args.kennelId) {
    throw new Error("Grooming listing not found.");
  }

  if (listing.status !== "OPEN") {
    throw new Error("Only open grooming listings can be cancelled.");
  }

  return db.groomingListing.update({
    where: {
      id: listing.id,
    },
    data: {
      status: "CANCELLED",
    },
  });
}

export async function listOpenGroomingJobs(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<OpenGroomingJobDto[]> {
  const weekStartEpoch = getGroomingWeekStartEpoch(args.currentEpoch);
  const listings = await db.groomingListing.findMany({
    where: {
      status: "OPEN",
      ownerKennelId: {
        not: args.kennelId,
      },
      dog: {
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        groomingServiceActions: {
          none: {
            occurredAtEpoch: {
              gte: weekStartEpoch,
            },
          },
        },
      },
    },
    orderBy: [{ listedAtEpoch: "asc" }, { createdAt: "asc" }],
    take: 30,
    select: {
      id: true,
      price: true,
      listedAtEpoch: true,
      dog: {
        select: {
          id: true,
          regNumber: true,
          registeredName: true,
          callName: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
          breedCode2: true,
          coatCondition: true,
          breed: {
            select: {
              name: true,
            },
          },
        },
      },
      ownerKennel: {
        select: {
          name: true,
        },
      },
    },
  });
  const dogIds = listings.map((listing) => listing.dog.id);
  const conditionTotals =
    dogIds.length > 0
      ? await db.dogConditionEvent.groupBy({
          by: ["dogId", "eventType"],
          where: {
            dogId: {
              in: dogIds,
            },
          },
          _sum: {
            amount: true,
          },
        })
      : [];
  const totalsByDogId = new Map<
    string,
    { totalGroomingGain: number; totalGroomingDecay: number }
  >();

  for (const total of conditionTotals) {
    const existing = totalsByDogId.get(total.dogId) ?? {
      totalGroomingGain: 0,
      totalGroomingDecay: 0,
    };
    const amount = total._sum.amount ?? 0;

    if (total.eventType === "GROOMING_GAIN") {
      existing.totalGroomingGain = amount;
    } else if (total.eventType === "MISSED_GROOMING_DECAY") {
      existing.totalGroomingDecay = Math.abs(amount);
    }

    totalsByDogId.set(total.dogId, existing);
  }

  return listings.map((listing) => {
    const totals = totalsByDogId.get(listing.dog.id) ?? {
      totalGroomingGain: 0,
      totalGroomingDecay: 0,
    };

    return {
      listingId: listing.id,
      dogId: listing.dog.id,
      dogDisplayName: formatDogDisplayName(listing.dog),
      regNumber: listing.dog.regNumber,
      breedCode2: listing.dog.breedCode2,
      breedName: listing.dog.breed.name,
      ownerKennelName: listing.ownerKennel.name,
      currentCoatCondition: listing.dog.coatCondition,
      groomingStatusLabel: "Listed for grooming",
      totalGroomingGain: totals.totalGroomingGain,
      totalGroomingDecay: totals.totalGroomingDecay,
      netGroomingImpact: Math.max(
        0,
        totals.totalGroomingGain - totals.totalGroomingDecay
      ),
      price: listing.price,
      listedAtEpoch: listing.listedAtEpoch,
    };
  });
}

export async function acceptGroomingJob(args: {
  groomerKennelId: string;
  listingId: string;
  currentEpoch: number;
}): Promise<GroomingActionResultDto> {
  return db.$transaction(async (tx) => {
    const listing = await tx.groomingListing.findUnique({
      where: {
        id: args.listingId,
      },
      select: {
        id: true,
        status: true,
        ownerKennelId: true,
        price: true,
        dog: {
          select: {
            id: true,
            regNumber: true,
            registeredName: true,
            callName: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            lifecycleState: true,
            coatCondition: true,
            isPlayerVisible: true,
          },
        },
      },
    });

    if (!listing || listing.status !== "OPEN") {
      throw new Error("This grooming job is no longer available.");
    }

    if (listing.ownerKennelId === args.groomerKennelId) {
      throw new Error("You cannot accept your own kennel's grooming listing.");
    }

    if (!listing.dog.isPlayerVisible || listing.dog.lifecycleState !== "ALIVE") {
      throw new Error("This dog is no longer eligible for grooming.");
    }

    await assertDogNotGroomedThisWeek({
      client: tx,
      dogId: listing.dog.id,
      currentEpoch: args.currentEpoch,
    });
    await assertKennelHasGroomingCapacity({
      client: tx,
      kennelId: args.groomerKennelId,
      currentEpoch: args.currentEpoch,
    });

    const listingClaim = await tx.groomingListing.updateMany({
      where: {
        id: listing.id,
        status: "OPEN",
      },
      data: {
        status: "COMPLETED",
        groomerKennelId: args.groomerKennelId,
        completedAtEpoch: args.currentEpoch,
      },
    });

    if (listingClaim.count === 0) {
      throw new Error("This grooming job is no longer available.");
    }

    const { nextCoatCondition, actualGain } = applyCoatGain(
      listing.dog.coatCondition
    );
    const [updatedDog, updatedKennel, groomerKennel] = await Promise.all([
      tx.dog.update({
        where: {
          id: listing.dog.id,
        },
        data: {
          coatCondition: nextCoatCondition,
        },
        select: {
          coatCondition: true,
        },
      }),
      tx.kennel.update({
        where: {
          id: args.groomerKennelId,
        },
        data: {
          balance: {
            increment: listing.price,
          },
        },
        select: {
          id: true,
          name: true,
          balance: true,
        },
      }),
      tx.kennel.findUnique({
        where: {
          id: args.groomerKennelId,
        },
        select: {
          name: true,
        },
      }),
    ]);
    await tx.groomingServiceAction.create({
      data: {
        dogId: listing.dog.id,
        ownerKennelId: listing.ownerKennelId,
        groomerKennelId: args.groomerKennelId,
        listingId: listing.id,
        actionType: "OUTSIDE_GROOM",
        amountPaid: listing.price,
        coatGain: actualGain,
        occurredAtEpoch: args.currentEpoch,
      },
    });
    await createGroomingGainConditionEvent({
      client: tx,
      dogId: listing.dog.id,
      actorKennelId: args.groomerKennelId,
      ownerKennelIdAtEvent: listing.ownerKennelId,
      conditionBefore: listing.dog.coatCondition,
      conditionAfter: updatedDog.coatCondition,
      amount: actualGain,
      currentEpoch: args.currentEpoch,
    });
    await tx.ledgerTransaction.create({
      data: {
        kennelId: args.groomerKennelId,
        transactionType: "GROOMING_INCOME",
        amount: listing.price,
        balanceAfter: updatedKennel.balance,
        occurredAtEpoch: args.currentEpoch,
        dogId: listing.dog.id,
        counterpartyKennelId: listing.ownerKennelId,
        memo: `Groomed ${formatDogDisplayName(listing.dog)} / ${
          listing.dog.regNumber
        }`,
        metadataJson: {
          serviceType: "GROOMING_ASSISTANCE",
          listingId: listing.id,
        },
      },
    });
    await incrementServiceProfile({
      client: tx,
      kennelId: args.groomerKennelId,
      actionType: "OUTSIDE_GROOM",
    });
    await createKennelNotice({
      client: tx,
      kennelId: listing.ownerKennelId,
      type: "KENNEL_SERVICE",
      title: "Grooming assistance",
      body: `${groomerKennel?.name ?? "Another kennel"} groomed ${formatDogDisplayName(
        listing.dog
      )}. Coat condition improved by ${formatCoatGain(actualGain)}.`,
      currentEpoch: args.currentEpoch,
      linkedDogId: listing.dog.id,
      metadataJson: {
        serviceType: "GROOMING_ASSISTANCE",
        listingId: listing.id,
      },
    });

    return {
      message: `You were paid ${formatMoney(listing.price)} for grooming ${formatDogDisplayName(
        listing.dog
      )}.`,
      summary: await getKennelGroomingSummary({
        kennelId: args.groomerKennelId,
        currentEpoch: args.currentEpoch,
        client: tx,
      }),
      dog: {
        dogId: listing.dog.id,
        coatCondition: updatedDog.coatCondition,
        coatGain: actualGain,
      },
    };
  });
}

async function getDogNetGroomingImpact(args: {
  client: DbClient;
  dogId: string;
}): Promise<{
  totalGroomingGain: number;
  totalGroomingDecay: number;
  netGroomingImpact: number;
}> {
  const totals = await args.client.dogConditionEvent.groupBy({
    by: ["eventType"],
    where: {
      dogId: args.dogId,
    },
    _sum: {
      amount: true,
    },
  });
  const totalGroomingGain =
    totals.find((row) => row.eventType === "GROOMING_GAIN")?._sum.amount ?? 0;
  const totalGroomingDecay = Math.abs(
    totals.find((row) => row.eventType === "MISSED_GROOMING_DECAY")?._sum
      .amount ?? 0
  );

  return {
    totalGroomingGain,
    totalGroomingDecay,
    netGroomingImpact: Math.max(0, totalGroomingGain - totalGroomingDecay),
  };
}

export async function applyMissedGroomingDecayForCompletedWeek(args: {
  dogId: string;
  completedGroomingWeek: number;
  currentEpoch: number;
}): Promise<MissedGroomingDecayResultDto> {
  const currentGroomingWeek = getGroomingWeekIndex(args.currentEpoch);
  const decayKey = getMissedGroomingDecayKey(
    args.dogId,
    args.completedGroomingWeek
  );

  if (args.completedGroomingWeek >= currentGroomingWeek) {
    return {
      dogId: args.dogId,
      groomingWeek: args.completedGroomingWeek,
      applied: false,
      decayAmount: 0,
      reason: "Cannot decay the active grooming week.",
    };
  }

  try {
    return await db.$transaction(async (tx) => {
      const dog = await tx.dog.findUnique({
        where: {
          id: args.dogId,
        },
        select: {
          id: true,
          ownerKennelId: true,
          lifecycleState: true,
          visibilityState: true,
          isPlayerVisible: true,
          birthEpoch: true,
          coatCondition: true,
        },
      });

      if (!dog) {
        return {
          dogId: args.dogId,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Dog not found.",
        };
      }

      const completedWeekStart = getGroomingWeekStartEpochByIndex(
        args.completedGroomingWeek
      );
      const completedWeekEnd = getGroomingWeekEndEpochByIndex(
        args.completedGroomingWeek
      );
      const ageAtCompletedWeekEnd = completedWeekEnd - dog.birthEpoch;

      if (
        dog.ownerKennelId === null ||
        dog.lifecycleState !== "ALIVE" ||
        dog.visibilityState !== "VISIBLE" ||
        !dog.isPlayerVisible ||
        ageAtCompletedWeekEnd < MIN_SHOW_AGE_HOURS
      ) {
        return {
          dogId: dog.id,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Dog is not eligible for grooming decay.",
        };
      }

      const [groomedThisWeek, existingDecay] = await Promise.all([
        tx.groomingServiceAction.findFirst({
          where: {
            dogId: dog.id,
            occurredAtEpoch: {
              gte: completedWeekStart,
              lt: completedWeekEnd,
            },
          },
          select: {
            id: true,
          },
        }),
        tx.dogConditionEvent.findUnique({
          where: {
            decayKey,
          },
          select: {
            id: true,
          },
        }),
      ]);

      if (groomedThisWeek) {
        return {
          dogId: dog.id,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Dog was groomed during the completed grooming week.",
        };
      }

      if (existingDecay) {
        return {
          dogId: dog.id,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Decay already applied for this grooming week.",
        };
      }

      const { netGroomingImpact } = await getDogNetGroomingImpact({
        client: tx,
        dogId: dog.id,
      });

      if (netGroomingImpact <= 0) {
        return {
          dogId: dog.id,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Dog has no positive grooming impact to decay.",
        };
      }

      const requestedDecayAmount = Math.min(
        MISSED_GROOMING_DECAY,
        netGroomingImpact
      );
      const { nextCoatCondition, actualDecay } = applyCoatDecay(
        dog.coatCondition,
        requestedDecayAmount
      );

      if (actualDecay <= 0) {
        return {
          dogId: dog.id,
          groomingWeek: args.completedGroomingWeek,
          applied: false,
          decayAmount: 0,
          reason: "Dog coat condition is already at the minimum.",
        };
      }

      await tx.dog.update({
        where: {
          id: dog.id,
        },
        data: {
          coatCondition: nextCoatCondition,
        },
      });
      await tx.dogConditionEvent.create({
        data: {
          dogId: dog.id,
          actorKennelId: null,
          ownerKennelIdAtEvent: dog.ownerKennelId,
          eventType: "MISSED_GROOMING_DECAY",
          amount: -actualDecay,
          conditionBefore: dog.coatCondition,
          conditionAfter: nextCoatCondition,
          groomingWeek: args.completedGroomingWeek,
          occurredAtEpoch: args.currentEpoch,
          decayKey,
          note: "Missed grooming decay for completed grooming week.",
        },
      });

      return {
        dogId: dog.id,
        groomingWeek: args.completedGroomingWeek,
        applied: true,
        decayAmount: actualDecay,
        reason: null,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        dogId: args.dogId,
        groomingWeek: args.completedGroomingWeek,
        applied: false,
        decayAmount: 0,
        reason: "Decay already applied for this grooming week.",
      };
    }

    throw error;
  }
}

export async function applyMissedGroomingDecayForDueDogs(args: {
  currentEpoch: number;
  limit?: number;
}): Promise<GroomingDecayMaintenanceResultDto> {
  const currentGroomingWeek = getGroomingWeekIndex(args.currentEpoch);
  const completedGroomingWeek = currentGroomingWeek - 1;
  const limit = args.limit ?? 100;

  if (completedGroomingWeek < 0) {
    return {
      currentGroomingWeek,
      completedGroomingWeek: null,
      checked: 0,
      applied: 0,
      skipped: 0,
      results: [],
    };
  }

  const completedWeekStart = getGroomingWeekStartEpochByIndex(
    completedGroomingWeek
  );
  const completedWeekEnd = getGroomingWeekEndEpochByIndex(
    completedGroomingWeek
  );
  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: {
        not: null,
      },
      lifecycleState: "ALIVE",
      visibilityState: "VISIBLE",
      isPlayerVisible: true,
      birthEpoch: {
        lte: completedWeekEnd - MIN_SHOW_AGE_HOURS,
      },
      groomingServiceActions: {
        none: {
          occurredAtEpoch: {
            gte: completedWeekStart,
            lt: completedWeekEnd,
          },
        },
      },
      conditionEvents: {
        none: {
          eventType: "MISSED_GROOMING_DECAY",
          groomingWeek: completedGroomingWeek,
        },
      },
    },
    orderBy: [{ birthEpoch: "asc" }, { regNumber: "asc" }],
    take: limit,
    select: {
      id: true,
    },
  });
  const results: MissedGroomingDecayResultDto[] = [];

  for (const dog of dogs) {
    results.push(
      await applyMissedGroomingDecayForCompletedWeek({
        dogId: dog.id,
        completedGroomingWeek,
        currentEpoch: args.currentEpoch,
      })
    );
  }

  const applied = results.filter((result) => result.applied).length;

  return {
    currentGroomingWeek,
    completedGroomingWeek,
    checked: results.length,
    applied,
    skipped: results.length - applied,
    results,
  };
}
