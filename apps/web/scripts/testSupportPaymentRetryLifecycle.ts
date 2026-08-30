import assert from "node:assert/strict";
import { synchronizeVerifiedPayPalSubscription } from "../server/services/supportSubscription.service";

function fixture() {
  const subscription: any = { id: "support-1", providerSubscriptionId: "I-test", currentTier: "SILVER", status: "ACTIVE", firstSupportedAt: new Date("2030-01-01Z"), currentPaidPeriodStart: new Date("2030-01-01Z"), currentPaidPeriodEnd: new Date("2030-02-01Z"), cancellationRequestedAt: null, endedAt: null, paymentFailureStartedAt: null, lastPaymentFailureAt: null, lastPaymentRecoveryAt: null, tierPeriods: [{ id: "period-1", tier: "SILVER", endedAt: null }] };
  const db: any = { $transaction: async (fn: any) => fn({ $queryRaw: async () => [], supportSubscription: { findUnique: async () => subscription, update: async ({ data }: any) => Object.assign(subscription, data) }, supportSubscriptionTierPeriod: { create: async () => assert.fail("retry must not create a tier period"), update: async () => assert.fail("retry must not rewrite a tier period") } }) };
  return { db, subscription };
}
async function sync(state: ReturnType<typeof fixture>, status: string, paymentEvent: "FAILED" | "RECOVERED" | undefined, at: string) {
  return synchronizeVerifiedPayPalSubscription({ database: state.db, providerSubscription: { id: "I-test", status, planId: "silver-plan", startTime: new Date("2030-01-01Z"), nextBillingTime: new Date("2030-02-01Z"), lastFailedPaymentAt: paymentEvent === "FAILED" ? new Date(at) : undefined }, tier: "SILVER", status: status === "SUSPENDED" ? "PAYMENT_RETRY" : "ACTIVE", paymentEvent, paymentEventAt: new Date(at) });
}
async function main() {
  const state = fixture();
  await sync(state, "ACTIVE", "FAILED", "2030-01-10T00:00:00Z");
  assert.equal(state.subscription.status, "PAYMENT_RETRY"); assert.equal(state.subscription.paymentFailureStartedAt?.toISOString(), "2030-01-10T00:00:00.000Z");
  await sync(state, "ACTIVE", "FAILED", "2030-01-12T00:00:00Z");
  assert.equal(state.subscription.lastPaymentFailureAt?.toISOString(), "2030-01-12T00:00:00.000Z");
  await sync(state, "ACTIVE", "FAILED", "2030-01-11T00:00:00Z");
  assert.equal(state.subscription.lastPaymentFailureAt?.toISOString(), "2030-01-12T00:00:00.000Z", "stale failure cannot regress history");
  await sync(state, "SUSPENDED", undefined, "2030-01-13T00:00:00Z"); assert.equal(state.subscription.status, "PAYMENT_RETRY");
  await sync(state, "ACTIVE", undefined, "2030-01-14T00:00:00Z"); assert.equal(state.subscription.status, "PAYMENT_RETRY", "reconciliation alone cannot recover");
  await sync(state, "ACTIVE", "RECOVERED", "2030-01-15T00:00:00Z"); assert.equal(state.subscription.status, "ACTIVE"); assert.equal(state.subscription.lastPaymentRecoveryAt?.toISOString(), "2030-01-15T00:00:00.000Z");
  await sync(state, "ACTIVE", "FAILED", "2030-01-14T00:00:00Z"); assert.equal(state.subscription.status, "ACTIVE", "stale failure cannot undo recovery");
  assert.equal(state.subscription.tierPeriods.length, 1); assert.equal(state.subscription.firstSupportedAt?.toISOString(), "2030-01-01T00:00:00.000Z");
  console.log("SUPPORT-07 Test J payment-retry lifecycle checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
