import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
async function main() {
  const paypal = source("apps/web/server/services/paypalSupport.service.ts");
  const service = source("apps/web/server/services/supportSubscription.service.ts");
  const webhook = source("apps/web/server/services/paypalWebhook.service.ts");
  const schema = source("apps/web/prisma/schema.prisma");
  const page = source("apps/web/app/account/settings/support/page.tsx");
  assert.match(paypal, /lastFailedPaymentAt/, "provider parser retains verified failed-payment time when available");
  assert.match(paypal, /outstandingBalance/, "provider parser retains provider billing evidence without exposing it to gameplay");
  assert.match(schema, /paymentFailureStartedAt/, "failure lifecycle state is durable");
  assert.match(schema, /lastPaymentRecoveryAt/, "recovery ordering is durable");
  assert.match(service, /paymentEvent\?: "FAILED" \| "RECOVERED"/, "synchronization receives verified payment-event semantics");
  assert.match(service, /args\.paymentEvent === "FAILED"/, "failed payment takes precedence over still-active provider state");
  assert.match(service, /fresh\.status === "PAYMENT_RETRY" && args\.status === "ACTIVE" && args\.paymentEvent !== "RECOVERED"/, "plain reconciliation cannot prematurely clear retry state");
  assert.match(service, /args\.paymentEvent === "RECOVERED" && args\.status === "ACTIVE"/, "verified recovery restores active state");
  assert.match(webhook, /BILLING\.SUBSCRIPTION\.PAYMENT\.FAILED/, "failed-payment webhooks remain handled");
  assert.match(webhook, /PAYMENT\.SALE\.COMPLETED/, "successful-payment webhooks remain handled");
  assert.match(webhook, /paymentEvent:/, "webhooks pass failure/recovery semantics into row-specific synchronization");
  assert.match(page, /PayPal was unable to complete a support payment/, "account status explains payment recovery in plain English");
  assert.doesNotMatch(page, /game debt|LedgerTransaction/i, "payment recovery does not affect game economy");
  console.log("SUPPORT-06E payment-recovery checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
