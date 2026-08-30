import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

async function main() {
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const paypal = source("apps/web/server/services/paypalSupport.service.ts");
  const schema = source("apps/web/prisma/schema.prisma");
  const webhook = source("apps/web/server/services/paypalWebhook.service.ts");
  const management = source("apps/web/components/support/SupportManagementAffordances.tsx");
  assert.match(schema, /DOWNGRADE/, "change type distinguishes scheduled downgrades");
  assert.match(schema, /expectedEffectiveAt\s+DateTime\?/, "provider-derived expected boundary is persisted");
  assert.match(paypal, /\/revise/, "PayPal revisions use the classic subscription revise endpoint");
  assert.match(paypal, /getPayPalPlanId\(args\.tier, this\.config\)/, "revision plan IDs are server configured");
  assert.match(service, /isStrictDowngrade/, "lower-tier requests are routed as downgrades");
  assert.match(service, /type: "DOWNGRADE"/, "downgrade state is durable");
  assert.match(service, /reviseSubscription/, "downgrade does not create a subscription");
  assert.match(service, /providerTier === args\.storedTier/, "old provider plan leaves downgrade pending");
  assert.match(service, /providerTier === change\.targetTier/, "only verified requested plan completes downgrade");
  assert.match(service, /completeVerifiedScheduledDowngrade/, "completion is idempotently workflow-linked");
  assert.match(webhook, /getVerifiedTierForSupportSubscription/, "webhook validates pending downgrade against provider GET");
  assert.match(webhook, /completeVerifiedScheduledDowngrade/, "webhook completes only verified downgrade");
  assert.match(management, /current support level will remain active until PayPal applies the lower level/, "downgrade disclosure preserves current recognition");
  assert.match(management, /You are not starting a second subscription or paying the lower amount today/, "downgrade consent explains PayPal's revision presentation");
  assert.match(management, /The new support level and monthly amount will take effect on your next billing date/, "downgrade consent preserves the next-cycle effective date");
  assert.match(management, /SILVER: \["GOLD", "BRONZE"\]/, "Silver exposes only Gold upgrade and Bronze downgrade");
  assert.match(management, /GOLD: \["SILVER", "BRONZE"\]/, "Gold exposes lower choices");
  console.log("SUPPORT-06C scheduled-downgrade checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
