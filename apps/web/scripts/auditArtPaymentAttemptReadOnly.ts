// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { createPayPalArtOrdersClient, getPayPalEnvironment, PayPalSupportError } from "../server/services/paypalSupport.service";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const attemptId = process.argv[2]?.trim();

async function main() {
  if (!attemptId) throw new Error("Usage: audit:art-payment-attempt-read-only <ArtPaymentAttempt ID>");

  const attempt = await prisma.artPaymentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true, artCampaignId: true, requestedUnits: true, expectedAmountCents: true, currency: true, status: true,
      providerOrderId: true, providerAuthorizationId: true, providerCaptureId: true, reservedUnits: true,
      paypalCreateOrderRequestId: true, paypalAuthorizeRequestId: true, paypalCaptureRequestId: true,
      reservationAcquiredAt: true, reservationReleasedAt: true, approvedAt: true, authorizedAt: true, terminalAt: true,
      contribution: { select: { id: true, fundedUnits: true, amountCents: true, fundedAt: true } },
      campaign: { select: { title: true, status: true, totalFundingUnits: true, breed: { select: { name: true } }, contributions: { select: { fundedUnits: true } } } },
    },
  });
  if (!attempt) throw new Error("ArtPaymentAttempt was not found.");

  let provider: Record<string, unknown>;
  try {
    if (getPayPalEnvironment() !== "live") {
      provider = { reads: "SKIPPED", reason: "Configured PayPal environment is not live in this local shell." };
    } else {
      const client = createPayPalArtOrdersClient();
      const [order, authorization, capture] = await Promise.all([
        attempt.providerOrderId ? client.getArtOrder(attempt.providerOrderId) : null,
        attempt.providerAuthorizationId ? client.getArtAuthorization(attempt.providerAuthorizationId) : null,
        attempt.providerCaptureId ? client.getArtCapture(attempt.providerCaptureId) : null,
      ]);
      provider = {
        reads: "COMPLETED",
        order: order && {
          id: order.id, status: order.status, intent: order.intent, amountValue: order.amountValue, currencyCode: order.currencyCode,
          referenceId: order.referenceId, customId: order.customId,
          captures: order.captures.map((item) => ({ id: item.id, status: item.status, amountValue: item.amountValue, currencyCode: item.currencyCode })),
        },
        authorization: authorization && { id: authorization.id, status: authorization.status, amountValue: authorization.amountValue, currencyCode: authorization.currencyCode },
        capture: capture && { id: capture.id, status: capture.status, amountValue: capture.amountValue, currencyCode: capture.currencyCode },
        captureLookupUnavailableWithoutPersistedCaptureId: !attempt.providerCaptureId && !order?.captures.length,
      };
    }
  } catch (error) {
    if (error instanceof PayPalSupportError && error.status === 503) {
      provider = { reads: "SKIPPED", reason: "PayPal environment is not configured in this local shell." };
    } else {
      provider = {
        reads: "ERROR",
        status: error instanceof PayPalSupportError ? error.status : null,
        message: error instanceof Error ? error.message : "Unable to read provider state.",
        providerError: error instanceof PayPalSupportError ? error.providerError : null,
      };
    }
  }

  console.log(JSON.stringify({
    attempt: {
      id: attempt.id,
      campaignId: attempt.artCampaignId,
      campaignTitle: attempt.campaign.title,
      breedName: attempt.campaign.breed.name,
      status: attempt.status,
      requestedUnits: attempt.requestedUnits,
      expectedAmountCents: attempt.expectedAmountCents,
      currency: attempt.currency,
      providerOrderId: attempt.providerOrderId,
      providerAuthorizationId: attempt.providerAuthorizationId,
      providerCaptureId: attempt.providerCaptureId,
      createOrderRequestIdPresent: Boolean(attempt.paypalCreateOrderRequestId),
      authorizeRequestIdPresent: Boolean(attempt.paypalAuthorizeRequestId),
      captureRequestIdPresent: Boolean(attempt.paypalCaptureRequestId),
      reservedUnits: attempt.reservedUnits,
      reservationAcquiredAt: attempt.reservationAcquiredAt,
      reservationReleasedAt: attempt.reservationReleasedAt,
      approvedAt: attempt.approvedAt,
      authorizedAt: attempt.authorizedAt,
      terminalAt: attempt.terminalAt,
      completedContributionExists: Boolean(attempt.contribution),
      completedContribution: attempt.contribution,
      campaignCompletedFundedUnits: attempt.campaign.contributions.reduce((total, contribution) => total + contribution.fundedUnits, 0),
      campaignTotalFundingUnits: attempt.campaign.totalFundingUnits,
      campaignStatus: attempt.campaign.status,
    },
    provider,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Breed Art payment read-only audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
