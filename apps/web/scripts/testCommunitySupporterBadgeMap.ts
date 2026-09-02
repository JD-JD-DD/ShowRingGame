import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupporterBadgePresentation } from "../lib/supporterBadgePresentation";
import { isCurrentSupportSubscriptionAt } from "../server/services/supportSubscription.service";

const now = new Date("2031-01-01T00:00:00Z");
const scheduledCancellation = (currentPaidPeriodEnd: Date | null) => ({
  status: "CANCELLATION_SCHEDULED" as const,
  currentPaidPeriodEnd,
});
assert.equal(isCurrentSupportSubscriptionAt({ status: "ACTIVE", currentPaidPeriodEnd: null }, now), true, "active subscriptions remain current");
assert.equal(isCurrentSupportSubscriptionAt(scheduledCancellation(new Date(now.getTime() + 1)), now), true, "scheduled cancellation remains current before paid-through expiry");
assert.equal(isCurrentSupportSubscriptionAt(scheduledCancellation(now), now), false, "scheduled cancellation is not current at the paid-through boundary");
assert.equal(isCurrentSupportSubscriptionAt(scheduledCancellation(new Date(now.getTime() - 1)), now), false, "scheduled cancellation is not current after paid-through expiry");
for (const tier of ["BRONZE", "SILVER", "GOLD"] as const) assert.deepEqual(getSupporterBadgePresentation({ tier, status: "ACTIVE", showSupporterBadge: true, now }), { visible: true, tier });
assert.equal(getSupporterBadgePresentation({ tier: "GOLD", status: "ACTIVE", showSupporterBadge: false, now }).visible, false);
assert.equal(getSupporterBadgePresentation({ tier: "SILVER", status: "PAYMENT_RETRY", showSupporterBadge: true, now }).visible, true);
assert.equal(getSupporterBadgePresentation({ tier: "SILVER", status: "CANCELLATION_SCHEDULED", showSupporterBadge: true, currentPaidPeriodEnd: new Date(now.getTime() + 1), now }).visible, true);
for (const status of ["PENDING", "ENDED"]) assert.equal(getSupporterBadgePresentation({ tier: "SILVER", status, showSupporterBadge: true, now }).visible, false);
const service = readFileSync(join(process.cwd(), "../..", "apps/web/server/services/communitySupporterBadge.service.ts"), "utf8");
assert.match(service, /new Set\(userIds\.filter/); assert.match(service, /findMany/); assert.match(service, /isCurrentSupportSubscriptionAt\(selected\)/); assert.match(service, /getSupporterBadgePresentation/); assert.match(service, /result\.set\(userId, presentation\.visible \? \{ tier: presentation\.tier \} : null\)/);
assert.doesNotMatch(service, /providerSubscriptionId|providerPlanId|billingAmount|paymentFailureStartedAt|lastPaymentFailureAt|lastPaymentRecoveryAt|cancellationRequestedAt/);
assert.doesNotMatch(service, /paypalSupport|PayPalClient|createPayPalClient|getSubscription\(/);
assert.doesNotMatch(service, /orderBy:\s*\{[^}]*support/i);
console.log("SUPPORT-08A-2A community supporter badge map checks passed.");
