import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PayPalSandboxClient, type PayPalSupportConfig } from "../server/services/paypalSupport.service";
import { parsePayPalWebhookEvent, processVerifiedPayPalWebhook, resolveProviderSubscriptionId } from "../server/services/paypalWebhook.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const config: PayPalSupportConfig = { clientId: "client", clientSecret: "secret", productId: "product", planIds: { BRONZE: "bronze", SILVER: "silver", GOLD: "gold" } };

async function main() {
  const responses = [{ access_token: "token" }, { verification_status: "SUCCESS" }, { verification_status: "FAILURE" }];
  const client = new PayPalSandboxClient(config, async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
  const headers = { authAlgo: "SHA256withRSA", certUrl: "https://api-m.sandbox.paypal.com/certs/test", transmissionId: "id", transmissionSig: "sig", transmissionTime: "2026-08-28T00:00:00Z" };
  assert.equal(await client.verifyWebhookSignature({ headers, event: { id: "WH-1" }, webhookId: "webhook" }), true);
  assert.equal(await client.verifyWebhookSignature({ headers, event: { id: "WH-2" }, webhookId: "webhook" }), false);
  const subscriptionEvent = parsePayPalWebhookEvent({ id: "WH-3", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-sub" } });
  const saleEvent = parsePayPalWebhookEvent({ id: "WH-4", event_type: "PAYMENT.SALE.COMPLETED", resource: { billing_agreement_id: "I-sub" } });
  assert.equal(resolveProviderSubscriptionId(subscriptionEvent), "I-sub");
  assert.equal(resolveProviderSubscriptionId(saleEvent), "I-sub");

  Object.assign(process.env, {
    PAYPAL_SANDBOX_CLIENT_ID: "client", PAYPAL_SANDBOX_CLIENT_SECRET: "secret", PAYPAL_SANDBOX_PRODUCT_ID: "product",
    PAYPAL_SANDBOX_PLAN_BRONZE_ID: "bronze", PAYPAL_SANDBOX_PLAN_SILVER_ID: "silver", PAYPAL_SANDBOX_PLAN_GOLD_ID: "gold",
  });
  const events: any[] = [];
  const subscription: any = { id: "support-1", providerSubscriptionId: "I-sub", currentTier: "BRONZE", status: "ACTIVE", firstSupportedAt: new Date("2026-08-01"), currentPaidPeriodStart: new Date("2026-08-01"), currentPaidPeriodEnd: new Date("2026-09-01"), cancellationRequestedAt: null, endedAt: null, tierPeriods: [{ id: "period-1", tier: "BRONZE", endedAt: null }] };
  const database: any = {
    supportProviderEvent: {
      create: async ({ data }: any) => { if (events.some((event) => event.providerEventId === data.providerEventId)) { const error: any = new Error(); error.code = "P2002"; throw error; } const event = { id: `event-${events.length + 1}`, processingStatus: "RECEIVED", ...data }; events.push(event); return event; },
      findUnique: async ({ where }: any) => events.find((event) => event.providerEventId === where.providerEventId) ?? null,
      update: async ({ where, data }: any) => Object.assign(events.find((event) => event.id === where.id), data),
    },
    $transaction: async (callback: any) => callback(database),
    $queryRaw: async () => [{ id: subscription.id }],
    supportSubscription: {
      findUnique: async ({ where, include }: any) => where.providerSubscriptionId === subscription.providerSubscriptionId || where.id === subscription.id ? (include ? subscription : subscription) : null,
      update: async ({ data }: any) => Object.assign(subscription, data),
    },
    supportSubscriptionTierPeriod: {
      update: async ({ where, data }: any) => Object.assign(subscription.tierPeriods.find((period: any) => period.id === where.id), data),
      create: async ({ data }: any) => subscription.tierPeriods.push({ id: `period-${subscription.tierPeriods.length + 1}`, ...data, endedAt: null }),
    },
  };
  const currentPayPal: any = { getSubscription: async () => ({ id: "I-sub", status: "CANCELLED", planId: "silver", startTime: new Date("2026-08-01"), nextBillingTime: null }) };
  assert.equal(await processVerifiedPayPalWebhook({ event: subscriptionEvent, database, payPalClient: currentPayPal }), "processed");
  assert.equal(await processVerifiedPayPalWebhook({ event: subscriptionEvent, database, payPalClient: currentPayPal }), "duplicate");
  assert.equal(events.length, 1, "replay retains one provider event");
  assert.equal(subscription.status, "ENDED", "current PayPal state wins over delayed ACTIVATED event");
  assert.equal(subscription.currentTier, "SILVER");
  assert.equal(subscription.tierPeriods.length, 2, "replay does not duplicate tier history");

  const route = source("apps/web/app/api/webhooks/paypal/route.ts");
  const service = source("apps/web/server/services/paypalWebhook.service.ts");
  const schema = source("apps/web/prisma/schema.prisma");
  assert.match(route, /verificationHeaders\(request\)/, "missing signature headers are rejected before processing");
  assert.match(route, /verifyPayPalWebhook/, "signature verification occurs before mutation");
  assert.match(service, /providerEventId/, "provider event IDs are persisted");
  assert.match(schema, /providerEventId\s+String\s+@unique/, "provider event IDs are globally unique");
  assert.match(service, /getSubscription\(providerSubscriptionId\)/, "events synchronize from current PayPal state");
  assert.match(service, /FOR UPDATE/, "subscription updates are serialized");
  assert.match(service, /activePeriod\.tier !== tier/, "replays do not duplicate tier periods");
  assert.match(service, /PAYMENT\.SALE\.REFUNDED/, "refunds are accepted without direct cancellation mapping");
  assert.doesNotMatch(service, /kennel\.balance|ledgerTransaction/, "webhooks do not mutate game economy");
  console.log("PayPal SUPPORT-03 webhook checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
