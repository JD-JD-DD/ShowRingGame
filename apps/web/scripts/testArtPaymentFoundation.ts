import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { startArtPaymentAttempt } from "../server/services/artPaymentAttempt.service";
import { PayPalClient, PayPalSupportError } from "../server/services/paypalSupport.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const campaign = {
  id: "campaign-1", campaignKey: "STANDARD_BREED_ARTWORK", title: "Standard Breed Artwork — Beagle", breedCode2: "BE",
  status: "NEEDS_FUNDING", fundingGoalCents: 5000, fundingUnitCents: 500, totalFundingUnits: 10,
  artistAllocationCents: 4000, showRingAllocationCents: 1000, breed: { name: "Beagle" }, contributions: [],
};

function createArtOrderClient(orderResponse: unknown, orderStatus = 201) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const client = new PayPalClient({ environment: "sandbox", clientId: "client", clientSecret: "secret" } as any, async (url, init) => {
    const requestUrl = String(url);
    requests.push({ url: requestUrl, init });
    if (requestUrl.endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    return new Response(JSON.stringify(orderResponse), { status: orderStatus });
  });
  return { client, requests };
}

const createArtOrderArgs = {
  attemptId: "attempt-1", campaignId: campaign.id, campaignTitle: campaign.title,
  requestedUnits: 1, fundingUnitCents: 500, expectedAmountCents: 500,
  returnUrl: "https://showring.example/breed-art/checkout/attempt-1",
  cancelUrl: "https://showring.example/breed-art/checkout/attempt-1?cancelled=1",
  requestId: "request-1",
};

