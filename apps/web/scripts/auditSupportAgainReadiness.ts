// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";

import { db } from "../lib/db";

loadEnvConfig(process.cwd());

const CURRENT_STATUSES = ["PENDING", "ACTIVE", "PAYMENT_RETRY", "CANCELLATION_SCHEDULED"] as const;
const LIVE_CHANGE_STATUSES = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"] as const;

async function main() {
  const historicalSubscriptions = await db.supportSubscription.findMany({
    where: { provider: "PAYPAL", status: "ENDED" },
    select: { id: true, userId: true, currentTier: true, status: true, firstSupportedAt: true, endedAt: true },
    orderBy: [{ userId: "asc" }, { firstSupportedAt: "asc" }],
  });
  const candidates = [];
  for (const userId of [...new Set(historicalSubscriptions.map((subscription) => subscription.userId))]) {
    const [currentCount, liveWorkflowCount, history] = await Promise.all([
      db.supportSubscription.count({ where: { userId, provider: "PAYPAL", status: { in: CURRENT_STATUSES } } }),
      db.supportSubscriptionChange.count({ where: { userId, status: { in: LIVE_CHANGE_STATUSES } } }),
      db.supportSubscription.findMany({
        where: { userId, provider: "PAYPAL", status: "ENDED" },
        select: { id: true, currentTier: true, status: true, firstSupportedAt: true, endedAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (currentCount !== 0 || liveWorkflowCount !== 0 || history.length === 0) continue;
    candidates.push({
      userId,
      canonicalSubscriptionId: null,
      historicalSubscriptions: history.map((subscription) => ({ id: subscription.id, tier: subscription.currentTier, status: subscription.status, endedAt: subscription.endedAt })),
      earliestFirstSupportedAt: history.reduce<Date | null>((earliest, subscription) => !earliest || (subscription.firstSupportedAt && subscription.firstSupportedAt < earliest) ? subscription.firstSupportedAt : earliest, null),
      latestHistoricalEndedAt: history.reduce<Date | null>((latest, subscription) => !latest || (subscription.endedAt && subscription.endedAt > latest) ? subscription.endedAt : latest, null),
      liveWorkflowCount,
      currentSubscriptionCount: currentCount,
      supportAgainEligible: true,
      supporterBadgeEligible: false,
      showsFormerSupporterCard: true,
    });
  }
  console.log(JSON.stringify({ diagnostic: "SUPPORT-07 Test I Support Again readiness", candidateCount: candidates.length, candidates }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Support Again readiness audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => { await db.$disconnect(); });
