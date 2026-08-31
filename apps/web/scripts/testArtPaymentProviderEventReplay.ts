import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { replayFailedArtPaymentProviderEvents } from "../server/services/artPaymentProviderEventReplayRunner.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const webhook = source("apps/web/server/services/artPaymentWebhook.service.ts");
const runner = source("apps/web/server/services/artPaymentProviderEventReplayRunner.service.ts");
const route = source("apps/web/app/api/cron/replay-art-payment-events/route.ts");
const vercel = source("apps/web/vercel.json");

assert.match(webhook, /processArtProviderEvent/);
assert.match(webhook, /replayFailedArtPaymentProviderEvent/);
assert.match(webhook, /providerEvent\.processingStatus !== "FAILED"/);
assert.match(webhook, /unresolvedOutcome: "FAILED"/);
assert.match(webhook, /artPaymentAttemptId: attempt\.id/);
assert.doesNotMatch(webhook, /SupportProviderEvent|SupportSubscription|LedgerTransaction|kennel\.balance/);
assert.match(runner, /ART_PAYMENT_PROVIDER_EVENT_REPLAY_BATCH_SIZE = 10/);
assert.match(runner, /where: \{ processingStatus: "FAILED" \}/);
assert.match(runner, /orderBy: \[\{ receivedAt: "asc" \}, \{ id: "asc" \}\]/);
assert.match(runner, /take: ART_PAYMENT_PROVIDER_EVENT_REPLAY_BATCH_SIZE/);
assert.match(runner, /await replayEvent\(\{ providerEventId: event\.providerEventId, database \}\)/);
assert.doesNotMatch(runner, /ArtContribution|captureArtAuthorization|voidArtAuthorization|SupportProviderEvent|LedgerTransaction|kennel\.balance/);
assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /replayFailedArtPaymentProviderEvents\(\)/);
assert.match(vercel, /"path": "\/api\/cron\/replay-art-payment-events",\s*"schedule": "\*\/15 \* \* \* \*"/);
assert.match(vercel, /"path": "\/api\/cron\/reconcile-art-payments",\s*"schedule": "\*\/5 \* \* \* \*"/);

async function main() {
  const statuses = new Map([
    ["failed-capture", "FAILED"],
    ["failed-refund", "FAILED"],
    ["later-error", "FAILED"],
  ]);
  let query: any;
  const summary = await replayFailedArtPaymentProviderEvents({
    database: {
      artPaymentProviderEvent: {
        findMany: async (args: unknown) => {
          query = args;
          return [
            { id: "event-1", providerEventId: "failed-capture" },
            { id: "event-2", providerEventId: "failed-refund" },
            { id: "event-3", providerEventId: "later-error" },
          ];
        },
        findUnique: async ({ where }: { where: { providerEventId: string } }) => ({ processingStatus: statuses.get(where.providerEventId) }),
      },
    },
    replayEvent: async ({ providerEventId }) => {
      if (providerEventId === "failed-capture") statuses.set(providerEventId, "PROCESSED");
      else if (providerEventId === "failed-refund") statuses.set(providerEventId, "IGNORED");
      else throw new Error("safe test failure");
      return "PROCESSED";
    },
  });

  assert.deepEqual(query, {
    where: { processingStatus: "FAILED" },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    take: 10,
    select: { id: true, providerEventId: true },
  }, "runner selects only the bounded deterministic FAILED-event batch");
  assert.deepEqual(
    { ...summary, durationMs: 0 },
    { selected: 3, processed: 3, recovered: 1, ignored: 1, stillFailed: 1, failed: 1, durationMs: 0 },
    "one replay failure leaves its event visible without stopping later events"
  );
  console.log("ART-08C Breed Art provider-event replay checks passed.");
}

void main();
