import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  reconcilePayPalSupportSubscription,
  SupportSubscriptionError,
} from "../server/services/supportSubscription.service";
import type { PayPalSupportConfig, PayPalSupportSubscription } from "../server/services/paypalSupport.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const config: PayPalSupportConfig = {
  environment: "sandbox", clientId: "client", clientSecret: "secret", productId: "product",
  planIds: { BRONZE: "bronze-plan", SILVER: "silver-plan", GOLD: "gold-plan" }, webhookId: "webhook",
};

function subscription(status: string, planId = "bronze-plan"): PayPalSupportSubscription {
  return { id: "I-test", status, planId, startTime: new Date("2026-08-29T00:00:00.000Z"), nextBillingTime: new Date("2026-09-29T00:00:00.000Z") };
}

function database(initialStatus: string, options?: { activeDates?: boolean }) {
  const updates: unknown[] = [];
  const periods: unknown[] = [];
  const stored = {
    id: "support-1", currentTier: "BRONZE", status: initialStatus, provider: "PAYPAL", providerSubscriptionId: "I-test",
    currentPaidPeriodStart: options?.activeDates ? new Date("2026-08-29T00:00:00.000Z") : null,
    currentPaidPeriodEnd: options?.activeDates ? new Date("2026-09-29T00:00:00.000Z") : null,
    firstSupportedAt: options?.activeDates ? new Date("2026-08-29T00:00:00.000Z") : null,
    cancellationRequestedAt: null, endedAt: null, tierPeriods: options?.activeDates ? [{ id: "period-1", tier: "BRONZE" }] : [],
  };
  const tx = {
    $queryRaw: async () => [],
    supportSubscription: {
      findUnique: async () => stored,
      update: async (args: unknown) => { updates.push(args); return stored; },
    },
    supportSubscriptionTierPeriod: {
      create: async (args: unknown) => { periods.push(args); },
      update: async (args: unknown) => { periods.push(args); },
    },
  };
  return {
    supportSubscription: { findFirst: async () => stored },
    $transaction: async <T>(callback: (value: typeof tx) => Promise<T>) => callback(tx),
    updates, periods,
  };
}

async function reconcile(provider: PayPalSupportSubscription, initialStatus = "PENDING", activeDates = false) {
  const db = database(initialStatus, { activeDates });
  const result = await reconcilePayPalSupportSubscription({
    userId: "current-user", database: db,
    payPalClient: { getSubscription: async () => provider } as any,
    config,
  });
  return { result, db };
}

async function main() {
  const activated = await reconcile(subscription("ACTIVE"));
  assert.deepEqual(activated.result, { tier: "BRONZE", status: "ACTIVE" });
  assert.equal(activated.db.updates.length, 1, "verified ACTIVE updates the existing row");
  assert.equal(activated.db.periods.length, 1, "activation creates one missing tier-history period");
  assert.match(JSON.stringify(activated.db.updates[0]), /firstSupportedAt/, "activation retains canonical first-support synchronization");

  const pending = await reconcile(subscription("APPROVAL_PENDING"));
  assert.deepEqual(pending.result, { tier: "BRONZE", status: "PENDING" });
  assert.equal(pending.db.updates.length, 0, "unchanged pending state is a no-op");

  const activeNoOp = await reconcile(subscription("ACTIVE"), "ACTIVE", true);
  assert.equal(activeNoOp.db.updates.length, 0, "unchanged active state is idempotent");
  assert.equal(activeNoOp.db.periods.length, 0, "unchanged active state does not duplicate tier history");

  const wrongPlan = database("PENDING");
  await assert.rejects(() => reconcilePayPalSupportSubscription({
    userId: "current-user", database: wrongPlan,
    payPalClient: { getSubscription: async () => subscription("ACTIVE", "wrong-plan") } as any, config,
  }), SupportSubscriptionError);
  assert.equal(wrongPlan.updates.length, 0, "wrong plans do not mutate ShowRing state");

  const providerFailure = database("PENDING");
  await assert.rejects(() => reconcilePayPalSupportSubscription({
    userId: "current-user", database: providerFailure,
    payPalClient: { getSubscription: async () => { throw new Error("network"); } } as any, config,
  }));
  assert.equal(providerFailure.updates.length, 0, "provider failures do not mutate ShowRing state");

  const route = source("apps/web/app/api/support/reconcile/route.ts");
  const button = source("apps/web/components/support/ReconcileSupportStatusButton.tsx");
  const webhook = source("apps/web/server/services/paypalWebhook.service.ts");
  assert.match(route, /getSessionUserId/);
  assert.match(route, /export async function POST\(\)/);
  assert.doesNotMatch(route, /request|providerSubscriptionId|desiredStatus/);
  assert.match(button, /fetch\("\/api\/support\/reconcile", \{ method: "POST" \}\)/);
  assert.match(webhook, /synchronizeVerifiedPayPalSubscription/);
  assert.doesNotMatch(route, /supportProviderEvent|webhooks/);
  console.log("SUPPORT-04A reconciliation checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
