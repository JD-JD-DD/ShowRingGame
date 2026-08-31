import { db } from "@/lib/db";
import { reconcileArtPaymentAttempt } from "@/server/services/artPaymentFinalization.service";

const ART_EVENT_TYPES = new Set([
  "CHECKOUT.ORDER.APPROVED", "CHECKOUT.PAYMENT-APPROVAL.REVERSED", "PAYMENT.AUTHORIZATION.CREATED", "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.DECLINED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED",
  "CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED", "CUSTOMER.DISPUTE.RESOLVED",
]);

export async function processVerifiedArtPaymentWebhook(args: { event: { id: string; event_type: string; resource?: Record<string, unknown> }; database?: any }) {
  if (!ART_EVENT_TYPES.has(args.event.event_type)) return false;
  const database = args.database ?? db;
  const resourceId = typeof args.event.resource?.id === "string" ? args.event.resource.id : null;
  const attempt = resourceId ? await database.artPaymentAttempt.findFirst({ where: { OR: [{ providerOrderId: resourceId }, { providerAuthorizationId: resourceId }, { providerCaptureId: resourceId }] } }) : null;
  let providerEvent: any;
  try { providerEvent = await database.artPaymentProviderEvent.create({ data: { provider: "PAYPAL", providerEventId: args.event.id, eventType: args.event.event_type, artPaymentAttemptId: attempt?.id ?? null, providerResourceId: resourceId } }); }
  catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const existing = await database.artPaymentProviderEvent.findUnique({ where: { providerEventId: args.event.id } });
    if (!existing || ["PROCESSED", "IGNORED"].includes(existing.processingStatus)) return true;
    providerEvent = existing;
  }
  try {
    if (attempt) await reconcileArtPaymentAttempt({ attemptId: attempt.id, database });
    await database.artPaymentProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: attempt ? "PROCESSED" : "IGNORED", processedAt: new Date() } });
  } catch (error) {
    await database.artPaymentProviderEvent.update({ where: { id: providerEvent.id }, data: { processingStatus: "FAILED" } });
    throw error;
  }
  return true;
}