async function main() {
  const minimalOrder = { id: "ORDER-MINIMAL", status: "CREATED", links: [{ rel: "approve", method: "GET", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-MINIMAL" }] };
  const minimalClient = createArtOrderClient(minimalOrder);
  const createdMinimalOrder = await minimalClient.client.createArtOrder(createArtOrderArgs);
  assert.equal(createdMinimalOrder.id, "ORDER-MINIMAL");
  assert.equal(createdMinimalOrder.intent, null, "minimal create responses do not need a full order representation");
  assert.equal(createdMinimalOrder.approvalUrl, "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-MINIMAL");
  assert.equal(minimalClient.requests[1]?.url.endsWith("/v2/checkout/orders"), true);
  const createRequest = JSON.parse(String(minimalClient.requests[1]?.init?.body));
  assert.deepEqual(createRequest, {
    intent: "AUTHORIZE",
    purchase_units: [{
      reference_id: "attempt-1", custom_id: "attempt-1", invoice_id: "art-attempt-1",
      amount: { currency_code: "USD", value: "5.00", breakdown: { item_total: { currency_code: "USD", value: "5.00" } } },
      items: [{ name: campaign.title, sku: campaign.id, quantity: "1", unit_amount: { currency_code: "USD", value: "5.00" } }],
    }],
    application_context: { return_url: createArtOrderArgs.returnUrl, cancel_url: createArtOrderArgs.cancelUrl, user_action: "CONTINUE" },
  });
  await assert.rejects(() => createArtOrderClient({ status: "CREATED", links: minimalOrder.links }).client.createArtOrder(createArtOrderArgs), PayPalSupportError);
  await assert.rejects(() => createArtOrderClient({ id: "ORDER-NO-APPROVE", status: "CREATED", links: [] }).client.createArtOrder(createArtOrderArgs), PayPalSupportError);
  await assert.rejects(() => createArtOrderClient({ id: "ORDER-BAD-APPROVE", status: "CREATED", links: [{ rel: "approve", method: "GET", href: "http://paypal.example/approve" }] }).client.createArtOrder(createArtOrderArgs), PayPalSupportError);
  await assert.rejects(() => createArtOrderClient({ name: "INVALID_REQUEST", message: "Bad request", debug_id: "debug-id" }, 422).client.createArtOrder(createArtOrderArgs), (error: unknown) => error instanceof PayPalSupportError && error.status === 422 && error.providerError?.name === "INVALID_REQUEST" && error.providerError.debugId === "debug-id");

  const attempts: any[] = [];
  const database: any = {
    artCampaign: { findFirst: async () => campaign },
    artPaymentAttempt: {
      findUnique: async ({ where }: any) => where.userId_clientRequestId ? attempts.find((attempt) => attempt.userId === where.userId_clientRequestId.userId && attempt.clientRequestId === where.userId_clientRequestId.clientRequestId) ?? null : attempts.find((attempt) => attempt.id === where.id) ?? null,
      create: async ({ data }: any) => { const attempt = { id: "attempt-1", status: "CREATED", providerOrderId: null, providerApprovalUrl: null, ...data }; attempts.push(attempt); return attempt; },
      update: async ({ where, data }: any) => Object.assign(attempts.find((attempt) => attempt.id === where.id), data),
    },
  };
  const providerOrder = (attempt: any) => ({ id: "ORDER-1", status: "CREATED", intent: "AUTHORIZE", approvalUrl: "https://paypal.example/approve", referenceId: attempt.id, customId: attempt.id, amountValue: "10.00", currencyCode: "USD", itemQuantity: "2", itemSku: campaign.id });
  const payPalClient: any = {
    createArtOrder: async (args: any) => {
      assert.equal(args.requestedUnits, 2);
      assert.equal(args.fundingUnitCents, 500);
      assert.equal(args.expectedAmountCents, 1000);
      assert.match(args.returnUrl, /breed-art\/checkout\/attempt-1/);
      return providerOrder({ id: args.attemptId });
    },
    getArtOrder: async () => providerOrder(attempts[0]),
  };
  const input = { userId: "user-1", campaignId: campaign.id, requestedUnits: 2, recognition: "KENNEL_CREDIT", nonRefundableAcknowledged: true, clientRequestId: "client-request-1", appBaseUrl: "https://showring.example", database, payPalClient, resolveKennel: (async () => ({ id: "kennel-1", name: "SilverOak" })) as any };
  const first = await startArtPaymentAttempt(input);
  const retry = await startArtPaymentAttempt(input);
  assert.deepEqual(first, { attemptId: "attempt-1", approvalUrl: "https://paypal.example/approve" });
  assert.deepEqual(retry, first);
  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].expectedAmountCents, 1000);
  assert.equal(attempts[0].currency, "USD");
  assert.equal(attempts[0].nonRefundableAcknowledged, true);
  assert.ok(attempts[0].nonRefundableAcknowledgedAt instanceof Date);
  assert.equal(attempts[0].status, "ORDER_CREATED");
  await assert.rejects(() => startArtPaymentAttempt({ ...input, clientRequestId: "missing-ack", nonRefundableAcknowledged: false }), /acknowledge/);
  await assert.rejects(() => startArtPaymentAttempt({ ...input, clientRequestId: "bad-units", requestedUnits: 11 }), /no longer available/);

  const paymentService = source("apps/web/server/services/artPaymentAttempt.service.ts");
  const payPalService = source("apps/web/server/services/paypalSupport.service.ts");
  const route = source("apps/web/app/api/art-campaigns/[campaignId]/checkout/route.ts");
  const returnPage = source("apps/web/app/breed-art/checkout/[attemptId]/page.tsx");
  const card = source("apps/web/components/art/ArtCampaignCard.tsx");
  const form = source("apps/web/components/art/ArtCampaignContributionForm.tsx");
  const schema = source("apps/web/prisma/schema.prisma");
  assert.match(payPalService, /intent: "AUTHORIZE"/);
  assert.match(payPalService, /candidate\.rel !== "approve" \|\| candidate\.method !== "GET"/);
  assert.match(payPalService, /approvalUrl\.protocol === "https:"/);
  assert.match(payPalService, /response\.ok/);
  assert.match(paymentService, /validateArtContributionUnits/);
  assert.doesNotMatch(paymentService, /artContribution\.(create|update)|fundedUnits.*\+=|reservationAcquiredAt: new Date/);
  assert.doesNotMatch(paymentService, /\/capture|providerCaptureId:|status: "COMPLETED"/);
  assert.match(route, /getSessionUserId/);
  assert.doesNotMatch(route, /amount|currency|providerOrderId/);
  assert.match(paymentService, /getArtOrder\(attempt\.providerOrderId\)/);
  assert.match(paymentService, /attempt\.userId !== args\.userId/);
  assert.match(returnPage, /Funding availability is confirmed when your contribution is finalized\./);
  assert.match(schema, /model ArtPaymentAttempt/);
  assert.match(schema, /model ArtPaymentProviderEvent/);
  assert.doesNotMatch(schema, /ArtPaymentAttempt[\s\S]*SupportProviderEvent/);
  assert.match(card, /campaign\.status === "NEEDS_FUNDING" && progress\.canAcceptContributions/);
  assert.match(form, /Fund Remaining/);
  assert.match(form, /Funding units[\s\S]*theme-control/);
  assert.match(form, /I understand that my contribution is non-refundable\./);
  assert.match(form, /Funding availability is confirmed when your contribution is finalized\./);
  console.log("ART-07 Breed Art payment foundation checks passed.");
}

void main();
