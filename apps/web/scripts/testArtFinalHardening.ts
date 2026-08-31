import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const finalizer = source("apps/web/server/services/artPaymentFinalization.service.ts");
const checkout = source("apps/web/app/breed-art/checkout/[attemptId]/page.tsx");
const control = source("apps/web/components/art/ArtPaymentFinalizationControl.tsx");
const card = source("apps/web/components/art/ArtCampaignCard.tsx");
const webhook = source("apps/web/server/services/artPaymentWebhook.service.ts");
const reconciliation = source("apps/web/server/services/artPaymentReconciliationRunner.service.ts");
const replay = source("apps/web/server/services/artPaymentProviderEventReplayRunner.service.ts");

assert.match(finalizer, /\["RECONCILING", "VOID_PENDING"\]\.includes\(attempt\.status\)/);
assert.match(finalizer, /await reconcileArtPaymentAttempt\(\{ attemptId: attempt\.id/);
assert.match(finalizer, /attempt\.status === "COMPLETED"/);
assert.match(finalizer, /attempt\.requestedUnits > campaign\.totalFundingUnits - funded - reserved/);
assert.match(finalizer, /before \+ attempt\.requestedUnits > campaign\.totalFundingUnits/);
assert.match(checkout, /Your contribution was canceled\. You were not charged\./);
assert.match(checkout, /We&apos;re confirming your contribution with PayPal/);
assert.match(control, /PayPal could not complete this contribution\. No contribution was completed\./);
assert.doesNotMatch(control, /else setMessage\("Your contribution could not be finalized\. You were not charged/);
assert.match(card, /campaign\.status === "NEEDS_FUNDING" && progress\.canAcceptContributions/);
assert.match(webhook, /providerEventId/);
assert.match(reconciliation, /RECONCILABLE_STATUSES = \["RECONCILING", "VOID_PENDING"\]/);
assert.match(replay, /where: \{ processingStatus: "FAILED" \}/);
assert.doesNotMatch(finalizer, /LedgerTransaction|kennel\.balance|SupportSubscription/);
console.log("ART-13 final hardening source checks passed.");
