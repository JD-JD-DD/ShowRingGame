import "server-only";

import { db } from "@/lib/db";

export class ModerationBlockedError extends Error {
  constructor(
    message: string,
    readonly targetType: "USER" | "KENNEL"
  ) {
    super(message);
    this.name = "ModerationBlockedError";
  }
}

export async function assertUserNotBanned(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { moderationStatus: true },
  });

  if (!user || user.moderationStatus === "BANNED") {
    throw new ModerationBlockedError("This user account is closed.", "USER");
  }
}

export async function assertKennelActive(kennelId: string): Promise<void> {
  const kennel = await db.kennel.findUnique({
    where: { id: kennelId },
    select: { moderationStatus: true },
  });

  if (!kennel || kennel.moderationStatus === "CLOSED") {
    throw new ModerationBlockedError("This kennel is closed.", "KENNEL");
  }
}

export async function isIpBanned(ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;

  const now = new Date();
  const ban = await db.accessDenylist.findFirst({
    where: {
      ipAddress,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });

  return Boolean(ban);
}

type ModerationActionArgs = {
  reason: string;
  moderatedBy: string;
};

export async function closeKennel(
  args: ModerationActionArgs & { kennelSlug: string }
): Promise<void> {
  const kennel = await db.kennel.findUnique({
    where: { slug: args.kennelSlug },
    select: { id: true },
  });
  if (!kennel) throw new Error(`Kennel not found: ${args.kennelSlug}`);

  const now = new Date();
  await db.$transaction([
    db.kennel.update({
      where: { id: kennel.id },
      data: {
        moderationStatus: "CLOSED",
        moderationReason: args.reason,
        moderatedAt: now,
        moderatedBy: args.moderatedBy,
      },
    }),
    db.moderationAudit.create({
      data: {
        targetType: "KENNEL",
        targetId: kennel.id,
        action: "KENNEL_CLOSED",
        reason: args.reason,
        moderatorLabel: args.moderatedBy,
      },
    }),
  ]);
}

export async function reopenKennel(
  args: ModerationActionArgs & { kennelSlug: string }
): Promise<void> {
  const kennel = await db.kennel.findUnique({
    where: { slug: args.kennelSlug },
    select: { id: true },
  });
  if (!kennel) throw new Error(`Kennel not found: ${args.kennelSlug}`);

  await db.$transaction([
    db.kennel.update({
      where: { id: kennel.id },
      data: {
        moderationStatus: "ACTIVE",
        moderationReason: null,
        moderatedAt: null,
        moderatedBy: null,
      },
    }),
    db.moderationAudit.create({
      data: {
        targetType: "KENNEL",
        targetId: kennel.id,
        action: "KENNEL_REOPENED",
        reason: args.reason,
        moderatorLabel: args.moderatedBy,
      },
    }),
  ]);
}

export async function banUser(
  args: ModerationActionArgs & { userId: string }
): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.user.update({
      where: { id: args.userId },
      data: {
        moderationStatus: "BANNED",
        moderationReason: args.reason,
        moderatedAt: now,
        moderatedBy: args.moderatedBy,
      },
    }),
    db.moderationAudit.create({
      data: {
        targetType: "USER",
        targetId: args.userId,
        action: "USER_BANNED",
        reason: args.reason,
        moderatorLabel: args.moderatedBy,
      },
    }),
  ]);
}

export async function banIp(
  args: ModerationActionArgs & {
    ipAddress: string;
    expiresAt?: Date | null;
  }
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.accessDenylist.updateMany({
      where: { ipAddress: args.ipAddress, isActive: true },
      data: { isActive: false },
    });
    await tx.accessDenylist.create({
      data: {
        ipAddress: args.ipAddress,
        reason: args.reason,
        createdBy: args.moderatedBy,
        expiresAt: args.expiresAt ?? null,
      },
    });
    await tx.moderationAudit.create({
      data: {
        targetType: "IP",
        targetId: args.ipAddress,
        action: "IP_BANNED",
        reason: args.reason,
        moderatorLabel: args.moderatedBy,
      },
    });
  });
}

export async function unbanIp(args: ModerationActionArgs & {
  ipAddress: string;
}): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.accessDenylist.updateMany({
      where: { ipAddress: args.ipAddress, isActive: true },
      data: { isActive: false },
    });
    await tx.moderationAudit.create({
      data: {
        targetType: "IP",
        targetId: args.ipAddress,
        action: "IP_UNBANNED",
        reason: args.reason,
        moderatorLabel: args.moderatedBy,
      },
    });
  });
}
