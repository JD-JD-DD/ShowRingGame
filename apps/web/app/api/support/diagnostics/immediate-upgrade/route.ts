import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  createPayPalClient,
  PayPalSupportError,
} from "@/server/services/paypalSupport.service";

export const runtime = "nodejs";

function toSubscriptionView(subscription: any, providerStatus: string | null) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    status: subscription.status,
    providerSubscriptionId: subscription.providerSubscriptionId,
    providerStatus,
    currentPaidPeriodEnd: subscription.currentPaidPeriodEnd,
    endedAt: subscription.endedAt,
  };
}

/**
 * Temporary SUPPORT-07 diagnostic. It reads only the signed-in user's latest
 * Bronze-to-Silver immediate-upgrade workflow. Provider reads use the same
 * configured environment as the ordinary support integration.
 */
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);

    const change = await (db as any).supportSubscriptionChange.findFirst({
      where: {
        userId,
        type: "UPGRADE",
        targetTier: "SILVER",
        sourceSubscription: { currentTier: "BRONZE" },
      },
      orderBy: { requestedAt: "desc" },
      include: { sourceSubscription: true, targetSubscription: true },
    });
    if (!change) return fail("No Bronze-to-Silver support upgrade was found for this account.", 404);

    const client = createPayPalClient();
    const [source, target] = await Promise.all([
      client.getSubscription(change.sourceSubscription.providerSubscriptionId),
      change.targetSubscription ? client.getSubscription(change.targetSubscription.providerSubscriptionId) : Promise.resolve(null),
    ]);
    const sourceProviderStatus = source.status;
    const targetProviderStatus = target?.status ?? null;
    const workflowIsLive = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"].includes(change.status);
    const bronzeProviderCancelled = sourceProviderStatus === "CANCELLED";
    const bronzeCanStillRecur = sourceProviderStatus === "ACTIVE" ? true : bronzeProviderCancelled ? false : null;
    const targetActivated = change.targetActivatedAt !== null && change.targetSubscription?.status === "ACTIVE";

    return ok({
      bronzeSource: toSubscriptionView(change.sourceSubscription, sourceProviderStatus),
      silverTarget: {
        ...toSubscriptionView(change.targetSubscription, targetProviderStatus),
        canonical: change.targetActivatedAt !== null && change.targetSubscription?.status === "ACTIVE",
      },
      supportSubscriptionChange: {
        id: change.id,
        type: change.type,
        status: change.status,
        sourceSubscriptionId: change.sourceSupportSubscriptionId,
        targetSubscriptionId: change.targetSupportSubscriptionId,
        targetActivatedAt: change.targetActivatedAt,
        sourceCancellationRequestedAt: change.sourceCancellationRequestedAt,
        completedAt: change.completedAt,
        failedAt: change.failedAt,
      },
      derived: {
        workflowIsLive,
        bronzeProviderCancelled,
        bronzeCanStillRecur,
        testCBlockedBy: {
          providerCleanup: targetActivated && !bronzeProviderCancelled,
          localSynchronization: targetActivated && bronzeProviderCancelled && change.sourceSubscription.status !== "ENDED",
          workflowCompletion: targetActivated && bronzeProviderCancelled && change.sourceSubscription.status === "ENDED" && change.status !== "COMPLETED",
        },
      },
    });
  } catch (error) {
    if (error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("GET /api/support/diagnostics/immediate-upgrade failed");
    return fail("Unable to read support lifecycle diagnostic.", 500);
  }
}
