import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getCanonicalSupportSubscription } from "../server/services/supportSubscription.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const boundary = new Date("2031-09-29T10:00:00.000Z");
const firstSupportedAt = new Date("2031-08-29T10:00:00.000Z");

async function withNow<T>(now: Date, callback: () => Promise<T>): Promise<T> {
  const NativeDate = globalThis.Date;
  class ControlledDate extends NativeDate {
    constructor(value?: string | number) {
      super(arguments.length === 0 ? now.getTime() : value as string | number);
    }
    static now() { return now.getTime(); }
  }
  globalThis.Date = ControlledDate as DateConstructor;
  try { return await callback(); } finally { globalThis.Date = NativeDate; }
}

function fixture() {
  const subscription: any = {
    id: "support-silver", userId: "user-1", provider: "PAYPAL", providerSubscriptionId: "I-silver",
    currentTier: "SILVER", status: "CANCELLATION_SCHEDULED", cancellationRequestedAt: new Date("2031-09-01T10:00:00.000Z"),
    endedAt: null, currentPaidPeriodEnd: new Date(boundary), firstSupportedAt: new Date(firstSupportedAt),
    tierPeriods: [{ id: "silver-period", tier: "SILVER", startedAt: new Date(firstSupportedAt), endedAt: null }],
  };
  const subscriptionUpdates: any[] = [];
  const tierPeriodUpdates: any[] = [];
  const database: any = {
    supportSubscriptionChange: { findFirst: async () => null },
    supportSubscription: {
      findMany: async () => subscription.status === "CANCELLATION_SCHEDULED" ? [subscription] : [],
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      supportSubscription: {
        findUnique: async () => subscription,
        update: async ({ data }: any) => { subscriptionUpdates.push(data); Object.assign(subscription, data); return subscription; },
      },
      supportSubscriptionTierPeriod: {
        update: async ({ where, data }: any) => {
          const period = subscription.tierPeriods.find((candidate: any) => candidate.id === where.id);
          assert.ok(period, "finalization updates only the existing tier period");
          tierPeriodUpdates.push({ where, data });
          Object.assign(period, data);
          return period;
        },
      },
    }),
  };
  return { database, subscription, subscriptionUpdates, tierPeriodUpdates };
}

async function canonicalAt(database: any, now: Date) {
  return withNow(now, () => getCanonicalSupportSubscription({ userId: "user-1", database }));
}

async function main() {
  const before = fixture();
  const beforeCurrent = await canonicalAt(before.database, new Date(boundary.getTime() - 1));
  assert.equal(beforeCurrent?.id, before.subscription.id, "one instant before the boundary remains current");
  assert.equal(before.subscription.status, "CANCELLATION_SCHEDULED");
  assert.equal(before.subscription.tierPeriods[0].endedAt, null, "the paid-through tier period remains open before expiry");
  assert.equal(before.subscriptionUpdates.length, 0);
  assert.equal(before.tierPeriodUpdates.length, 0);

  const atBoundary = fixture();
  const former = await canonicalAt(atBoundary.database, boundary);
  assert.equal(former, null, "the exact paid-through boundary is no longer current");
  assert.equal(atBoundary.subscription.status, "ENDED");
  assert.equal(atBoundary.subscription.endedAt?.getTime(), boundary.getTime(), "ended history uses the entitlement boundary");
  assert.equal(atBoundary.subscription.currentPaidPeriodEnd?.getTime(), boundary.getTime(), "paid-through evidence is retained");
  assert.equal(atBoundary.subscription.tierPeriods[0].endedAt?.getTime(), boundary.getTime(), "the open Silver period closes exactly at paid-through");
  assert.equal(atBoundary.subscription.firstSupportedAt?.getTime(), firstSupportedAt.getTime(), "first support history is retained");
  assert.equal(atBoundary.subscriptionUpdates.length, 1);
  assert.equal(atBoundary.tierPeriodUpdates.length, 1);

  const after = fixture();
  assert.equal(await canonicalAt(after.database, new Date(boundary.getTime() + 1)), null, "after the boundary is not current");
  assert.equal(after.subscription.status, "ENDED");
  assert.equal(after.tierPeriodUpdates[0].data.endedAt.getTime(), boundary.getTime(), "after-boundary finalization still closes at the boundary");

  await canonicalAt(after.database, new Date(boundary.getTime() + 2));
  assert.equal(after.subscriptionUpdates.length, 1, "a second pass does not change the ended subscription");
  assert.equal(after.tierPeriodUpdates.length, 1, "a second pass does not close history twice");
  assert.equal(after.subscription.endedAt?.getTime(), boundary.getTime(), "a second pass does not drift endedAt");
  assert.equal(after.subscription.tierPeriods.length, 1, "a second pass does not create history");

  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const accountPage = source("apps/web/app/account/settings/support/page.tsx");
  assert.match(service, /isCurrentSupportSubscriptionAt\(subscription\)/, "expiration uses the shared inclusive current-state predicate");
  assert.match(service, /endedAt: fresh\.endedAt \?\? fresh\.currentPaidPeriodEnd/, "finalization preserves an existing ended timestamp");
  assert.doesNotMatch(service.slice(service.indexOf("async function finalizeElapsedCancellation"), service.indexOf("export async function getCanonicalSupportSubscription")), /PayPal|paypal|createSubscription|cancelSubscription|reviseSubscription|getSubscription/, "expiration is local and provider-independent");
  assert.match(accountPage, /subscription \? <SupportDetails[\s\S]*Support Again/, "ended support presents the normal Support Again path");
  assert.match(accountPage, /subscription\.status === "ACTIVE"[\s\S]*SupportManagementAffordances/, "management controls remain active-only");
  console.log("SUPPORT-07 Test G paid-through expiration checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
