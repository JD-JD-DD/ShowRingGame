import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getPayPalPlanId,
  getPayPalApiBase,
  getPayPalEnvironment,
  getPayPalSupportConfig,
  getPayPalWebhookId,
  isSupportTier,
  PayPalClient,
  PayPalSupportError,
  PAYPAL_LIVE_API_BASE,
  PAYPAL_SANDBOX_API_BASE,
  type PayPalSupportConfig,
} from "../server/services/paypalSupport.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const config: PayPalSupportConfig = {
  environment: "sandbox",
  clientId: "client",
  clientSecret: "secret",
  productId: "product",
  planIds: { BRONZE: "plan-2", SILVER: "plan-5", GOLD: "plan-10" },
  webhookId: "sandbox-webhook",
};

const sandboxValues = {
  PAYPAL_SANDBOX_CLIENT_ID: "sandbox-client",
  PAYPAL_SANDBOX_CLIENT_SECRET: "sandbox-secret",
  PAYPAL_SANDBOX_PRODUCT_ID: "sandbox-product",
  PAYPAL_SANDBOX_BRONZE_PLAN_ID: "sandbox-bronze",
  PAYPAL_SANDBOX_SILVER_PLAN_ID: "sandbox-silver",
  PAYPAL_SANDBOX_GOLD_PLAN_ID: "sandbox-gold",
  PAYPAL_SANDBOX_WEBHOOK_ID: "sandbox-webhook",
};
const liveValues = {
  PAYPAL_LIVE_CLIENT_ID: "live-client",
  PAYPAL_LIVE_CLIENT_SECRET: "live-secret",
  PAYPAL_LIVE_PRODUCT_ID: "live-product",
  PAYPAL_LIVE_BRONZE_PLAN_ID: "live-bronze",
  PAYPAL_LIVE_SILVER_PLAN_ID: "live-silver",
  PAYPAL_LIVE_GOLD_PLAN_ID: "live-gold",
  PAYPAL_LIVE_WEBHOOK_ID: "live-webhook",
};

async function main() {
assert.equal(PAYPAL_SANDBOX_API_BASE, "https://api-m.sandbox.paypal.com");
assert.equal(PAYPAL_LIVE_API_BASE, "https://api-m.paypal.com");
assert.equal(getPayPalApiBase("sandbox"), PAYPAL_SANDBOX_API_BASE);
assert.equal(getPayPalApiBase("live"), PAYPAL_LIVE_API_BASE);
assert.equal(getPayPalEnvironment("sandbox"), "sandbox");
assert.equal(getPayPalEnvironment("live"), "live");
assert.throws(() => getPayPalEnvironment("staging"), PayPalSupportError);
const sandboxConfig = getPayPalSupportConfig("sandbox", sandboxValues);
const liveConfig = getPayPalSupportConfig("live", liveValues);
assert.equal(sandboxConfig.clientId, "sandbox-client");
assert.equal(sandboxConfig.planIds.BRONZE, "sandbox-bronze");
assert.equal(getPayPalWebhookId(sandboxConfig), "sandbox-webhook");
assert.equal(liveConfig.clientId, "live-client");
assert.equal(liveConfig.planIds.BRONZE, "live-bronze");
assert.equal(getPayPalWebhookId(liveConfig), "live-webhook");
assert.throws(() => getPayPalSupportConfig("sandbox", {}), PayPalSupportError);
assert.throws(() => getPayPalSupportConfig("live", {}), PayPalSupportError);
assert.equal(getPayPalPlanId("BRONZE", config), "plan-2");
assert.equal(getPayPalPlanId("SILVER", config), "plan-5");
assert.equal(getPayPalPlanId("GOLD", config), "plan-10");
assert.equal(isSupportTier("BRONZE"), true);
assert.equal(isSupportTier("PLATINUM"), false);

const requests: Array<{ url: string; init?: RequestInit }> = [];
const responses = [
  { access_token: "sandbox-access-token" },
  {
    id: "I-sandbox-subscription",
    status: "APPROVAL_PENDING",
    links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=example" }],
  },
  {
    id: "I-sandbox-subscription",
    status: "APPROVAL_PENDING",
    plan_id: "plan-5",
  },
];
const fetchStub: typeof fetch = async (input, init) => {
  requests.push({ url: String(input), init });
  return new Response(JSON.stringify(responses.shift()), { status: 200 });
};
const client = new PayPalClient(config, fetchStub);
const created = await client.createSubscription({ tier: "SILVER" });
const retrieved = await client.getSubscription(created.providerSubscriptionId);

assert.equal(created.providerSubscriptionId, "I-sandbox-subscription");
assert.equal(created.approvalUrl, "https://www.sandbox.paypal.com/checkoutnow?token=example");
assert.equal(retrieved.planId, "plan-5");
assert.equal(requests.length, 3, "one OAuth token serves creation and retrieval");
assert.equal(requests[0]?.url, "https://api-m.sandbox.paypal.com/v1/oauth2/token");
assert.equal(requests[1]?.url, "https://api-m.sandbox.paypal.com/v1/billing/subscriptions");
assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
  plan_id: "plan-5",
  application_context: { user_action: "SUBSCRIBE_NOW" },
});
assert.equal(
  requests[2]?.url,
  "https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-sandbox-subscription"
);

