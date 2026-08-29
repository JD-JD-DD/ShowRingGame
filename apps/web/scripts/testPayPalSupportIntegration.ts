import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getPayPalPlanId,
  isSupportTier,
  PayPalSandboxClient,
  PAYPAL_SANDBOX_API_BASE,
  type PayPalSupportConfig,
} from "../server/services/paypalSupport.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const config: PayPalSupportConfig = {
  clientId: "client",
  clientSecret: "secret",
  productId: "product",
  planIds: { BRONZE: "plan-2", SILVER: "plan-5", GOLD: "plan-10" },
};

async function main() {
assert.equal(PAYPAL_SANDBOX_API_BASE, "https://api-m.sandbox.paypal.com");
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
const client = new PayPalSandboxClient(config, fetchStub);
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

const route = source("apps/web/app/api/support/subscriptions/route.ts");
const supportService = source("apps/web/server/services/supportSubscription.service.ts");
const paypalService = source("apps/web/server/services/paypalSupport.service.ts");
const schema = source("apps/web/prisma/schema.prisma");

assert.match(route, /getSessionUserId/, "support route authenticates server-side");
assert.match(route, /isSupportTier\(tier\)/, "route accepts only canonical tiers");
assert.doesNotMatch(route, /planId|price|currency|providerSubscriptionId/, "route does not accept provider billing fields");
assert.match(supportService, /getSubscription\(created\.providerSubscriptionId\)/, "linking re-fetches the PayPal subscription");
assert.match(supportService, /subscription\.planId !== getPayPalPlanId/, "linking verifies the configured plan");
assert.match(supportService, /FOR UPDATE/, "current-support checks are serialized per account");
assert.match(supportService, /CURRENT_SUPPORT_STATUSES/, "current subscriptions are blocked before linking another");
assert.match(schema, /providerSubscriptionId\s+String\s+@unique/, "provider subscription IDs remain globally unique");
assert.match(paypalService, /api-m\.sandbox\.paypal\.com/, "PayPal integration is sandbox-only");
assert.doesNotMatch(paypalService, /NEXT_PUBLIC_PAYPAL/, "PayPal credentials remain server-only");
assert.doesNotMatch(paypalService, /console\./, "PayPal credentials and authorization headers are never logged");

console.log("PayPal SUPPORT-02 source checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
