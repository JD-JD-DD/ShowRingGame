import { db } from "@/lib/db";
import { getSupporterBadgePresentation } from "@/lib/supporterBadgePresentation";

const CURRENT = ["PENDING", "ACTIVE", "PAYMENT_RETRY", "CANCELLATION_SCHEDULED"] as const;
const LIVE = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"] as const;

export async function getCommunitySupporterBadgePresentations(userIds: Array<string | null | undefined>) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const result = new Map<string, { tier: "BRONZE" | "SILVER" | "GOLD" } | null>();
  if (!ids.length) return result;
  const [kennels, current, changes] = await Promise.all([
    db.kennel.findMany({ where: { userId: { in: ids } }, select: { userId: true, showSupporterBadge: true } }),
    db.supportSubscription.findMany({ where: { userId: { in: ids }, provider: "PAYPAL", status: { in: [...CURRENT] } }, select: { id: true, userId: true, currentTier: true, status: true, currentPaidPeriodEnd: true } }),
    db.supportSubscriptionChange.findMany({ where: { userId: { in: ids }, status: { in: [...LIVE] } }, orderBy: { requestedAt: "desc" }, include: { sourceSubscription: { select: { id: true, currentTier: true, status: true, currentPaidPeriodEnd: true } }, targetSubscription: { select: { id: true, currentTier: true, status: true, currentPaidPeriodEnd: true } } } }),
  ]);
  const kennelByUser = new Map(kennels.map((kennel) => [kennel.userId, kennel]));
  for (const userId of ids) {
    const kennel = kennelByUser.get(userId); const change = changes.find((item) => item.userId === userId);
    const subscription = change ? (change.targetActivatedAt && change.targetSubscription?.status === "ACTIVE" ? change.targetSubscription : change.sourceSubscription) : current.filter((item) => item.userId === userId).length === 1 ? current.find((item) => item.userId === userId) : null;
    const presentation = getSupporterBadgePresentation({ tier: subscription?.currentTier, status: subscription?.status, currentPaidPeriodEnd: subscription?.currentPaidPeriodEnd, showSupporterBadge: kennel?.showSupporterBadge === true });
    result.set(userId, presentation.visible ? { tier: presentation.tier } : null);
  }
  return result;
}
