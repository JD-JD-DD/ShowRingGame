import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { getShowEntryAvailability } from "@/server/services/showAvailability.service";
import {
  getShowDistrictRegionName,
  getShowWeekendKey,
} from "@showring/rules";

const CLUB_STEWARDING_TWO_DAY_PAYOUT = 1_500;
const CLUB_STEWARDING_FOUR_DAY_PAYOUT = 3_000;

type StewardingCluster = {
  id: string;
  name: string;
  district: number;
  startEpoch: number;
  endEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  status: string;
  showDays: Array<{
    id: string;
    status: string;
    scheduledEpoch: number;
    _count: {
      showResults: number;
    };
  }>;
};

export type StewardingOpportunityDto = {
  showClusterId: string;
  name: string;
  district: number;
  districtName: string;
  startEpoch: number;
  endEpoch: number;
  dayCount: number;
  weekendKey: string;
  payoutAmount: number;
  alreadyStewarded: boolean;
  blockedReason: string | null;
  canClaim: boolean;
};

export type StewardingClaimResultDto = {
  claimId: string;
  showClusterId: string;
  payoutAmount: number;
  balanceAfter: number;
};

function getWeekendKeyForCluster(
  cluster: Pick<StewardingCluster, "id" | "startEpoch">
): string {
  return getShowWeekendKey({
    clusterId: cluster.id,
    startEpoch: cluster.startEpoch,
  });
}

function getClubStewardingPayout(dayCount: number): number {
  if (dayCount >= 4) {
    return CLUB_STEWARDING_FOUR_DAY_PAYOUT;
  }

  // Show clusters currently expose days, not an explicit 2-day/4-day flag.
  // Treat anything below four days as the conservative weekend payout.
  return CLUB_STEWARDING_TWO_DAY_PAYOUT;
}

function hasJudgingActivity(cluster: StewardingCluster): boolean {
  return cluster.showDays.some(
    (day) =>
      day.status === "JUDGING" ||
      day.status === "RESULTS_PUBLISHED" ||
      day._count.showResults > 0
  );
}

function getBaseIneligibilityReason(
  cluster: StewardingCluster,
  currentEpoch: number
): string | null {
  const availability = getShowEntryAvailability({
    cluster,
    currentEpoch,
    hasJudgingActivity: hasJudgingActivity(cluster),
  });

  if (
    availability.entryStatus === "CANCELLED" ||
    availability.entryStatus === "JUDGING" ||
    availability.entryStatus === "RESULTS_PUBLISHED"
  ) {
    return "Stewarding is no longer available for this show.";
  }

  return null;
}

async function getExactClusterEntryCount(args: {
  client: typeof db | Prisma.TransactionClient;
  kennelId: string;
  showClusterId: string;
}): Promise<number> {
  return args.client.showEntry.count({
    where: {
      kennelId: args.kennelId,
      showDay: {
        clusterId: args.showClusterId,
      },
    },
  });
}

