import { db } from "@/lib/db";
import { reconcileArtPaymentAttempt } from "@/server/services/artPaymentFinalization.service";

type Database = any;

export const ART_PAYMENT_RECONCILIATION_BATCH_SIZE = 10;
const RECONCILABLE_STATUSES = ["RECONCILING", "VOID_PENDING"] as const;

export type ArtPaymentReconciliationSummary = {
  selected: number;
  processed: number;
  completed: number;
  voided: number;
  stillPending: number;
  failed: number;
  durationMs: number;
};

function sanitizedErrorSummary(error: unknown) {
  return error instanceof Error ? error.message : "Unknown reconciliation error.";
}

export async function reconcilePendingArtPayments(args: {
  database?: Database;
  reconcileAttempt?: typeof reconcileArtPaymentAttempt;
} = {}): Promise<ArtPaymentReconciliationSummary> {
  const database = args.database ?? db;
  const reconcileAttempt = args.reconcileAttempt ?? reconcileArtPaymentAttempt;
  const startedAtMs = Date.now();
  const attempts = await database.artPaymentAttempt.findMany({
    where: { status: { in: RECONCILABLE_STATUSES } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: ART_PAYMENT_RECONCILIATION_BATCH_SIZE,
    select: { id: true },
  });
  const summary: ArtPaymentReconciliationSummary = {
    selected: attempts.length,
    processed: 0,
    completed: 0,
    voided: 0,
    stillPending: 0,
    failed: 0,
    durationMs: 0,
  };

  for (const attempt of attempts) {
    summary.processed += 1;
    try {
      await reconcileAttempt({ attemptId: attempt.id, database });
      const current = await database.artPaymentAttempt.findUnique({
        where: { id: attempt.id },
        select: { status: true },
      });
      if (current?.status === "COMPLETED") summary.completed += 1;
      else if (current?.status === "VOIDED") summary.voided += 1;
      else if (current?.status === "RECONCILING" || current?.status === "VOID_PENDING") summary.stillPending += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("art-payment-reconciliation-attempt-failed", {
        attemptId: attempt.id,
        outcome: "ERROR",
        error: sanitizedErrorSummary(error),
      });
    }
  }

  summary.durationMs = Date.now() - startedAtMs;
  return summary;
}
