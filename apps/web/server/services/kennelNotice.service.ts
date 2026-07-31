import { KennelNoticeType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type DbClient = typeof db | Prisma.TransactionClient;
const INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE = 500;

export type KennelNoticeLinkArgs = {
  linkedDogId?: string | null;
  linkedLitterId?: string | null;
  linkedShowId?: string | null;
  linkedThreadId?: string | null;
  linkedListingId?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export async function createKennelNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  sourceKey?: string | null;
  type: KennelNoticeType;
  title: string;
  body?: string | null;
  currentEpoch: number;
} & KennelNoticeLinkArgs) {
  if (!args.kennelId) {
    return null;
  }

  const client = args.client ?? db;

  if (args.sourceKey) {
    const existingNotice = await client.kennelNotice.findUnique({
      where: {
        sourceKey: args.sourceKey,
      },
    });

    if (existingNotice) {
      return existingNotice;
    }
  }

  try {
    return await client.kennelNotice.create({
      data: {
        kennelId: args.kennelId,
        sourceKey: args.sourceKey ?? null,
        type: args.type,
        title: args.title,
        body: args.body ?? null,
        createdAtEpoch: args.currentEpoch,
        linkedDogId: args.linkedDogId ?? null,
        linkedLitterId: args.linkedLitterId ?? null,
        linkedShowId: args.linkedShowId ?? null,
        linkedThreadId: args.linkedThreadId ?? null,
        linkedListingId: args.linkedListingId ?? null,
        metadataJson: args.metadataJson ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    if (
      args.sourceKey &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return client.kennelNotice.findUnique({
        where: {
          sourceKey: args.sourceKey,
        },
      });
    }

    console.error("Unable to create kennel notice:", error);
    return null;
  }
}

export function getReproductiveEmergencyNoticeSourceKey(
  breedingAttemptId: string
): string {
  return `REPRODUCTIVE_EMERGENCY_NOTICE:${breedingAttemptId}`;
}

export async function createReproductiveEmergencyNotice(args: {
  client: DbClient;
  kennelId: string | null | undefined;
  breedingAttemptId: string;
  damId: string;
  currentEpoch: number;
}) {
  return createKennelNotice({
    client: args.client,
    kennelId: args.kennelId,
    sourceKey: getReproductiveEmergencyNoticeSourceKey(args.breedingAttemptId),
    type: "KENNEL_SERVICE",
    title: "Emergency veterinary care required",
    body: "Your dam has a serious whelping complication. Litter resolution is paused while emergency veterinary care is required.",
    currentEpoch: args.currentEpoch,
    linkedDogId: args.damId,
    metadataJson: {
      noticeKind: "REPRODUCTIVE_EMERGENCY",
      breedingAttemptId: args.breedingAttemptId,
    },
  });
}

export async function getUnreadKennelNoticeCount(kennelId: string) {
  return db.kennelNotice.count({
    where: {
      kennelId,
      readAtEpoch: null,
      dismissedAtEpoch: null,
    },
  });
}

export async function listKennelNotices(args: {
  kennelId: string;
  take?: number;
}) {
  return db.kennelNotice.findMany({
    where: {
      kennelId: args.kennelId,
      dismissedAtEpoch: null,
    },
    orderBy: [{ createdAtEpoch: "desc" }, { createdAt: "desc" }],
    take: args.take ?? 50,
  });
}

export async function markKennelNoticeRead(args: {
  kennelId: string;
  noticeId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      id: args.noticeId,
      kennelId: args.kennelId,
      readAtEpoch: null,
    },
    data: {
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function dismissKennelNotice(args: {
  kennelId: string;
  noticeId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      id: args.noticeId,
      kennelId: args.kennelId,
    },
    data: {
      dismissedAtEpoch: args.currentEpoch,
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function markAllKennelNoticesRead(args: {
  kennelId: string;
  currentEpoch: number;
}) {
  await db.kennelNotice.updateMany({
    where: {
      kennelId: args.kennelId,
      readAtEpoch: null,
      dismissedAtEpoch: null,
    },
    data: {
      readAtEpoch: args.currentEpoch,
    },
  });
}

export async function deleteReadKennelInboxNotices(args: {
  client?: DbClient;
  kennelId: string;
  currentEpoch: number;
}) {
  const client = args.client ?? db;

  const result = await client.kennelNotice.updateMany({
    where: {
      kennelId: args.kennelId,
      readAtEpoch: {
        not: null,
      },
      dismissedAtEpoch: null,
    },
    data: {
      dismissedAtEpoch: args.currentEpoch,
    },
  });

  return {
    deletedCount: result.count,
  };
}

export function getDogTitleNoticeSourceKey(args: {
  dogId: string;
  titleCode: string;
  kennelId: string;
}) {
  return `dog-title:${args.dogId}:${args.titleCode}:${args.kennelId}`;
}

export async function createDogTitleNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  dogId: string;
  dogDisplayName: string;
  noticeType: KennelNoticeType;
  titleCode: string;
  titleLabel?: string | null;
  sourceKey: string;
  title: string;
  body: string;
  currentEpoch: number;
  metadataJson?: Prisma.InputJsonValue | null;
}) {
  if (!args.kennelId) {
    return null;
  }

  const client = args.client ?? db;
  const eligibleOwnerKennel = await client.kennel.findFirst({
    where: {
      id: args.kennelId,
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: {
        is: {
          moderationStatus: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!eligibleOwnerKennel) {
    return null;
  }

  return createKennelNotice({
    client,
    kennelId: eligibleOwnerKennel.id,
    sourceKey: args.sourceKey,
    type: args.noticeType,
    title: args.title,
    body: args.body,
    currentEpoch: args.currentEpoch,
    linkedDogId: args.dogId,
    metadataJson: args.metadataJson,
  });
}

function getInvitationalResultsNoticeSourceKey(args: {
  clusterId: string;
  kennelId: string;
}) {
  return `invitational-results:${args.clusterId}:${args.kennelId}`;
}

export async function createInvitationalResultsPublishedNotices(args: {
  client?: DbClient;
  clusterId: string;
  clusterName: string;
  invitationalYear: number;
  currentEpoch: number;
}) {
  const client = args.client ?? db;
  const recipientKennels = await client.kennel.findMany({
    where: {
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: {
        is: {
          moderationStatus: "ACTIVE",
        },
      },
    },
    orderBy: {
      id: "asc",
    },
    select: {
      id: true,
    },
  });

  if (recipientKennels.length === 0) {
    return {
      recipientCount: 0,
      createdCount: 0,
      batchCount: 0,
    };
  }

  const title = "Invitational Results Are Available";
  const body = `The Year ${args.invitationalYear} Invitational has finished judging. View the complete results.`;
  const resultsPath = `/shows/${args.clusterId}/results`;
  const noticeRows: Prisma.KennelNoticeCreateManyInput[] = recipientKennels.map(
    (kennel) => ({
      kennelId: kennel.id,
      sourceKey: getInvitationalResultsNoticeSourceKey({
        clusterId: args.clusterId,
        kennelId: kennel.id,
      }),
      type: "INVITATIONAL_RESULTS_PUBLISHED",
      title,
      body,
      createdAtEpoch: args.currentEpoch,
      linkedShowId: args.clusterId,
      metadataJson: {
        gameYear: args.invitationalYear,
        resultsPath,
        clusterName: args.clusterName,
      },
    })
  );

  let createdCount = 0;
  let batchCount = 0;

  for (
    let index = 0;
    index < noticeRows.length;
    index += INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE
  ) {
    const batch = noticeRows.slice(
      index,
      index + INVITATIONAL_RESULTS_NOTICE_BATCH_SIZE
    );
    const result = await client.kennelNotice.createMany({
      data: batch,
      skipDuplicates: true,
    });

    createdCount += result.count;
    batchCount += 1;
  }

  return {
    recipientCount: recipientKennels.length,
    createdCount,
    batchCount,
  };
}

export async function createDogProgenyTitleEarnedNotice(args: {
  client?: DbClient;
  kennelId: string | null | undefined;
  dogId: string;
  dogDisplayName: string;
  titleCode: string;
  titleLabel: string;
  currentEpoch: number;
}) {
  if (!args.kennelId) {
    return null;
  }

  return createDogTitleNotice({
    client: args.client,
    kennelId: args.kennelId,
    dogId: args.dogId,
    dogDisplayName: args.dogDisplayName,
    noticeType: "DOG_PROGENY_TITLE_EARNED" as KennelNoticeType,
    titleCode: args.titleCode,
    titleLabel: args.titleLabel,
    sourceKey: getDogTitleNoticeSourceKey({
      dogId: args.dogId,
      titleCode: args.titleCode,
      kennelId: args.kennelId,
    }),
    title: `New ${args.titleCode} title`,
    body: `${args.dogDisplayName} has earned the ${args.titleLabel} title.`,
    currentEpoch: args.currentEpoch,
    metadataJson: {
      titleCode: args.titleCode,
      titleLabel: args.titleLabel,
    },
  });
}
