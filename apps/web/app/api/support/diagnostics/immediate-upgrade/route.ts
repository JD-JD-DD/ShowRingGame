import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  createPayPalClient,
  getPayPalEnvironment,
  PayPalSupportError,
} from "@/server/services/paypalSupport.service";

export const runtime = "nodejs";

type ProviderRead = {
  providerRead: "SUCCESS" | "FAILED";
  providerStatus: string | null;
  errorCategory: "NOT_FOUND" | "AUTHENTICATION_FAILED" | "ENVIRONMENT_CONFIGURATION_ERROR" | "PROVIDER_REQUEST_FAILED" | "UNEXPECTED_RESPONSE" | null;
};

function classifyProviderReadError(error: unknown): NonNullable<ProviderRead["errorCategory"]> {
  if (!(error instanceof PayPalSupportError)) return "PROVIDER_REQUEST_FAILED";
  if (error.status === 404) return "NOT_FOUND";
  if (error.status === 401 || error.status === 403 || error.message === "PayPal authentication failed.") return "AUTHENTICATION_FAILED";
  if (error.message === "PayPal support is not configured.") return "ENVIRONMENT_CONFIGURATION_ERROR";
  if (error.message === "PayPal returned an invalid subscription response." || error.message === "PayPal returned an invalid response.") return "UNEXPECTED_RESPONSE";
  return "PROVIDER_REQUEST_FAILED";
}

async function readProviderSubscription(providerSubscriptionId: string): Promise<ProviderRead> {
  try {
    const subscription = await createPayPalClient().getSubscription(providerSubscriptionId);
    return { providerRead: "SUCCESS", providerStatus: subscription.status, errorCategory: null };
  } catch (error) {
    return { providerRead: "FAILED", providerStatus: null, errorCategory: classifyProviderReadError(error) };
  }
}

function toBronzeView(subscription: any, providerRead: ProviderRead) {
  return {
    localSubscriptionId: subscription.id,
    localStatus: subscription.status,
    providerSubscriptionId: subscription.providerSubscriptionId,
    ...providerRead,
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

    let providerEnvironment: "SANDBOX" | "LIVE" | null = null;
    try {
      providerEnvironment = getPayPalEnvironment().toUpperCase() as "SANDBOX" | "LIVE";
    } catch {}
    const [bronzeProviderRead, silverProviderRead] = await Promise.all([
      readProviderSubscription(change.sourceSubscription.providerSubscriptionId),
      change.targetSubscription
        ? readProviderSubscription(change.targetSubscription.providerSubscriptionId)
        : Promise.resolve<ProviderRead>({ providerRead: "FAILED", providerStatus: null, errorCategory: "UNEXPECTED_RESPONSE" }),
    ]);
    const workflowIsLive = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"].includes(change.status);
    const bronzeProviderCancelled = bronzeProviderRead.providerRead === "SUCCESS" ? bronzeProviderRead.providerStatus === "CANCELLED" : null;
    const bronzeCanStillRecur = bronzeProviderRead.providerRead !== "SUCCESS" ? null : bronzeProviderRead.providerStatus === "ACTIVE" ? true : bronzeProviderCancelled ? false : null;
    const targetActivated = change.targetActivatedAt !== null && change.targetSubscription?.status === "ACTIVE";

    return ok({
      providerEnvironment,
      bronze: toBronzeView(change.sourceSubscription, bronzeProviderRead),
      silver: {
        localSubscriptionId: change.targetSubscription?.id ?? null,
        localStatus: change.targetSubscription?.status ?? null,
        providerSubscriptionId: change.targetSubscription?.providerSubscriptionId ?? null,
        ...silverProviderRead,
        canonical: change.targetActivatedAt !== null && change.targetSubscription?.status === "ACTIVE",
      },
      workflow: {
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
          providerCleanup: bronzeProviderCancelled === null ? null : targetActivated && !bronzeProviderCancelled,
          localSynchronization: bronzeProviderCancelled === null ? null : targetActivated && bronzeProviderCancelled && change.sourceSubscription.status !== "ENDED",
          workflowCompletion: bronzeProviderCancelled === null ? null : targetActivated && bronzeProviderCancelled && change.sourceSubscription.status === "ENDED" && change.status !== "COMPLETED",
        },
      },
    });
  } catch (error) {
    if (error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("GET /api/support/diagnostics/immediate-upgrade failed");
    return fail("Unable to read support lifecycle diagnostic.", 500);
  }
}
