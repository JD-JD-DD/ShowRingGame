import { db } from "@/lib/db";
import {
  createPayPalSandboxClient,
  getPayPalSandboxWebhookId,
  type PayPalSandboxClient,
  type PayPalWebhookVerificationHeaders,
} from "@/server/services/paypalSupport.service";
import {
  getSupportTierForPayPalPlan,
  translatePayPalStatus,
} from "@/server/services/supportSubscription.service";

const HANDLED_EVENT_TYPES = new Set([
  "BILLING.SUBSCRIPTION.CREATED", "BILLING.SUBSCRIPTION.ACTIVATED", "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.EXPIRED", "BILLING.SUBSCRIPTION.CANCELLED", "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED", "PAYMENT.SALE.COMPLETED", "PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED",
]);

export class PayPalWebhookError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type WebhookEvent = { id: string; event_type: string; resource?: Record<string, unknown> };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parsePayPalWebhookEvent(value: unknown): WebhookEvent {
  const event = record(value);
  if (!event || typeof event.id !== "string" || typeof event.event_type !== "string") {
    throw new PayPalWebhookError("Invalid PayPal webhook event.");
  }
  return { id: event.id, event_type: event.event_type, resource: record(event.resource) ?? undefined };
}

export function resolveProviderSubscriptionId(event: WebhookEvent): string | null {
  const resource = event.resource;
  if (!resource) return null;
  if (event.event_type.startsWith("BILLING.SUBSCRIPTION.") && typeof resource.id === "string") return resource.id;
  for (const key of ["billing_agreement_id", "subscription_id"]) {
    if (typeof resource[key] === "string") return resource[key] as string;
  }
  return null;
}

export async function verifyPayPalWebhook(args: {
  headers: PayPalWebhookVerificationHeaders;
  body: unknown;
  payPalClient?: PayPalSandboxClient;
}): Promise<void> {
  const verified = await (args.payPalClient ?? createPayPalSandboxClient()).verifyWebhookSignature({
    headers: args.headers,
    event: args.body,
    webhookId: getPayPalSandboxWebhookId(),
  });
  if (!verified) throw new PayPalWebhookError("PayPal webhook signature verification failed.", 401);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function processVerifiedPayPalWebhook(args: {
  event: WebhookEvent;
  payPalClient?: PayPalSandboxClient;
  database?: any;
}): Promise<"processed" | "ignored" | "duplicate"> {
  const database = args.database ?? db;
  const providerSubscriptionId = resolveProviderSubscriptionId(args.event);
  let providerEvent: { id: string; processingStatus: string };
  try {
    providerEvent = await database.supportProviderEvent.create({ data: {
      provider: "PAYPAL", providerEventId: args.event.id, eventType: args.event.event_type, providerSubscriptionId,
    }, select: { id: true, processingStatus: true } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await database.supportProviderEvent.findUnique({ where: { providerEventId: args.event.id }, select: { id: true, processingStatus: true } });
    if (!existing || existing.processingStatus === "PROCESSED" || existing.processingStatus === "IGNORED") return "duplicate";
    providerEvent = existing;
  }

  if (!HANDLED_EVENT_TYPES.has(args.event.event_type) || !providerSubscriptionId) {
    await database.supportProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: "IGNORED", processedAt: new Date() } });
    return "ignored";
  }

  try {
    // This current provider read deliberately occurs outside the database transaction.
    const current = await (args.payPalClient ?? createPayPalSandboxClient()).getSubscription(providerSubscriptionId);
    const tier = getSupportTierForPayPalPlan(current.planId);
    const status = translatePayPalStatus(current);
    const now = new Date();
    const result = await database.$transaction(async (tx: any) => {
      const subscription = await tx.supportSubscription.findUnique({ where: { providerSubscriptionId: current.id } });
      if (!subscription) return "ignored" as const;
      await tx.$queryRaw`SELECT "id" FROM "SupportSubscription" WHERE "id" = ${subscription.id} FOR UPDATE`;
      const fresh = await tx.supportSubscription.findUnique({ where: { id: subscription.id }, include: { tierPeriods: { where: { endedAt: null } } } });
      const startedAt = current.startTime ?? now;
      const activePeriod = fresh.tierPeriods[0];
      const hasSupported = status !== "PENDING";
      if (hasSupported && activePeriod && activePeriod.tier !== tier) {
        await tx.supportSubscriptionTierPeriod.update({ where: { id: activePeriod.id }, data: { endedAt: startedAt } });
      }
      if (hasSupported && (!activePeriod || activePeriod.tier !== tier)) {
        await tx.supportSubscriptionTierPeriod.create({ data: { supportSubscriptionId: fresh.id, tier, startedAt } });
      }
      await tx.supportSubscription.update({ where: { id: fresh.id }, data: {
        currentTier: tier, status,
        currentPaidPeriodStart: status === "ACTIVE" ? startedAt : fresh.currentPaidPeriodStart,
        currentPaidPeriodEnd: status === "ACTIVE" ? current.nextBillingTime : fresh.currentPaidPeriodEnd,
        firstSupportedAt: fresh.firstSupportedAt ?? (status === "ACTIVE" ? startedAt : null),
        cancellationRequestedAt: status === "CANCELLATION_SCHEDULED" ? fresh.cancellationRequestedAt ?? now : null,
        endedAt: status === "ENDED" ? fresh.endedAt ?? now : null,
      } });
      return "processed" as const;
    });
    await database.supportProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: result === "processed" ? "PROCESSED" : "IGNORED", processedAt: new Date() } });
    return result;
  } catch (error) {
    await database.supportProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: "FAILED" } });
    throw error;
  }
}
