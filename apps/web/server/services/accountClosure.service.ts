import { db } from "@/lib/db";

export type CloseUserAccountResult = {
  alreadyClosed: boolean;
  auditCreated: boolean;
  maskingChanged: boolean;
  maskingAuditCreated: boolean;
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
      select: { id: true, userId: true, isNpc: true, name: true, slug: true, moderationStatus: true },
    });
    const user = await tx.user.findUnique({
      where: { id: args.userId },
      select: { id: true, moderationStatus: true },
    });

    if (!kennel || kennel.isNpc || kennel.userId !== args.userId || !user) {
      throw new Error("The resolved user and kennel no longer match.");
    }

    const alreadyClosed = user.moderationStatus === "BANNED" && kennel.moderationStatus === "CLOSED";
    const replacementName = "Closed Kennel";
    const replacementSlug = `closed-kennel-${kennel.id}`;
    const alreadyMasked = kennel.name === replacementName && kennel.slug === replacementSlug;
    const existingMaskingAudit = await tx.moderationAudit.findFirst({
      where: { targetType: "KENNEL", targetId: kennel.id, action: "KENNEL_IDENTITY_MASKED" },
      select: { id: true },
    });

    if (alreadyClosed && alreadyMasked) {
      return { alreadyClosed: true, auditCreated: false, maskingChanged: false, maskingAuditCreated: false };
    }

    const now = new Date();
    if (!alreadyClosed) {
      await tx.user.update({ where: { id: user.id }, data: { moderationStatus: "BANNED", moderationReason: args.reason, moderatedAt: now, moderatedBy: args.moderatedBy } });
      await tx.userAccessAudit.create({ data: { userId: user.id, kennelId: kennel.id, action: "ADMIN_ACCOUNT_CLOSED", path: "admin-cli" } });
      await tx.moderationAudit.createMany({ data: [
        { targetType: "USER", targetId: user.id, action: "USER_BANNED", reason: args.reason, moderatorLabel: args.moderatedBy },
        { targetType: "KENNEL", targetId: kennel.id, action: "KENNEL_CLOSED", reason: args.reason, moderatorLabel: args.moderatedBy },
      ] });
    }

    if (!alreadyMasked) {
      await tx.kennel.update({ where: { id: kennel.id }, data: { name: replacementName, slug: replacementSlug, moderationStatus: "CLOSED", moderationReason: args.reason, moderatedAt: now, moderatedBy: args.moderatedBy } });
      if (!existingMaskingAudit) {
        await tx.moderationAudit.create({ data: {
          targetType: "KENNEL",
          targetId: kennel.id,
          action: "KENNEL_IDENTITY_MASKED",
          reason: args.reason,
          metadataJson: {
            originalKennelName: kennel.name,
            originalKennelSlug: kennel.slug,
            replacementKennelName: replacementName,
            replacementKennelSlug: replacementSlug,
            closureReason: args.reason,
            userId: user.id,
            kennelId: kennel.id,
            actionTimestamp: now.toISOString(),
          },
          moderatorLabel: args.moderatedBy,
        } });
      }
    }

    return { alreadyClosed, auditCreated: !alreadyClosed, maskingChanged: !alreadyMasked, maskingAuditCreated: !alreadyMasked && !existingMaskingAudit };
  });
}