const liveRequests: string[] = [];
const liveResponses = [{ access_token: "live-access-token" }, { verification_status: "SUCCESS" }];
const liveClient = new PayPalClient(liveConfig, async (input) => {
  liveRequests.push(String(input));
  return new Response(JSON.stringify(liveResponses.shift()), { status: 200 });
});
assert.equal(await liveClient.verifyWebhookSignature({
  headers: { authAlgo: "SHA256withRSA", certUrl: "https://api-m.paypal.com/certs/test", transmissionId: "id", transmissionSig: "sig", transmissionTime: "2026-08-28T00:00:00Z" },
  event: { id: "WH-live" },
  webhookId: getPayPalWebhookId(liveConfig),
}), true);
assert.equal(liveRequests[0], "https://api-m.paypal.com/v1/oauth2/token");
assert.equal(liveRequests[1], "https://api-m.paypal.com/v1/notifications/verify-webhook-signature");

const cancellationFailureClient = new PayPalClient(config, async (input) => {
  if (String(input).endsWith("/v1/oauth2/token")) {
    return new Response(JSON.stringify({ access_token: "sandbox-access-token" }), { status: 200 });
  }
  return new Response(JSON.stringify({
    name: "UNPROCESSABLE_ENTITY",
    message: "The requested action could not be performed.",
    debug_id: "sandbox-debug-id",
    details: [{ issue: "CANNOT_CANCEL", description: "The subscription cannot be cancelled." }],
    payer: { email_address: "buyer@example.test" },
  }), { status: 422 });
});

await assert.rejects(
  () => cancellationFailureClient.cancelSubscription("I-sandbox-subscription"),
  (error: unknown) => {
    assert.ok(error instanceof PayPalSupportError);
    assert.equal(error.status, 422);
    assert.deepEqual(error.providerError, {
      name: "UNPROCESSABLE_ENTITY",
      message: "The requested action could not be performed.",
      debugId: "sandbox-debug-id",
      details: [{ issue: "CANNOT_CANCEL", description: "The subscription cannot be cancelled." }],
    });
    assert.doesNotMatch(JSON.stringify(error.providerError), /buyer@example\.test|payer|secret|client|Authorization/);
    return true;
  }
);

const route = source("apps/web/app/api/support/subscriptions/route.ts");
const supportService = source("apps/web/server/services/supportSubscription.service.ts");
const paypalService = source("apps/web/server/services/paypalSupport.service.ts");
const clearPendingRoute = source("apps/web/app/api/test/support-sandbox/clear-pending/route.ts");
const provisioner = source("apps/web/scripts/provisionPayPalSupport.cts");
const schema = source("apps/web/prisma/schema.prisma");

assert.match(route, /getSessionUserId/, "support route authenticates server-side");
assert.match(route, /isSupportTier\(tier\)/, "route accepts only canonical tiers");
assert.doesNotMatch(route, /planId|price|currency|providerSubscriptionId|environment/, "route does not accept provider billing fields or an environment override");
assert.match(supportService, /getSubscription\(created\.providerSubscriptionId\)/, "linking re-fetches the PayPal subscription");
assert.match(supportService, /subscription\.planId !== getPayPalPlanId/, "linking verifies the configured plan");
assert.match(supportService, /FOR UPDATE/, "current-support checks are serialized per account");
assert.match(supportService, /CURRENT_SUPPORT_STATUSES/, "current subscriptions are blocked before linking another");
assert.match(schema, /providerSubscriptionId\s+String\s+@unique/, "provider subscription IDs remain globally unique");
assert.match(paypalService, /api-m\.sandbox\.paypal\.com/, "PayPal integration retains the fixed sandbox host");
assert.match(paypalService, /api-m\.paypal\.com/, "PayPal integration supports the fixed live host");
assert.match(paypalService, /PAYPAL_ENVIRONMENT/, "PayPal environment selection is explicit");
assert.doesNotMatch(paypalService, /PAYPAL_[A-Z_]*API_HOST/, "PayPal API host cannot be supplied by configuration");
assert.match(provisioner, /--environment=sandbox\|live/, "provisioning requires an explicit environment");
assert.match(provisioner, /getPayPalProvisioningConfig\(environment\)/, "provisioning uses only the requested environment credentials");
assert.doesNotMatch(paypalService, /NEXT_PUBLIC_PAYPAL/, "PayPal credentials remain server-only");
assert.doesNotMatch(paypalService, /console\./, "PayPal credentials and authorization headers are never logged");
assert.match(clearPendingRoute, /getSessionUserId/, "test reset requires an authenticated session");
assert.match(clearPendingRoute, /status: "PENDING"/, "test reset considers only pending ShowRing subscriptions");
assert.match(clearPendingRoute, /subscription\.provider !== "PAYPAL"/, "test reset requires the stored PayPal provider");
assert.match(clearPendingRoute, /getSubscription\(subscription\.providerSubscriptionId\)/, "test reset verifies the stored provider subscription");
assert.match(clearPendingRoute, /current\.status !== "APPROVAL_PENDING"/, "test reset rejects active, approved, and unknown provider states");
assert.match(clearPendingRoute, /current\.planId !== getPayPalPlanId/, "test reset rejects a mismatched provider plan");
assert.match(clearPendingRoute, /status: "ENDED", endedAt: new Date\(\)/, "only a verified pending record transitions to ended");
assert.doesNotMatch(clearPendingRoute, /supportSubscription\.delete/, "test reset preserves the support subscription history record");
assert.doesNotMatch(clearPendingRoute, /cancelSubscription|\/cancel/, "test reset never asks PayPal to cancel the unapproved subscription");

console.log("PayPal SUPPORT-02 source checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
