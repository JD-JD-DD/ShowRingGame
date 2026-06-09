import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";

type DbClient = typeof db | Prisma.TransactionClient;

export const GROOMING_BASE_PAY = 500;
export const TOTAL_GROOMING_ACTION_LIMIT_PER_WEEK = 10;
export const DOG_GROOM_LIMIT_PER_WEEK = 1;
export const BASE_COAT_CONDITION_GAIN = 0.2;
export const GROOMING_XP_PER_ACTION = 1;
export const GROOMING_LEVEL_XP_INTERVAL = 10;
export const GROOMING_WEEK_HOURS = 7;

const MAX_COAT_CONDITION = 20;

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
  price: number;
  listedAtEpoch: number;
};

export type OwnedDogGroomingStatusDto = {
  dogId: string;
  groomedThisWeek: boolean;
  openListingId: string | null;
  groomingStatusLabel: "Groomed this week" | "Listed for grooming" | "Needs grooming";
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

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatCoatGain(gain: number): string {
  return gain.toFixed(2);
}

function calculateGroomingLevel(xp: number): number {
  return Math.floor(xp / GROOMING_LEVEL_XP_INTERVAL);
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

  for (const dogId of dogIds) {
    statuses.set(dogId, {
      dogId,
      groomedThisWeek: false,
      openListingId: null,
      groomingStatusLabel: "Needs grooming",
    });
  }

  if (dogIds.length === 0) {
    return statuses;
  }

  const weekStartEpoch = getGroomingWeekStartEpoch(args.currentEpoch);
  const [actions, listings] = await Promise.all([
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
  ]);

  for (const action of actions) {
    const status = statuses.get(action.dogId);
    if (!status) continue;
    status.groomedThisWeek = true;
    status.groomingStatusLabel = "Groomed this week";
  }

  for (const listing of listings) {
    const status = statuses.get(listing.dogId);
    if (!status) continue;
    status.openListingId = listing.id;
    if (!status.groomedThisWeek) {
      status.groomingStatusLabel = "Listed for grooming";
    }
  }

  return statuses;
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

  return listings.map((listing) => ({
    listingId: listing.id,
    dogId: listing.dog.id,
    dogDisplayName: formatDogDisplayName(listing.dog),
    regNumber: listing.dog.regNumber,
    breedCode2: listing.dog.breedCode2,
    breedName: listing.dog.breed.name,
    ownerKennelName: listing.ownerKennel.name,
    currentCoatCondition: listing.dog.coatCondition,
    price: listing.price,
    listedAtEpoch: listing.listedAtEpoch,
  }));
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
