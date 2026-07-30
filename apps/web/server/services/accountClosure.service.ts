import { db } from "@/lib/db";

export type CloseUserAccountResult = {
  alreadyClosed: boolean;
  auditCreated: boolean;
};

/** Permanently closes a resolved player account without deleting game history. */
export async function closeUserAccountForKennel(args: {
  kennelId: string;
  userId: string;
  reason: string;
  moderatedBy: string;
}): Promise<CloseUserAccountResult> {
  return db.$transaction(async (tx) => {
    const kennel = await tx.kennel.findUnique({
      where: { id: args.kennelId },
      select: { id: true, userId: true, moderationStatus: true },
    });
    const user = await tx.user.findUnique({
      where: { id: args.userId },
      select: { id: true, moderationStatus: true },
    });

    if (!kennel || kennel.userId !== args.userId || !user) {
      throw new Error("The resolved user and kennel no longer match.");
    }

    const alreadyClosed = user.moderationStatus === "BANNED" && kennel.moderationStatus === "CLOSED";
    if (alreadyClosed) return { alreadyClosed: true, auditCreated: false };

    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: { moderationStatus: "BANNED", moderationReason: args.reason, moderatedAt: now, moderatedBy: args.moderatedBy } });
    await tx.kennel.update({ where: { id: kennel.id }, data: { moderationStatus: "CLOSED", moderationReason: args.reason, moderatedAt: now, moderatedBy: args.moderatedBy } });
    await tx.userAccessAudit.create({ data: { userId: user.id, kennelId: kennel.id, action: "ADMIN_ACCOUNT_CLOSED", path: "admin-cli" } });
    await tx.moderationAudit.createMany({ data: [
      { targetType: "USER", targetId: user.id, action: "USER_BANNED", reason: args.reason, moderatorLabel: args.moderatedBy },
      { targetType: "KENNEL", targetId: kennel.id, action: "KENNEL_CLOSED", reason: args.reason, moderatorLabel: args.moderatedBy },
    ] });

    return { alreadyClosed: false, auditCreated: true };
  });
}
