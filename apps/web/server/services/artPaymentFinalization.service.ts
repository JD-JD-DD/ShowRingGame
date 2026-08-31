import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import { ART_PAYMENT_CURRENCY, ArtPaymentAttemptError, verifyProviderOrder } from "@/server/services/artPaymentAttempt.service";
import { createPayPalArtOrdersClient, PayPalSupportError, type PayPalArtAuthorization, type PayPalArtCapture, type PayPalClient } from "@/server/services/paypalSupport.service";

type Database = any;

function amountMatches(payment: PayPalArtAuthorization | PayPalArtCapture, attempt: any) {
  return payment.amountValue === (attempt.expectedAmountCents / 100).toFixed(2) && payment.currencyCode === ART_PAYMENT_CURRENCY;
}

function isDefinitiveProviderFailure(error: unknown) {
  return error instanceof PayPalSupportError && [400, 401, 403, 404, 409, 422].includes(error.status);
}

async function reserveAttempt(database: Database, attemptId: string) {
  return database.$transaction(async (tx: any) => {
    const initial = await tx.artPaymentAttempt.findUnique({ where: { id: attemptId } });
    if (!initial) throw new ArtPaymentAttemptError("Contribution checkout was not found.", 404);
    await tx.$queryRaw`SELECT "id" FROM "ArtCampaign" WHERE "id" = ${initial.artCampaignId} FOR UPDATE`;
    const attempt = await tx.artPaymentAttempt.findUnique({ where: { id: attemptId } });
    if (["RESERVED", "CAPTURE_PENDING", "RECONCILING", "COMPLETED"].includes(attempt.status)) return attempt;
    const campaign = await tx.artCampaign.findUnique({ where: { id: attempt.artCampaignId }, include: { contributions: { select: { fundedUnits: true } }, paymentAttempts: { where: { status: { in: ["RESERVED", "CAPTURE_PENDING", "RECONCILING"] } }, select: { id: true, reservedUnits: true } } } });
    const funded = campaign.contributions.reduce((sum: number, item: any) => sum + item.fundedUnits, 0);
    const reserved = campaign.paymentAttempts.reduce((sum: number, item: any) => sum + (item.reservedUnits ?? 0), 0);
    if (funded > campaign.totalFundingUnits || funded + reserved > campaign.totalFundingUnits) {
      return tx.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "RECONCILING" } });
    }
    if (attempt.status !== "AUTHORIZED" || attempt.requestedUnits > campaign.totalFundingUnits - funded - reserved) {
      return tx.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "UNAVAILABLE_AFTER_AUTH", terminalAt: new Date() } });
    }
    return tx.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "RESERVED", reservedUnits: attempt.requestedUnits, reservationAcquiredAt: new Date() } });
  });
}

async function releaseReservation(database: Database, attemptId: string, status: "FAILED" | "VOIDED") {
  return database.$transaction(async (tx: any) => {
    const attempt = await tx.artPaymentAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return null;
    await tx.$queryRaw`SELECT "id" FROM "ArtCampaign" WHERE "id" = ${attempt.artCampaignId} FOR UPDATE`;
    return tx.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status, reservedUnits: null, reservationReleasedAt: new Date(), terminalAt: new Date() } });
  });
}

async function finalizeCapturedAttempt(database: Database, attemptId: string, capture: PayPalArtCapture) {
  return database.$transaction(async (tx: any) => {
    const attempt = await tx.artPaymentAttempt.findUnique({ where: { id: attemptId }, include: { contribution: true } });
    if (!attempt) throw new ArtPaymentAttemptError("Contribution checkout was not found.", 404);
    await tx.$queryRaw`SELECT "id" FROM "ArtCampaign" WHERE "id" = ${attempt.artCampaignId} FOR UPDATE`;
    if (attempt.contribution) return { attempt, contribution: attempt.contribution };
    if (attempt.reservedUnits !== attempt.requestedUnits || !amountMatches(capture, attempt) || capture.status !== "COMPLETED") throw new ArtPaymentAttemptError("Payment finalization could not be verified.", 422);
    const campaign = await tx.artCampaign.findUnique({ where: { id: attempt.artCampaignId }, include: { contributions: { select: { fundedUnits: true } } } });
    const before = campaign.contributions.reduce((sum: number, item: any) => sum + item.fundedUnits, 0);
    if (before + attempt.requestedUnits > campaign.totalFundingUnits) throw new ArtPaymentAttemptError("Campaign funding state is inconsistent.", 409);
    const contribution = await tx.artContribution.create({ data: { artCampaignId: attempt.artCampaignId, artPaymentAttemptId: attempt.id, userId: attempt.userId, kennelId: attempt.kennelId, requestedUnits: attempt.requestedUnits, fundedUnits: attempt.requestedUnits, amountCents: attempt.expectedAmountCents, recognition: attempt.recognition, provider: "PAYPAL", providerPaymentId: capture.id, fundedAt: new Date() } });
    const total = before + attempt.requestedUnits;
    await tx.artPaymentAttempt.update({ where: { id: attempt.id }, data: { status: "COMPLETED", providerCaptureId: capture.id, reservedUnits: null, reservationReleasedAt: new Date(), terminalAt: new Date() } });
    if (total === campaign.totalFundingUnits && campaign.status === "NEEDS_FUNDING") await tx.artCampaign.update({ where: { id: campaign.id }, data: { status: "FUNDED", fundedAt: new Date() } });
    return { attempt: { ...attempt, status: "COMPLETED" }, contribution };
  });
}

