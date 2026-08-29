import { db } from "@/lib/db";
import {
  createPayPalClient,
  getPayPalWebhookId,
  type PayPalClient,
  type PayPalWebhookVerificationHeaders,
} from "@/server/services/paypalSupport.service";
import {
  getSupportTierForPayPalPlan,
  synchronizeVerifiedPayPalSubscription,
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
  payPalClient?: PayPalClient;
}): Promise<void> {
  const verified = await (args.payPalClient ?? createPayPalClient()).verifyWebhookSignature({
    headers: args.headers,
    event: args.body,
    webhookId: getPayPalWebhookId(),
  });
  if (!verified) throw new PayPalWebhookError("PayPal webhook signature verification failed.", 401);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function processVerifiedPayPalWebhook(args: {
  event: WebhookEvent;
  payPalClient?: PayPalClient;
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
    const current = await (args.payPalClient ?? createPayPalClient()).getSubscription(providerSubscriptionId);
    const tier = getSupportTierForPayPalPlan(current.planId);
    const status = translatePayPalStatus(current);
    const synchronized = await synchronizeVerifiedPayPalSubscription({
      database,
      providerSubscription: current,
      tier,
      status,
    });
    const result = synchronized ? "processed" as const : "ignored" as const;
    await database.supportProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: result === "processed" ? "PROCESSED" : "IGNORED", processedAt: new Date() } });
    return result;
  } catch (error) {
    await database.supportProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: "FAILED" } });
    throw error;
  }
}
