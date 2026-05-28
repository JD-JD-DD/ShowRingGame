import { KennelNoticeType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type DbClient = typeof db | Prisma.TransactionClient;

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
  type: KennelNoticeType;
  title: string;
  body?: string | null;
  currentEpoch: number;
} & KennelNoticeLinkArgs) {
  if (!args.kennelId) {
    return null;
  }

  const client = args.client ?? db;

  try {
    return await client.kennelNotice.create({
      data: {
        kennelId: args.kennelId,
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
    console.error("Unable to create kennel notice:", error);
    return null;
  }
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
