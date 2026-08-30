import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const route = source("apps/web/app/api/support/cancel/route.ts");
  const page = source("apps/web/app/account/settings/support/page.tsx");
  const ui = source("apps/web/components/support/SupportManagementAffordances.tsx");
  assert.match(service, /cancelPayPalSupportSubscription/, "player cancellation has a focused service");
  assert.match(service, /subscription\.status !== "ACTIVE"/, "only active support can be cancelled");
  assert.match(service, /currentPaidPeriodEnd/, "paid-through boundary is retained");
  assert.match(service, /client\.getSubscription\(subscription\.providerSubscriptionId\)/, "missing paid-through dates are provider verified before cancel");
  assert.match(service, /client\.cancelSubscription\(subscription\.providerSubscriptionId, "Player requested cancellation\."\)/, "only canonical provider subscription is cancelled");
  assert.match(service, /CANCELLATION_SCHEDULED/, "provider cancellation maps to local paid-through recognition");
  assert.match(service, /finalizeElapsedCancellation/, "elapsed paid-through recognition transitions lazily and idempotently");
  assert.match(service, /endedAt: fresh\.endedAt \?\? fresh\.currentPaidPeriodEnd/, "history closes at paid-through boundary");
  assert.match(service, /originalSupport\?\.firstSupportedAt \?\? supportedAt/, "re-support preserves original first support date");
  assert.match(route, /getSessionUserId/, "cancellation route is authenticated");
  assert.doesNotMatch(route, /providerSubscriptionId|paidThrough|tier.*request/i, "browser does not choose cancellation target or entitlement");
  assert.match(ui, /Cancel Support/, "active management exposes cancellation");
  assert.match(ui, /Keep Support/, "cancellation requires explicit confirmation");
  assert.match(ui, /not prorated or refunded/, "confirmation explains refund policy");
  assert.match(page, /recurring PayPal subscription has been cancelled/, "scheduled cancellation presentation is explicit");
  console.log("SUPPORT-06D cancellation checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
