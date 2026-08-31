import { randomUUID } from "node:crypto";

import { CURRENT_BREED_RELEASE } from "@showring/rules";

import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import { calculateArtCampaignProgress, validateArtContributionUnits } from "@/server/services/artCampaign.service";
import { createPayPalArtOrdersClient, PayPalSupportError, type PayPalArtOrder, type PayPalClient } from "@/server/services/paypalSupport.service";

const ART_PAYMENT_CURRENCY = "USD";
const RECOGNITIONS = ["KENNEL_CREDIT", "ANONYMOUS"] as const;
type Recognition = (typeof RECOGNITIONS)[number];

type PaymentAttemptRecord = any;
type ArtPaymentAttemptDatabase = any;

export class ArtPaymentAttemptError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function isRecognition(value: unknown): value is Recognition {
  return typeof value === "string" && (RECOGNITIONS as readonly string[]).includes(value);
}

function formatUsdCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

function assertAttemptInput(input: {
  requestedUnits: unknown;
  recognition: unknown;
  nonRefundableAcknowledged: unknown;
  clientRequestId: unknown;
}) {
  if (!isRecognition(input.recognition)) throw new ArtPaymentAttemptError("Choose how your contribution should be recognized.");
  if (input.nonRefundableAcknowledged !== true) throw new ArtPaymentAttemptError("You must acknowledge the non-refundable contribution policy.");
  if (typeof input.clientRequestId !== "string" || !input.clientRequestId.trim() || input.clientRequestId.length > 128) {
    throw new ArtPaymentAttemptError("A valid checkout request identity is required.");
  }
  return {
    requestedUnits: input.requestedUnits,
    recognition: input.recognition,
    clientRequestId: input.clientRequestId.trim(),
  };
}

async function loadEligibleCampaign(database: ArtPaymentAttemptDatabase, campaignId: string) {
  const campaign = await database.artCampaign.findFirst({
    where: {
      id: campaignId,
      campaignKey: "STANDARD_BREED_ARTWORK",
      breed: { isActive: true, releaseVersion: { lte: CURRENT_BREED_RELEASE } },
    },
    include: {
      breed: { select: { name: true } },
      contributions: { select: { fundedUnits: true, requestedAt: true, fundedAt: true } },
    },
  });
  if (!campaign) throw new ArtPaymentAttemptError("This Breed Art campaign is not available for contribution.", 404);
  return campaign;
}

function verifyProviderOrder(args: { order: PayPalArtOrder; attempt: PaymentAttemptRecord }) {
  const expectedAmount = formatUsdCents(args.attempt.expectedAmountCents);
  if (
    args.order.id !== args.attempt.providerOrderId ||
    args.order.intent !== "AUTHORIZE" ||
    args.order.referenceId !== args.attempt.id ||
    args.order.customId !== args.attempt.id ||
    args.order.currencyCode !== ART_PAYMENT_CURRENCY ||
    args.order.amountValue !== expectedAmount ||
    args.order.itemQuantity !== String(args.attempt.requestedUnits) ||
    args.order.itemSku !== args.attempt.artCampaignId
  ) {
    throw new ArtPaymentAttemptError("PayPal order details could not be verified.", 422);
  }
}

async function createOrReconcilePayPalOrder(args: {
  database: ArtPaymentAttemptDatabase;
  attempt: PaymentAttemptRecord;
  campaign: any;
  returnUrl: string;
  cancelUrl: string;
  payPalClient: PayPalClient;
}) {
  if (args.attempt.providerOrderId) {
    const order = await args.payPalClient.getArtOrder(args.attempt.providerOrderId);
    verifyProviderOrder({ order, attempt: args.attempt });
    return { attempt: args.attempt, approvalUrl: args.attempt.providerApprovalUrl ?? order.approvalUrl };
  }

  const order = await args.payPalClient.createArtOrder({
    attemptId: args.attempt.id,
    campaignId: args.campaign.id,
    campaignTitle: args.campaign.title,
    requestedUnits: args.attempt.requestedUnits,
    fundingUnitCents: args.campaign.fundingUnitCents,
    expectedAmountCents: args.attempt.expectedAmountCents,
    returnUrl: args.returnUrl,
    cancelUrl: args.cancelUrl,
    requestId: args.attempt.paypalCreateOrderRequestId,
  });
  if (order.intent !== "AUTHORIZE" || !order.approvalUrl) throw new ArtPaymentAttemptError("PayPal could not prepare this contribution checkout.", 502);

  const updated = await args.database.artPaymentAttempt.update({
    where: { id: args.attempt.id },
    data: { providerOrderId: order.id, providerApprovalUrl: order.approvalUrl, providerOrderStatus: order.status, status: "ORDER_CREATED" },
  });
  verifyProviderOrder({ order, attempt: updated });
  return { attempt: updated, approvalUrl: order.approvalUrl };
}

