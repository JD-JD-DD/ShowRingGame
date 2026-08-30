import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createPayPalSupportSubscription,
  getCanonicalSupportSubscription,
  SupportSubscriptionError,
  synchronizeVerifiedPayPalSubscription,
} from "../server/services/supportSubscription.service";
import type { PayPalSupportConfig } from "../server/services/paypalSupport.service";

const root = existsSync(join(process.cwd(), "app")) ? join(process.cwd(), "../..") : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const firstSupportedAt = new Date("2030-08-01T10:00:00.000Z");
const historicalEndedAt = new Date("2030-09-01T10:00:00.000Z");
const newActivation = new Date("2031-01-01T10:00:00.000Z");
const config: PayPalSupportConfig = {
  environment: "sandbox", clientId: "test", clientSecret: "test", productId: "test",
  planIds: { BRONZE: "bronze-plan", SILVER: "silver-plan", GOLD: "gold-plan" }, webhookId: "test",
};

function fixture() {
  const historical: any = {
    id: "historical-silver", userId: "user-1", provider: "PAYPAL", providerSubscriptionId: "I-historical-silver",
    currentTier: "SILVER", status: "ENDED", firstSupportedAt: new Date(firstSupportedAt), endedAt: new Date(historicalEndedAt),
    currentPaidPeriodStart: new Date("2030-08-01T10:00:00.000Z"), currentPaidPeriodEnd: new Date(historicalEndedAt),
    cancellationRequestedAt: new Date("2030-08-15T10:00:00.000Z"), lastPaymentFailureAt: null, paymentFailureStartedAt: null, lastPaymentRecoveryAt: null,
    tierPeriods: [{ id: "historical-silver-period", tier: "SILVER", startedAt: new Date(firstSupportedAt), endedAt: new Date(historicalEndedAt) }],
  };
  const subscriptions: any[] = [historical];
  const createdSubscriptions: any[] = [];
  const createdPeriods: any[] = [];
  const providerIds = new Set([historical.providerSubscriptionId]);
  const currentStatuses = new Set(["PENDING", "ACTIVE", "PAYMENT_RETRY", "CANCELLATION_SCHEDULED"]);
  const database: any = {
    supportSubscriptionChange: { findFirst: async () => null },
    supportSubscription: {
      findFirst: async ({ where }: any) => {
        if (where.status?.in) return subscriptions.find((subscription) => subscription.userId === where.userId && currentStatuses.has(subscription.status)) ?? null;
        if (where.firstSupportedAt?.not === null) return subscriptions.filter((subscription) => subscription.userId === where.userId && subscription.firstSupportedAt).sort((left, right) => left.firstSupportedAt - right.firstSupportedAt)[0] ?? null;
        return null;
      },
      findMany: async ({ where }: any) => subscriptions.filter((subscription) => subscription.userId === where.userId && where.status.in.includes(subscription.status)),
      findUnique: async ({ where }: any) => subscriptions.find((subscription) => subscription.id === where.id || subscription.providerSubscriptionId === where.providerSubscriptionId) ?? null,
      create: async ({ data }: any) => {
        assert.ok(!providerIds.has(data.providerSubscriptionId), "new support retains provider-subscription uniqueness");
        providerIds.add(data.providerSubscriptionId);
        const created = { id: "new-bronze", ...data, lastPaymentFailureAt: null, paymentFailureStartedAt: null, lastPaymentRecoveryAt: null, tierPeriods: [] };
        subscriptions.push(created);
        createdSubscriptions.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const subscription = subscriptions.find((candidate) => candidate.id === where.id);
        assert.ok(subscription, "only an existing subscription can be synchronized");
        Object.assign(subscription, data);
        return subscription;
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      $queryRaw: async () => [{ id: "user-1" }],
      supportSubscription: database?.supportSubscription,
      supportSubscriptionTierPeriod: {
        create: async ({ data }: any) => {
          const subscription = subscriptions.find((candidate) => candidate.id === data.supportSubscriptionId);
          assert.ok(subscription, "new tier history belongs to the new support row");
          const period = { id: `period-${createdPeriods.length + 1}`, ...data, endedAt: null };
          subscription.tierPeriods.push(period);
          createdPeriods.push(period);
          return period;
        },
        update: async ({ where, data }: any) => {
          const period = subscriptions.flatMap((subscription) => subscription.tierPeriods).find((candidate) => candidate.id === where.id);
          assert.ok(period, "only existing history can be closed");
          Object.assign(period, data);
          return period;
        },
      },
    }),
  };
  return { database, historical, subscriptions, createdSubscriptions, createdPeriods };
}

