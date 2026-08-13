import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";
import { deleteLitterRunIfEmpty } from "@/server/services/kennelRun.service";

export type CloseUserAccountResult = {
  alreadyClosed: boolean;
  auditCreated: boolean;
  maskingChanged: boolean;
  maskingAuditCreated: boolean;
  dogTransitionCount: number;
  saleListingClosureCount: number;
  studListingClosureCount: number;
  futureShowEntryNeutralizedCount: number;
  dogRemovalAuditCreated: boolean;
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

    const now = new Date();
    const currentEpoch = getCurrentEpoch();
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

    const ownedDogs = await tx.dog.findMany({
      where: { ownerKennelId: kennel.id },
      select: { id: true, lifecycleState: true, kennelRunId: true },
    });
    const ownedDogIds = ownedDogs.map((dog) => dog.id);
    const activeDogIds = ownedDogs
      .filter((dog) => dog.lifecycleState === "ALIVE")
      .map((dog) => dog.id);
    const existingDogRemovalAudit = await tx.moderationAudit.findFirst({
      where: { targetType: "KENNEL", targetId: kennel.id, action: "CLOSED_KENNEL_DOGS_RETIRED" },
      select: { id: true },
    });
    const [saleListings, studListings, futureEntries] = await Promise.all([
      tx.dogListing.findMany({
        where: { dogId: { in: ownedDogIds }, sellerKennelId: kennel.id, sellerType: "PLAYER", listingType: PLAYER_SALE_LISTING_TYPE, status: "ACTIVE" },
        select: { id: true },
      }),
      tx.dogListing.findMany({
        where: { dogId: { in: ownedDogIds }, sellerKennelId: kennel.id, sellerType: "PLAYER", listingType: PLAYER_STUD_LISTING_TYPE, status: "ACTIVE" },
        select: { id: true },
      }),
      tx.showEntry.findMany({
        where: { dogId: { in: ownedDogIds }, entryStatus: "ENTERED", showResult: null, showDay: { scheduledEpoch: { gte: currentEpoch } } },
        select: { id: true },
      }),
    ]);

    if (saleListings.length + studListings.length > 0) {
      await tx.dogListing.updateMany({
        where: { id: { in: [...saleListings, ...studListings].map((listing) => listing.id) } },
        data: { status: "CANCELLED" },
      });
    }
    if (futureEntries.length > 0) {
      await tx.showEntry.updateMany({
        where: { id: { in: futureEntries.map((entry) => entry.id) } },
        data: { entryStatus: "INELIGIBLE", absenceReason: null },
      });
    }
    if (activeDogIds.length > 0) {
      await tx.dog.updateMany({
        where: { id: { in: activeDogIds }, ownerKennelId: kennel.id, lifecycleState: "ALIVE" },
        data: { lifecycleState: "RETIRED", marketState: "NOT_FOR_SALE", kennelRunId: null },
      });
      await Promise.all(
        [...new Set(
          ownedDogs
            .filter((dog) => dog.lifecycleState === "ALIVE")
            .map((dog) => dog.kennelRunId)
            .filter(Boolean)
        )].map((priorRunId) =>
          deleteLitterRunIfEmpty({ priorRunId, client: tx })
        )
      );
    }
    const dogRemovalChanged = activeDogIds.length + saleListings.length + studListings.length + futureEntries.length > 0;
    if (dogRemovalChanged && !existingDogRemovalAudit) {
      await tx.moderationAudit.create({ data: {
        targetType: "KENNEL",
        targetId: kennel.id,
        action: "CLOSED_KENNEL_DOGS_RETIRED",
        reason: args.reason,
        metadataJson: {
          kennelId: kennel.id,
          userId: user.id,
          affectedDogIds: ownedDogIds,
          affectedDogCount: ownedDogIds.length,
          dogTransitionCount: activeDogIds.length,
          activeSaleListingsClosed: saleListings.length,
          activeStudListingsClosed: studListings.length,
          futureShowEntriesNeutralized: futureEntries.length,
          lifecycleStateApplied: "RETIRED",
          closureReason: args.reason,
          actionTimestamp: now.toISOString(),
        },
        moderatorLabel: args.moderatedBy,
      } });
    }

    return {
      alreadyClosed,
      auditCreated: !alreadyClosed,
      maskingChanged: !alreadyMasked,
      maskingAuditCreated: !alreadyMasked && !existingMaskingAudit,
      dogTransitionCount: activeDogIds.length,
      saleListingClosureCount: saleListings.length,
      studListingClosureCount: studListings.length,
      futureShowEntryNeutralizedCount: futureEntries.length,
      dogRemovalAuditCreated: dogRemovalChanged && !existingDogRemovalAudit,
    };
  });
}
