import { db } from "@/lib/db";
import { reconcileArtPaymentAttempt } from "@/server/services/artPaymentFinalization.service";

const ART_EVENT_TYPES = new Set([
  "CHECKOUT.ORDER.APPROVED", "CHECKOUT.PAYMENT-APPROVAL.REVERSED", "PAYMENT.AUTHORIZATION.CREATED", "PAYMENT.AUTHORIZATION.VOIDED",
  "PAYMENT.CAPTURE.PENDING", "PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.DECLINED", "PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED",
  "CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED", "CUSTOMER.DISPUTE.RESOLVED",
]);

type Database = any;
type ArtWebhookEvent = { id: string; event_type: string; resource?: Record<string, unknown> };
type ArtProviderEvent = { id: string; providerEventId: string; eventType: string; providerResourceId: string | null; artPaymentAttemptId?: string | null; processingStatus?: string };
type ArtProviderEventOutcome = "PROCESSED" | "IGNORED" | "FAILED" | "SKIPPED";

function providerResourceId(event: ArtWebhookEvent) {
  return typeof event.resource?.id === "string" ? event.resource.id : null;
}

async function resolveAttempt(database: Database, resourceId: string | null) {
  return resourceId
    ? database.artPaymentAttempt.findFirst({ where: { OR: [{ providerOrderId: resourceId }, { providerAuthorizationId: resourceId }, { providerCaptureId: resourceId }] } })
    : null;
}

async function processArtProviderEvent(args: { providerEvent: ArtProviderEvent; database: Database; unresolvedOutcome?: "IGNORED" | "FAILED" }): Promise<ArtProviderEventOutcome> {
  const attempt = await resolveAttempt(args.database, args.providerEvent.providerResourceId);
  if (!attempt && args.unresolvedOutcome === "FAILED") return "FAILED";
  try {
    if (attempt) {
      if (args.providerEvent.artPaymentAttemptId !== attempt.id) {
        await args.database.artPaymentProviderEvent.update({ where: { id: args.providerEvent.id }, data: { artPaymentAttemptId: attempt.id } });
      }
      await reconcileArtPaymentAttempt({ attemptId: attempt.id, database: args.database });
    }
    const outcome = attempt ? "PROCESSED" : "IGNORED";
    await args.database.artPaymentProviderEvent.update({ where: { id: args.providerEvent.id }, data: { processingStatus: outcome, processedAt: new Date() } });
    return outcome;
  } catch (error) {
    await args.database.artPaymentProviderEvent.update({ where: { id: args.providerEvent.id }, data: { processingStatus: "FAILED" } });
    throw error;
  }
}

export async function processVerifiedArtPaymentWebhook(args: { event: ArtWebhookEvent; database?: Database }) {
  if (!ART_EVENT_TYPES.has(args.event.event_type)) return false;
  const database = args.database ?? db;
  const resourceId = providerResourceId(args.event);
  const attempt = await resolveAttempt(database, resourceId);
  let providerEvent: ArtProviderEvent;
  try {
    providerEvent = await database.artPaymentProviderEvent.create({ data: { provider: "PAYPAL", providerEventId: args.event.id, eventType: args.event.event_type, artPaymentAttemptId: attempt?.id ?? null, providerResourceId: resourceId } });
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    const existing = await database.artPaymentProviderEvent.findUnique({ where: { providerEventId: args.event.id } });
    if (!existing || ["PROCESSED", "IGNORED"].includes(existing.processingStatus)) return true;
    providerEvent = existing;
  }
  await processArtProviderEvent({ providerEvent, database });
  return true;
}

export async function replayFailedArtPaymentProviderEvent(args: { providerEventId: string; database?: Database }): Promise<ArtProviderEventOutcome> {
  const database = args.database ?? db;
  const providerEvent = await database.artPaymentProviderEvent.findUnique({ where: { providerEventId: args.providerEventId } });
  if (!providerEvent || providerEvent.processingStatus !== "FAILED") return "SKIPPED";
  return processArtProviderEvent({ providerEvent, database, unresolvedOutcome: "FAILED" });
}