export async function finalizeArtPaymentAttempt(args: { userId: string; attemptId: string; database?: Database; payPalClient?: PayPalClient; resolveKennel?: typeof getKennelForUser }) {
  const database = args.database ?? db;
  if (!(await (args.resolveKennel ?? getKennelForUser)(args.userId))) throw new ArtPaymentAttemptError("Create your kennel before finalizing a contribution.", 409);
  let attempt = await database.artPaymentAttempt.findUnique({ where: { id: args.attemptId } });
  if (!attempt || attempt.userId !== args.userId) throw new ArtPaymentAttemptError("Contribution checkout was not found.", 404);
  if (attempt.status === "COMPLETED") return { state: "COMPLETED" as const };
  const client = args.payPalClient ?? createPayPalArtOrdersClient();
  const order = await client.getArtOrder(attempt.providerOrderId);
  verifyProviderOrder({ order, attempt });
  if (order.status !== "APPROVED" && !attempt.providerAuthorizationId) throw new ArtPaymentAttemptError("PayPal approval is still required.", 409);
  if (!attempt.providerAuthorizationId) {
    const authorizeRequestId = attempt.paypalAuthorizeRequestId ?? randomUUID();
    if (!attempt.paypalAuthorizeRequestId) attempt = await database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { paypalAuthorizeRequestId: authorizeRequestId } });
    const authorization = await client.authorizeArtOrder(attempt.providerOrderId, authorizeRequestId);
    if (!amountMatches(authorization, attempt) || authorization.status !== "CREATED") throw new ArtPaymentAttemptError("PayPal authorization could not be verified.", 422);
    attempt = await database.artPaymentAttempt.update({ where: { id: attempt.id }, data: { providerAuthorizationId: authorization.id, status: "AUTHORIZED", authorizedAt: new Date() } });
  }
  const reserved = await reserveAttempt(database, attempt.id);
  if (reserved.status === "UNAVAILABLE_AFTER_AUTH") {
    const voidRequestId = reserved.paypalVoidRequestId ?? randomUUID();
    await database.artPaymentAttempt.update({ where: { id: reserved.id }, data: { paypalVoidRequestId: voidRequestId, status: "VOID_PENDING" } });
    try { await client.voidArtAuthorization(reserved.providerAuthorizationId, voidRequestId); await releaseReservation(database, reserved.id, "VOIDED"); return { state: "UNAVAILABLE" as const }; }
    catch { await database.artPaymentAttempt.update({ where: { id: reserved.id }, data: { status: "VOID_PENDING" } }); return { state: "RECONCILING" as const }; }
  }
  if (reserved.status === "RECONCILING") return { state: "RECONCILING" as const };
  if (!reserved.providerAuthorizationId || reserved.reservedUnits !== reserved.requestedUnits) throw new ArtPaymentAttemptError("Contribution reservation could not be verified.", 409);
  const captureRequestId = reserved.paypalCaptureRequestId ?? randomUUID();
  await database.artPaymentAttempt.update({ where: { id: reserved.id }, data: { paypalCaptureRequestId: captureRequestId, status: "CAPTURE_PENDING" } });
  try {
    const capture = await client.captureArtAuthorization(reserved.providerAuthorizationId, { amountCents: reserved.expectedAmountCents, requestId: captureRequestId });
    if (capture.status === "COMPLETED") { await finalizeCapturedAttempt(database, reserved.id, capture); return { state: "COMPLETED" as const }; }
    await database.artPaymentAttempt.update({ where: { id: reserved.id }, data: { status: "RECONCILING", providerCaptureId: capture.id } });
    return { state: "RECONCILING" as const };
  } catch (error) {
    if (isDefinitiveProviderFailure(error)) { await releaseReservation(database, reserved.id, "FAILED"); return { state: "FAILED" as const }; }
    await database.artPaymentAttempt.update({ where: { id: reserved.id }, data: { status: "RECONCILING" } });
    return { state: "RECONCILING" as const };
  }
}

export async function reconcileArtPaymentAttempt(args: { attemptId: string; database?: Database; payPalClient?: PayPalClient }) {
  const database = args.database ?? db;
  const attempt = await database.artPaymentAttempt.findUnique({ where: { id: args.attemptId } });
  if (!attempt || attempt.status === "COMPLETED") return attempt;
  const client = args.payPalClient ?? createPayPalArtOrdersClient();
  if (attempt.providerCaptureId) {
    const capture = await client.getArtCapture(attempt.providerCaptureId);
    if (capture.status === "COMPLETED") return finalizeCapturedAttempt(database, attempt.id, capture);
  }
  return attempt;
}
