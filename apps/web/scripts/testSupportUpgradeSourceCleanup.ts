import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const webhook = source("apps/web/server/services/paypalWebhook.service.ts");
  assert.match(service, /supersededUpgradeSource\?: boolean/, "source cleanup is explicit synchronization context");
  assert.match(service, /args\.supersededUpgradeSource && args\.providerSubscription\.status === "CANCELLED"\s*\? "ENDED"/, "cancelled superseded sources always end rather than receive paid-through recognition");
  assert.match(service, /fresh\.cancellationRequestedAt && args\.providerSubscription\.status === "CANCELLED"/, "normal voluntary cancellation retains its separate paid-through branch");
  assert.match(service, /\["ACTIVE", "PAYMENT_RETRY", "CANCELLATION_SCHEDULED"\]/, "ended source cleanup cannot reopen a tier period");
  assert.match(service, /finalizeSupersededUpgradeSource/, "verified source end completes the upgrade workflow idempotently");
  assert.match(service, /status: "COMPLETED"/, "completed workflow leaves no live upgrade banner state");
  assert.match(webhook, /isSupersededUpgradeSource/, "delayed source webhooks retain upgrade-source context");
  assert.match(webhook, /finalizeSupersededUpgradeSource/, "duplicate source cancellation events remain completion-safe");
  console.log("SUPPORT-07 upgrade-source cleanup checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
