import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupporterBadgePresentation } from "../lib/supporterBadgePresentation";

const now = new Date("2031-01-01T00:00:00.000Z");
for (const tier of ["BRONZE", "SILVER", "GOLD"] as const) assert.deepEqual(getSupporterBadgePresentation({ tier, status: "ACTIVE", showSupporterBadge: true, now }), { visible: true, tier });
assert.deepEqual(getSupporterBadgePresentation({ tier: "GOLD", status: "ACTIVE", showSupporterBadge: false, now }), { visible: false });
assert.equal(getSupporterBadgePresentation({ tier: "SILVER", status: "PAYMENT_RETRY", showSupporterBadge: true, now }).visible, true);
assert.equal(getSupporterBadgePresentation({ tier: "BRONZE", status: "CANCELLATION_SCHEDULED", showSupporterBadge: true, currentPaidPeriodEnd: new Date(now.getTime() + 1), now }).visible, true);
for (const status of ["PENDING", "ENDED"]) assert.equal(getSupporterBadgePresentation({ tier: "BRONZE", status, showSupporterBadge: true, now }).visible, false);
assert.equal(getSupporterBadgePresentation({ tier: "BRONZE", status: "CANCELLATION_SCHEDULED", showSupporterBadge: true, currentPaidPeriodEnd: now, now }).visible, false);
const page = readFileSync(join(process.cwd(), "../..", "apps/web/app/kennels/[slug]/page.tsx"), "utf8");
assert.match(page, /getCanonicalSupportSubscription\(\{ userId: kennel\.userId \}\)/); assert.match(page, /getSupporterBadgePresentation/); assert.match(page, /<SupporterBadge tier=\{supporterBadge\.tier\}/);
assert.doesNotMatch(page, /providerSubscriptionId|planId|paymentFailureStartedAt|SupportSubscriptionChange/);
console.log("SUPPORT-08A-1 public kennel supporter badge checks passed.");
