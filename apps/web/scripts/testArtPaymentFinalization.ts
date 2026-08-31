import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

const finalizer = source("apps/web/server/services/artPaymentFinalization.service.ts");
const webhook = source("apps/web/server/services/artPaymentWebhook.service.ts");
const webhookRoute = source("apps/web/app/api/webhooks/paypal/route.ts");
const client = source("apps/web/server/services/paypalSupport.service.ts");
const schema = source("apps/web/prisma/schema.prisma");
const checkout = source("apps/web/app/breed-art/checkout/[attemptId]/page.tsx");

assert.match(finalizer, /SELECT "id" FROM "ArtCampaign" WHERE "id" = \$\{initial\.artCampaignId\} FOR UPDATE/);
assert.match(finalizer, /funded \+ reserved > campaign\.totalFundingUnits/);
assert.match(finalizer, /attempt\.requestedUnits > campaign\.totalFundingUnits - funded - reserved/);
assert.match(finalizer, /status: "RESERVED"/);
assert.match(finalizer, /captureArtAuthorization/);
assert.match(finalizer, /status: "CAPTURE_PENDING"/);
assert.match(finalizer, /status: "RECONCILING"/);
assert.match(finalizer, /artPaymentAttemptId: attempt\.id/);
assert.match(finalizer, /fundedUnits: attempt\.requestedUnits/);
assert.match(finalizer, /status: "FUNDED"/);
assert.doesNotMatch(finalizer, /LedgerTransaction|kennel\.balance/);
assert.match(client, /authorizeArtOrder/);
assert.match(client, /captureArtAuthorization/);
assert.match(client, /voidArtAuthorization/);
assert.match(webhook, /artPaymentProviderEvent/);
assert.doesNotMatch(webhook, /supportProviderEvent/);
assert.match(webhookRoute, /processVerifiedArtPaymentWebhook/);
assert.match(webhookRoute, /processVerifiedPayPalWebhook/);
assert.match(schema, /artPaymentAttemptId\s+String\?\s+@unique/);
assert.match(checkout, /ArtPaymentFinalizationControl/);
console.log("ART-08 Breed Art payment finalization source checks passed.");
