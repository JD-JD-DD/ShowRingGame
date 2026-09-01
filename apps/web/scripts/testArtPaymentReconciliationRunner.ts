import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { reconcilePendingArtPayments } from "../server/services/artPaymentReconciliationRunner.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const runner = source("apps/web/server/services/artPaymentReconciliationRunner.service.ts");
const finalizer = source("apps/web/server/services/artPaymentFinalization.service.ts");
const route = source("apps/web/app/api/cron/reconcile-art-payments/route.ts");
const vercel = source("apps/web/vercel.json");
const schema = source("apps/web/prisma/schema.prisma");

assert.match(runner, /ART_PAYMENT_RECONCILIATION_BATCH_SIZE = 10/);
assert.match(runner, /RECONCILABLE_STATUSES = \["RECONCILING", "VOID_PENDING"\]/);
assert.match(runner, /orderBy: \[\{ updatedAt: "asc" \}, \{ id: "asc" \}\]/);
assert.match(runner, /take: ART_PAYMENT_RECONCILIATION_BATCH_SIZE/);
assert.match(runner, /await reconcileAttempt\(\{ attemptId: attempt\.id, database \}\)/);
assert.match(runner, /for \(const attempt of attempts\)/);
assert.match(runner, /art-payment-reconciliation-attempt-failed/);
assert.doesNotMatch(runner, /ArtContribution|captureArtAuthorization|voidArtAuthorization|LedgerTransaction|kennel\.balance/);
assert.match(finalizer, /attempt\.status === "VOID_PENDING"/);
assert.match(finalizer, /getArtAuthorization\(attempt\.providerAuthorizationId\)/);
assert.match(finalizer, /attempt\.paypalVoidRequestId \?\? randomUUID\(\)/);
assert.match(finalizer, /attempt\.status === "RECONCILING" && attempt\.providerAuthorizationId && attempt\.paypalCaptureRequestId/);
assert.match(finalizer, /const order = await client\.getArtOrder\(attempt\.providerOrderId\)/);
assert.match(finalizer, /findCompletedOrderCapture\(order, attempt\)/);
assert.doesNotMatch(finalizer, /captureArtAuthorization\(attempt\.providerAuthorizationId, \{ amountCents: attempt\.expectedAmountCents, requestId: attempt\.paypalCaptureRequestId \}\)/);
assert.match(finalizer, /finalizeCapturedAttempt\(database, attempt\.id, capture\)/);
assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /authHeader !== `Bearer \$\{cronSecret\}`/);
assert.match(route, /reconcilePendingArtPayments\(\)/);
assert.match(vercel, /"path": "\/api\/cron\/reconcile-art-payments",\s*"schedule": "\*\/5 \* \* \* \*"/);
assert.match(schema, /enum ArtPaymentAttemptStatus/);
assert.doesNotMatch(route, /attemptId.*searchParams|attemptId.*json/);

async function main() {
  const statuses = new Map([
    ["old-capture", "RECONCILING"],
    ["old-void", "VOID_PENDING"],
    ["later-error", "RECONCILING"],
  ]);
  let query: any;
  const summary = await reconcilePendingArtPayments({
    database: {
      artPaymentAttempt: {
        findMany: async (args: unknown) => {
          query = args;
          return [{ id: "old-capture" }, { id: "old-void" }, { id: "later-error" }];
        },
        findUnique: async ({ where }: { where: { id: string } }) => ({ status: statuses.get(where.id) }),
      },
    },
    reconcileAttempt: async ({ attemptId }) => {
      if (attemptId === "old-capture") statuses.set(attemptId, "COMPLETED");
      else if (attemptId === "old-void") statuses.set(attemptId, "VOIDED");
      else throw new Error("safe test failure");
      return null;
    },
  });

  assert.deepEqual(query, {
    where: { status: { in: ["RECONCILING", "VOID_PENDING"] } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 10,
    select: { id: true },
  }, "runner selects only the bounded deterministic unresolved batch");
  assert.deepEqual(
    { ...summary, durationMs: 0 },
    { selected: 3, processed: 3, completed: 1, voided: 1, stillPending: 0, failed: 1, durationMs: 0 },
    "one failed attempt does not prevent later canonical reconciliation outcomes"
  );
  console.log("ART-08A Breed Art payment reconciliation runner checks passed.");
}

void main();
