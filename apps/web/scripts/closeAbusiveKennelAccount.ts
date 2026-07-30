import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

import { db } from "@/lib/db";
import { closeUserAccountForKennel } from "@/server/services/accountClosure.service";

const TARGET_SLUG = "fuck-gnerative-ai-an-actual-artist";
const TARGET_KENNEL_ID = "cmqiyzhii003vl804hx9ttxu6";
const TARGET_USER_ID = "cmqiyz0t3003rl804lo84b5qf";
const REPLACEMENT_NAME = "Closed Kennel";
const REPLACEMENT_SLUG = `closed-kennel-${TARGET_KENNEL_ID}`;
const REASON = "Administrative account removal for abusive public kennel content.";

function loadEnv(): void {
  for (const root of [process.cwd(), resolve(process.cwd(), "..", "..")]) {
    for (const fileName of [".env.local", ".env"]) {
      const envPath = resolve(root, fileName);
      if (existsSync(envPath)) config({ path: envPath, override: false });
    }
  }
}

function hasExactConfirmation(): boolean {
  return process.argv.slice(2).includes(`--confirm-slug=${TARGET_SLUG}`);
}

async function main(): Promise<void> {
  loadEnv();
  const kennelMatches = await db.kennel.findMany({
    where: { id: TARGET_KENNEL_ID },
    select: {
      id: true,
      name: true,
      slug: true,
      userId: true,
      moderationStatus: true,
      moderationReason: true,
      user: {
        select: {
          id: true,
          email: true,
          moderationStatus: true,
          moderationReason: true,
        },
      },
    },
  });

  if (kennelMatches.length !== 1 || kennelMatches[0]?.userId !== TARGET_USER_ID || !kennelMatches[0].user) {
    throw new Error(`Expected exactly one target kennel and user; found ${kennelMatches.length}.`);
  }

  const kennel = kennelMatches[0]!;
  const user = kennel.user!;
  const currentEpoch = (await import("@/lib/gameClock")).getCurrentEpoch();
  const [accessAuditCount, userAuditCount, kennelAuditCount, maskingAudits, dogRemovalAudits, ownedDogCount, activeOwnedDogCount, dogCount, activeSaleListingCount, activeStudListingCount, futureEntryCount, transferredDogCount, showResultCount, ledgerCount, breedingAttemptCount, litterCount, awardCount] = await Promise.all([
    db.userAccessAudit.count({ where: { userId: user.id, kennelId: kennel.id, action: "ADMIN_ACCOUNT_CLOSED" } }),
    db.moderationAudit.count({ where: { targetType: "USER", targetId: user.id, action: "USER_BANNED", reason: REASON } }),
    db.moderationAudit.count({ where: { targetType: "KENNEL", targetId: kennel.id, action: "KENNEL_CLOSED", reason: REASON } }),
    db.moderationAudit.findMany({ where: { targetType: "KENNEL", targetId: kennel.id, action: "KENNEL_IDENTITY_MASKED" }, select: { metadataJson: true } }),
    db.moderationAudit.findMany({ where: { targetType: "KENNEL", targetId: kennel.id, action: "CLOSED_KENNEL_DOGS_RETIRED" }, select: { metadataJson: true } }),
    db.dog.count({ where: { ownerKennelId: kennel.id } }),
    db.dog.count({ where: { ownerKennelId: kennel.id, lifecycleState: "ALIVE" } }),
    db.dog.count({ where: { OR: [{ ownerKennelId: kennel.id }, { breederKennelId: kennel.id }] } }),
    db.dogListing.count({ where: { sellerKennelId: kennel.id, sellerType: "PLAYER", listingType: "PLAYER_PUBLIC", status: "ACTIVE", dog: { ownerKennelId: kennel.id } } }),
    db.dogListing.count({ where: { sellerKennelId: kennel.id, sellerType: "PLAYER", listingType: "PLAYER_STUD", status: "ACTIVE", dog: { ownerKennelId: kennel.id } } }),
    db.showEntry.count({ where: { dog: { ownerKennelId: kennel.id }, entryStatus: "ENTERED", showResult: null, showDay: { scheduledEpoch: { gte: currentEpoch } } } }),
    db.dog.count({ where: { breederKennelId: kennel.id, ownerKennelId: { not: kennel.id } } }),
    db.showResult.count({ where: { dog: { OR: [{ ownerKennelId: kennel.id }, { breederKennelId: kennel.id }] } } }),
    db.ledgerTransaction.count({ where: { kennelId: kennel.id } }),
    db.breedingAttempt.count({ where: { OR: [{ createdByKennelId: kennel.id }, { sire: { ownerKennelId: kennel.id } }, { dam: { ownerKennelId: kennel.id } }] } }),
    db.litter.count({ where: { bredByKennelId: kennel.id } }),
    db.showAward.count({ where: { showEntry: { kennelId: kennel.id } } }),
  ]);
  const maskingAuditMetadata = maskingAudits[0]?.metadataJson;
  const maskingAuditMetadataVerified = Boolean(
    maskingAuditMetadata &&
    typeof maskingAuditMetadata === "object" &&
    !Array.isArray(maskingAuditMetadata) &&
    (maskingAuditMetadata as Record<string, unknown>).originalKennelName &&
    (maskingAuditMetadata as Record<string, unknown>).originalKennelSlug &&
    (maskingAuditMetadata as Record<string, unknown>).replacementKennelName === REPLACEMENT_NAME &&
    (maskingAuditMetadata as Record<string, unknown>).replacementKennelSlug === REPLACEMENT_SLUG &&
    (maskingAuditMetadata as Record<string, unknown>).userId === TARGET_USER_ID &&
    (maskingAuditMetadata as Record<string, unknown>).kennelId === TARGET_KENNEL_ID
  );
  const dogRemovalMetadata = dogRemovalAudits[0]?.metadataJson;
  const dogRemovalAuditMetadataVerified = Boolean(
    dogRemovalMetadata && typeof dogRemovalMetadata === "object" && !Array.isArray(dogRemovalMetadata) &&
    (dogRemovalMetadata as Record<string, unknown>).kennelId === TARGET_KENNEL_ID &&
    (dogRemovalMetadata as Record<string, unknown>).userId === TARGET_USER_ID &&
    (dogRemovalMetadata as Record<string, unknown>).lifecycleStateApplied === "RETIRED"
  );
  console.log(JSON.stringify({
    kennelId: kennel.id,
    kennelName: kennel.name,
    kennelSlug: kennel.slug,
    userId: user.id,
    email: user.email,
    userModerationStatus: user.moderationStatus,
    userModerationReason: user.moderationReason,
    kennelModerationStatus: kennel.moderationStatus,
    kennelModerationReason: kennel.moderationReason,
    proposedKennelName: REPLACEMENT_NAME,
    proposedKennelSlug: REPLACEMENT_SLUG,
    closureAuditCounts: { accessAuditCount, userAuditCount, kennelAuditCount, maskingAuditCount: maskingAudits.length, dogRemovalAuditCount: dogRemovalAudits.length },
    maskingAuditMetadataVerified,
    dogRemovalAuditMetadataVerified,
    activePlayCounts: { ownedDogCount, activeOwnedDogCount, activeSaleListingCount, activeStudListingCount, futureEntryCount, transferredDogCount },
    historicalRecordCounts: { dogCount, showResultCount, ledgerCount, breedingAttemptCount, litterCount, awardCount },
  }, null, 2));

  if (!hasExactConfirmation()) {
    console.log(`Dry run only. Refusing mutation without --confirm-slug=${TARGET_SLUG}`);
    return;
  }

  const result = await closeUserAccountForKennel({
    kennelId: kennel.id,
    userId: user.id,
    reason: REASON,
    moderatedBy: "production-admin-cli",
  });
  console.log(JSON.stringify(result));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