export async function startArtPaymentAttempt(args: {
  userId: string;
  campaignId: string;
  requestedUnits: unknown;
  recognition: unknown;
  nonRefundableAcknowledged: unknown;
  clientRequestId: unknown;
  appBaseUrl: string;
  database?: ArtPaymentAttemptDatabase;
  payPalClient?: PayPalClient;
  resolveKennel?: typeof getKennelForUser;
}) {
  const input = assertAttemptInput(args);
  const database = args.database ?? db;
  const kennel = await (args.resolveKennel ?? getKennelForUser)(args.userId);
  if (!kennel) throw new ArtPaymentAttemptError("Create your kennel before starting a contribution.", 409);
  const campaign = await loadEligibleCampaign(database, args.campaignId);
  const progress = calculateArtCampaignProgress({ status: campaign.status, config: campaign, contributions: campaign.contributions });
  const unitValidation = validateArtContributionUnits(progress, input.requestedUnits);
  if (!unitValidation.ok) throw new ArtPaymentAttemptError("The selected contribution units are no longer available.", 409);

  let attempt = await database.artPaymentAttempt.findUnique({ where: { userId_clientRequestId: { userId: args.userId, clientRequestId: input.clientRequestId } } });
  if (attempt) {
    if (attempt.artCampaignId !== campaign.id || attempt.requestedUnits !== unitValidation.requestedUnits || attempt.recognition !== input.recognition) {
      throw new ArtPaymentAttemptError("This checkout request was already used for a different contribution.", 409);
    }
  } else {
    const data = {
      artCampaignId: campaign.id,
      userId: args.userId,
      kennelId: kennel.id,
      requestedUnits: unitValidation.requestedUnits,
      expectedAmountCents: unitValidation.amountCents,
      currency: ART_PAYMENT_CURRENCY,
      recognition: input.recognition,
      nonRefundableAcknowledged: true,
      nonRefundableAcknowledgedAt: new Date(),
      clientRequestId: input.clientRequestId,
      paypalCreateOrderRequestId: randomUUID(),
    };
    try {
      attempt = await database.artPaymentAttempt.create({ data });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      attempt = await database.artPaymentAttempt.findUnique({ where: { userId_clientRequestId: { userId: args.userId, clientRequestId: input.clientRequestId } } });
      if (!attempt) throw error;
      if (attempt.artCampaignId !== campaign.id || attempt.requestedUnits !== unitValidation.requestedUnits || attempt.recognition !== input.recognition) {
        throw new ArtPaymentAttemptError("This checkout request was already used for a different contribution.", 409);
      }
    }
  }

  const result = await createOrReconcilePayPalOrder({
    database,
    attempt,
    campaign,
    returnUrl: new URL(`/breed-art/checkout/${attempt.id}`, args.appBaseUrl).toString(),
    cancelUrl: new URL(`/breed-art/checkout/${attempt.id}?cancelled=1`, args.appBaseUrl).toString(),
    payPalClient: args.payPalClient ?? createPayPalArtOrdersClient(),
  });
  if (!result.approvalUrl) throw new ArtPaymentAttemptError("PayPal approval is unavailable for this attempt.", 502);
  return { attemptId: result.attempt.id, approvalUrl: result.approvalUrl };
}

export async function getArtPaymentAttemptForReturn(args: {
  userId: string;
  attemptId: string;
  cancelled?: boolean;
  database?: ArtPaymentAttemptDatabase;
  payPalClient?: PayPalClient;
}) {
  const database = args.database ?? db;
  const attempt = await database.artPaymentAttempt.findUnique({ where: { id: args.attemptId } });
  if (!attempt || attempt.userId !== args.userId) throw new ArtPaymentAttemptError("Contribution checkout was not found.", 404);
  if (!attempt.providerOrderId && args.cancelled && attempt.status === "CREATED") {
    return database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "CANCELLED", terminalAt: new Date() } });
  }
  if (!attempt.providerOrderId) return attempt;

  const order = await (args.payPalClient ?? createPayPalArtOrdersClient()).getArtOrder(attempt.providerOrderId);
  verifyProviderOrder({ order, attempt });
  if (args.cancelled && order.status !== "APPROVED" && ["CREATED", "ORDER_CREATED"].includes(attempt.status)) {
    return database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "CANCELLED", providerOrderStatus: order.status, terminalAt: new Date() } });
  }
  if (order.status === "APPROVED" && attempt.status === "ORDER_CREATED") {
    return database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "APPROVED", providerOrderStatus: order.status, approvedAt: new Date() } });
  }
  return database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { providerOrderStatus: order.status } });
}

export { ART_PAYMENT_CURRENCY, PayPalSupportError };
