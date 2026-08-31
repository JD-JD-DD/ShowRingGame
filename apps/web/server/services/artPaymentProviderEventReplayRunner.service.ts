import { db } from "@/lib/db";
import { replayFailedArtPaymentProviderEvent } from "@/server/services/artPaymentWebhook.service";

type Database = any;

export const ART_PAYMENT_PROVIDER_EVENT_REPLAY_BATCH_SIZE = 10;

export type ArtPaymentProviderEventReplaySummary = {
  selected: number;
  processed: number;
  recovered: number;
  ignored: number;
  stillFailed: number;
  failed: number;
  durationMs: number;
};

function sanitizedErrorSummary(error: unknown) {
  return error instanceof Error ? error.message : "Unknown provider-event replay error.";
}

export async function replayFailedArtPaymentProviderEvents(args: {
  database?: Database;
  replayEvent?: typeof replayFailedArtPaymentProviderEvent;
} = {}): Promise<ArtPaymentProviderEventReplaySummary> {
  const database = args.database ?? db;
  const replayEvent = args.replayEvent ?? replayFailedArtPaymentProviderEvent;
  const startedAtMs = Date.now();
  const events = await database.artPaymentProviderEvent.findMany({
    where: { processingStatus: "FAILED" },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: ART_PAYMENT_PROVIDER_EVENT_REPLAY_BATCH_SIZE,
    select: { id: true, providerEventId: true },
  });
  const summary: ArtPaymentProviderEventReplaySummary = {
    selected: events.length,
    processed: 0,
    recovered: 0,
    ignored: 0,
    stillFailed: 0,
    failed: 0,
    durationMs: 0,
  };

  for (const event of events) {
    summary.processed += 1;
    try {
      await replayEvent({ providerEventId: event.providerEventId, database });
      const current = await database.artPaymentProviderEvent.findUnique({
        where: { providerEventId: event.providerEventId },
        select: { processingStatus: true },
      });
      if (current?.processingStatus === "PROCESSED") summary.recovered += 1;
      else if (current?.processingStatus === "IGNORED") summary.ignored += 1;
      else summary.stillFailed += 1;
    } catch (error) {
      summary.stillFailed += 1;
      summary.failed += 1;
      console.error("art-payment-provider-event-replay-failed", {
        artPaymentProviderEventId: event.id,
        providerEventId: event.providerEventId,
        error: sanitizedErrorSummary(error),
      });
    }
  }

  summary.durationMs = Date.now() - startedAtMs;
  return summary;
}