export async function hasClubStewardingClaimForCluster(args: {
  client: typeof db | Prisma.TransactionClient;
  kennelId: string;
  showClusterId: string;
}): Promise<boolean> {
  const claim = await args.client.kennelServiceClaim.findFirst({
    where: {
      kennelId: args.kennelId,
      serviceType: "CLUB_STEWARDING",
      showClusterId: args.showClusterId,
      status: {
        in: ["CLAIMED", "COMPLETED"],
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(claim);
}

export async function listStewardingOpportunities(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<StewardingOpportunityDto[]> {
  const clusters = await db.showCluster.findMany({
    where: {
      status: {
        notIn: ["CANCELLED", "COMPLETE"],
      },
      endEpoch: {
        gt: args.currentEpoch,
      },
    },
    orderBy: [{ startEpoch: "asc" }, { name: "asc" }],
    take: 24,
    select: {
      id: true,
      name: true,
      district: true,
      startEpoch: true,
      endEpoch: true,
      entryOpenEpoch: true,
      entryCloseEpoch: true,
      status: true,
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        select: {
          id: true,
          status: true,
          scheduledEpoch: true,
          _count: {
            select: {
              showResults: true,
            },
          },
        },
      },
    },
  });
  const weekendKeys = clusters.map((cluster) => getWeekendKeyForCluster(cluster));
  const clusterIds = clusters.map((cluster) => cluster.id);
  const [claims, entryCounts] = await Promise.all([
    db.kennelServiceClaim.findMany({
      where: {
        kennelId: args.kennelId,
        serviceType: "CLUB_STEWARDING",
        status: {
          in: ["CLAIMED", "COMPLETED"],
        },
        OR: [
          {
            showClusterId: {
              in: clusterIds,
            },
          },
          {
            weekendKey: {
              in: weekendKeys,
            },
          },
        ],
      },
      select: {
        showClusterId: true,
        weekendKey: true,
      },
    }),
    db.showEntry.groupBy({
      by: ["showDayId"],
      where: {
        kennelId: args.kennelId,
        showDay: {
          clusterId: {
            in: clusterIds,
          },
        },
      },
      _count: {
        _all: true,
      },
    }),
  ]);
  const claimedClusterIds = new Set(
    claims.map((claim) => claim.showClusterId).filter(Boolean)
  );
  const claimedWeekendKeys = new Set(
    claims.map((claim) => claim.weekendKey).filter(Boolean)
  );
  const entryCountsByClusterId = new Map<string, number>();

  if (entryCounts.length > 0) {
    const showDays = await db.showDay.findMany({
      where: {
        id: {
          in: entryCounts.map((row) => row.showDayId),
        },
      },
      select: {
        id: true,
        clusterId: true,
      },
    });
    const clusterByShowDayId = new Map(
      showDays.map((day) => [day.id, day.clusterId])
    );

    for (const row of entryCounts) {
      const clusterId = clusterByShowDayId.get(row.showDayId);
      if (!clusterId) continue;
      entryCountsByClusterId.set(
        clusterId,
        (entryCountsByClusterId.get(clusterId) ?? 0) + row._count._all
      );
    }
  }

  return clusters.map((cluster) => {
    const weekendKey = getWeekendKeyForCluster(cluster);
    const alreadyStewarded = claimedClusterIds.has(cluster.id);
    const sameWindowClaimed =
      !alreadyStewarded && claimedWeekendKeys.has(weekendKey);
    const hasExactEntries = (entryCountsByClusterId.get(cluster.id) ?? 0) > 0;
    const baseReason = getBaseIneligibilityReason(cluster, args.currentEpoch);
    const blockedReason =
      baseReason ??
      (alreadyStewarded
        ? "You have already claimed stewarding for this show."
        : sameWindowClaimed
          ? "You already have a stewarding assignment in this show weekend."
          : hasExactEntries
            ? "You already have entries in this show."
            : null);

    return {
      showClusterId: cluster.id,
      name: cluster.name,
      district: cluster.district,
      districtName: getShowDistrictRegionName(cluster.district),
      startEpoch: cluster.startEpoch,
      endEpoch: cluster.endEpoch,
      dayCount: cluster.showDays.length,
      weekendKey,
      payoutAmount: getClubStewardingPayout(cluster.showDays.length),
      alreadyStewarded,
      blockedReason,
      canClaim: blockedReason === null,
    };
  });
}

export async function claimStewardingAssignment(args: {
  kennelId: string;
  showClusterId: string;
  currentEpoch: number;
}): Promise<StewardingClaimResultDto> {
  return db.$transaction(async (tx) => {
    const [kennel, cluster] = await Promise.all([
      tx.kennel.findUnique({
        where: { id: args.kennelId },
        select: {
          id: true,
          balance: true,
        },
      }),
      tx.showCluster.findUnique({
        where: { id: args.showClusterId },
        select: {
          id: true,
          name: true,
          district: true,
          startEpoch: true,
          endEpoch: true,
          entryOpenEpoch: true,
          entryCloseEpoch: true,
          status: true,
          showDays: {
            orderBy: [{ dayIndex: "asc" }],
            select: {
              id: true,
              status: true,
              scheduledEpoch: true,
              _count: {
                select: {
                  showResults: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    if (!cluster) {
      throw new Error("Show not found.");
    }

    const baseReason = getBaseIneligibilityReason(cluster, args.currentEpoch);
    if (baseReason) {
      throw new Error(baseReason);
    }

    const existingEntryCount = await getExactClusterEntryCount({
      client: tx,
      kennelId: kennel.id,
      showClusterId: cluster.id,
    });

    if (existingEntryCount > 0) {
      throw new Error(
        "You already have entries in this show, so you cannot steward it."
      );
    }

    const weekendKey = getWeekendKeyForCluster(cluster);
    const existingClaim = await tx.kennelServiceClaim.findFirst({
      where: {
        kennelId: kennel.id,
        serviceType: "CLUB_STEWARDING",
        weekendKey,
        status: {
          in: ["CLAIMED", "COMPLETED"],
        },
      },
      select: {
        showCluster: {
          select: {
            name: true,
          },
        },
      },
    });

    if (existingClaim) {
      throw new Error(
        `You already have a stewarding assignment in this show weekend${existingClaim.showCluster?.name ? `: ${existingClaim.showCluster.name}` : ""}.`
      );
    }

    const payoutAmount = getClubStewardingPayout(cluster.showDays.length);
    const updatedKennel = await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: {
          increment: payoutAmount,
        },
      },
      select: {
        balance: true,
      },
    });
    const claim = await tx.kennelServiceClaim.create({
      data: {
        kennelId: kennel.id,
        serviceType: "CLUB_STEWARDING",
        showClusterId: cluster.id,
        weekendKey,
        status: "COMPLETED",
        payoutAmount,
        claimedAtEpoch: args.currentEpoch,
        completedAtEpoch: args.currentEpoch,
      },
      select: {
        id: true,
      },
    });

    const weekendPlan = await tx.kennelShowWeekendPlan.findUnique({
      where: {
        kennelId_weekendKey: {
          kennelId: kennel.id,
          weekendKey,
        },
      },
      select: {
        id: true,
      },
    });

    if (!weekendPlan) {
      await tx.kennelShowWeekendPlan.create({
        data: {
          kennelId: kennel.id,
          weekendKey,
          primaryClusterId: cluster.id,
          travelFeeCharged: 0,
          createdAtEpoch: args.currentEpoch,
        },
      });
    }

    await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "KENNEL_SERVICE_PAYOUT",
        amount: payoutAmount,
        balanceAfter: updatedKennel.balance,
        occurredAtEpoch: args.currentEpoch,
        showClusterId: cluster.id,
        memo: `Club stewarding payout for ${cluster.name}.`,
        metadataJson: {
          serviceType: "CLUB_STEWARDING",
          claimId: claim.id,
        },
      },
    });

    await createKennelNotice({
      client: tx,
      kennelId: kennel.id,
      type: "KENNEL_SERVICE",
      title: "Club stewarding assignment",
      body: `You stewarded ${cluster.name} and were paid $${payoutAmount.toLocaleString()}.`,
      currentEpoch: args.currentEpoch,
      linkedShowId: cluster.id,
      metadataJson: {
        serviceType: "CLUB_STEWARDING",
        claimId: claim.id,
      },
    });

    return {
      claimId: claim.id,
      showClusterId: cluster.id,
      payoutAmount,
      balanceAfter: updatedKennel.balance,
    };
  });
}

export async function assertCanCreateOwnerHandledEntriesForCluster(args: {
  client: typeof db | Prisma.TransactionClient;
  kennelId: string;
  showClusterId: string;
}) {
  if (
    await hasClubStewardingClaimForCluster({
      client: args.client,
      kennelId: args.kennelId,
      showClusterId: args.showClusterId,
    })
  ) {
    throw new Error(
      "You are stewarding this show and cannot create owner-handled entries in it."
    );
  }
}