async function main() {
  const state = fixture();
  assert.equal(await getCanonicalSupportSubscription({ userId: "user-1", database: state.database }), null, "an ended former supporter has no canonical current subscription");
  assert.equal(state.historical.tierPeriods[0].endedAt?.getTime(), historicalEndedAt.getTime(), "historical tier history is already closed");

  let createCalls = 0;
  const payPalClient: any = {
    createSubscription: async () => { createCalls += 1; return { providerSubscriptionId: "I-new-bronze", approvalUrl: "https://example.test/approve" }; },
    getSubscription: async () => ({ id: "I-new-bronze", status: "APPROVAL_PENDING", planId: "bronze-plan", startTime: null, nextBillingTime: null }),
  };
  const created = await createPayPalSupportSubscription({ userId: "user-1", tier: "BRONZE", returnUrl: "https://example.test/return", cancelUrl: "https://example.test/cancel", database: state.database, payPalClient, config });
  assert.equal(created.status, "PENDING");
  assert.equal(createCalls, 1);
  assert.equal(state.createdSubscriptions.length, 1, "re-support creates a distinct provider-backed row");
  const bronze = state.createdSubscriptions[0];
  assert.notEqual(bronze.id, state.historical.id);
  assert.equal(bronze.firstSupportedAt?.getTime(), firstSupportedAt.getTime(), "re-support retains the account's earliest first-support date while pending");
  assert.equal(state.historical.status, "ENDED", "historical Silver remains ended during pending re-support");
  assert.equal(state.historical.tierPeriods.length, 1, "historical tier periods are not rewritten");

  await assert.rejects(() => createPayPalSupportSubscription({ userId: "user-1", tier: "BRONZE", returnUrl: "https://example.test/return", cancelUrl: "https://example.test/cancel", database: state.database, payPalClient, config }), SupportSubscriptionError);
  assert.equal(createCalls, 1, "a pending re-support prevents duplicate PayPal subscription creation");

  await synchronizeVerifiedPayPalSubscription({
    database: state.database,
    providerSubscription: { id: "I-new-bronze", status: "ACTIVE", planId: "bronze-plan", startTime: newActivation, nextBillingTime: new Date("2031-02-01T10:00:00.000Z") },
    tier: "BRONZE",
    status: "ACTIVE",
  });
  const canonical = await getCanonicalSupportSubscription({ userId: "user-1", database: state.database });
  assert.equal(canonical?.id, bronze.id, "verified Bronze becomes canonical/current");
  assert.equal(bronze.status, "ACTIVE");
  assert.equal(bronze.firstSupportedAt?.getTime(), firstSupportedAt.getTime(), "activation preserves original first-support history");
  assert.equal(bronze.tierPeriods.length, 1, "activation opens one new Bronze tier period");
  assert.equal(bronze.tierPeriods[0].tier, "BRONZE");
  assert.equal(bronze.tierPeriods[0].startedAt.getTime(), newActivation.getTime());
  assert.equal(state.historical.status, "ENDED");
  assert.equal(state.historical.tierPeriods[0].endedAt?.getTime(), historicalEndedAt.getTime(), "the historical support gap remains intact");

  const accountPage = source("apps/web/app/account/settings/support/page.tsx");
  const enrollment = source("apps/web/components/support/SupportEnrollment.tsx");
  assert.match(accountPage, /Thank you for supporting ShowRing during development\./);
  assert.match(accountPage, /First supported/);
  assert.match(accountPage, /Previous level/);
  assert.match(accountPage, /Not currently supporting/);
  assert.match(accountPage, /Support Again/);
  assert.doesNotMatch(accountPage, /\bENDED\b/, "former-supporter UI does not leak the stored enum");
  assert.match(accountPage, /subscription\.status === "ACTIVE"[\s\S]*SupportManagementAffordances/, "current management controls remain active-only");
  assert.doesNotMatch(accountPage + enrollment, /lifetime amount|you have contributed|supporter score|supporter rank/i, "former-supporter presentation has no lifetime-spend or guilt messaging");
  console.log("SUPPORT-07 Test H former-supporter checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
