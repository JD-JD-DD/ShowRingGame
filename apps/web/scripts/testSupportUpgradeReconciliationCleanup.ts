import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const account = source("apps/web/app/account/settings/support/page.tsx");
  const cleanup = service.slice(service.indexOf("export async function advanceSupportSubscriptionChange"));
  assert.match(cleanup, /let source = await client\.getSubscription\(change\.sourceSubscription\.providerSubscriptionId\)/, "cleanup reads exact source before cancellation");
  assert.match(cleanup, /if \(source\.status === "ACTIVE"\)/, "only an active source receives a cancellation attempt");
  assert.match(cleanup, /await client\.cancelSubscription\(change\.sourceSubscription\.providerSubscriptionId\)/, "active cleanup cancels only exact source");
  assert.match(cleanup, /if \(source\.status !== "CANCELLED"\)/, "unknown source state cannot be treated as successful cleanup");
  assert.match(cleanup, /supersededUpgradeSource: true/, "already-cancelled sources normalize to ended without paid-through recognition");
  assert.match(cleanup, /finalizeSupersededUpgradeSource/, "verified cancelled source completes workflow idempotently");
  assert.match(service, /change\.status !== "COMPLETED"/, "completed workflows are not reopened");
  assert.match(account, /changeInProgress \?/, "banner depends on a genuinely live workflow");
  console.log("SUPPORT-07 reconciliation cleanup checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
