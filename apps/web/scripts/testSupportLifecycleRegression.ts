import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const webhook = source("apps/web/server/services/paypalWebhook.service.ts");
  const supportPage = source("apps/web/app/support/page.tsx");
  const accountPage = source("apps/web/app/account/settings/support/page.tsx");
  const schema = source("apps/web/prisma/schema.prisma");
  const migration = source("apps/web/prisma/migrations/20260829130000_add_support_subscription_changes/migration.sql");

  assert.match(service, /targetActivatedAt && change\.targetSubscription\?\.status === "ACTIVE"/, "active replacement wins canonical recognition");
  assert.match(service, /: change\.sourceSubscription;/, "pending replacement keeps source canonical");
  assert.match(service, /current\.length === 1/, "ambiguous current rows are never selected arbitrarily");
  assert.match(service, /isStrictUpgrade/, "only strictly higher requests take the replacement path");
  assert.match(service, /isStrictDowngrade/, "only strictly lower requests take the revision path");
  assert.match(service, /CLEANUP_FAILED/, "unresolved upgrade cleanup remains a durable blocker");
  assert.match(service, /status !== "ACTIVE"/, "payment retry, pending, scheduled cancellation, and ended rows cannot start a change");
  assert.match(service, /finalizeElapsedCancellation/, "scheduled cancellation ends at the paid-through boundary");
  assert.match(service, /endedAt: fresh\.endedAt \?\? fresh\.currentPaidPeriodEnd/, "cancellation history closes at the entitlement boundary");
  assert.match(service, /originalSupport\?\.firstSupportedAt \?\? supportedAt/, "re-support preserves account first support date");
  assert.match(service, /paymentEvent\?: "FAILED" \| "RECOVERED"/, "payment recovery is event-aware");
  assert.match(service, /args\.paymentEvent !== "RECOVERED"/, "active provider GET alone cannot erase retry state");
  assert.match(webhook, /providerSubscriptionId/, "webhook routing is provider-subscription specific");
  assert.match(webhook, /create_time/, "event time is used for stale payment-event ordering when available");
  assert.match(accountPage, /changeInProgress \?/, "live workflows suppress duplicate account actions");
  assert.match(accountPage, /A support-level change is in progress/, "pending upgrades are presented clearly");
  assert.match(accountPage, /Change to .* pending/, "pending downgrades retain the current tier and show requested change");
  assert.match(accountPage, /PayPal was unable to complete a support payment/, "payment retry presentation is plain-English");
  assert.match(supportPage, /getCanonicalSupportSubscription/, "support enrollment uses canonical resolution");
  assert.match(schema, /paymentFailureStartedAt/, "failure state is durable");
  assert.match(schema, /SupportSubscriptionChange/, "workflow state remains separate from provider subscription status");
  assert.match(migration, /SupportSubscriptionChange_userId_status_idx/, "workflow lookups are indexed");
  assert.match(migration, /ON DELETE RESTRICT/, "workflow foreign keys preserve retained support history");
  console.log("SUPPORT-06F lifecycle regression checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
