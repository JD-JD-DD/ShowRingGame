CREATE TYPE "ArtPaymentAttemptStatus" AS ENUM ('CREATED', 'ORDER_CREATED', 'APPROVED', 'AUTHORIZED', 'RESERVED', 'UNAVAILABLE_AFTER_AUTH', 'CAPTURE_PENDING', 'COMPLETED', 'FAILED', 'VOID_PENDING', 'VOIDED', 'CANCELLED', 'EXPIRED', 'RECONCILING');
CREATE TYPE "ArtPaymentProviderEventProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "ArtPaymentAttempt" (
  "id" TEXT NOT NULL,
  "artCampaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "requestedUnits" INTEGER NOT NULL,
  "expectedAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "recognition" "ArtContributionRecognition" NOT NULL,
  "nonRefundableAcknowledged" BOOLEAN NOT NULL,
  "nonRefundableAcknowledgedAt" TIMESTAMP(3) NOT NULL,
  "status" "ArtPaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "clientRequestId" TEXT NOT NULL,
  "paypalCreateOrderRequestId" TEXT NOT NULL,
  "paypalAuthorizeRequestId" TEXT,
  "paypalCaptureRequestId" TEXT,
  "paypalVoidRequestId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'PAYPAL',
  "providerOrderId" TEXT,
  "providerApprovalUrl" TEXT,
  "providerAuthorizationId" TEXT,
  "providerCaptureId" TEXT,
  "providerOrderStatus" TEXT,
  "approvedAt" TIMESTAMP(3),
  "authorizedAt" TIMESTAMP(3),
  "reservedUnits" INTEGER,
  "reservationAcquiredAt" TIMESTAMP(3),
  "reservationReleasedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "terminalAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArtPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtPaymentProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "artPaymentAttemptId" TEXT,
  "providerResourceId" TEXT,
  "processingStatus" "ArtPaymentProviderEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArtPaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtPaymentAttempt_paypalCreateOrderRequestId_key" ON "ArtPaymentAttempt"("paypalCreateOrderRequestId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_paypalAuthorizeRequestId_key" ON "ArtPaymentAttempt"("paypalAuthorizeRequestId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_paypalCaptureRequestId_key" ON "ArtPaymentAttempt"("paypalCaptureRequestId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_paypalVoidRequestId_key" ON "ArtPaymentAttempt"("paypalVoidRequestId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_providerOrderId_key" ON "ArtPaymentAttempt"("providerOrderId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_providerAuthorizationId_key" ON "ArtPaymentAttempt"("providerAuthorizationId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_providerCaptureId_key" ON "ArtPaymentAttempt"("providerCaptureId");
CREATE UNIQUE INDEX "ArtPaymentAttempt_userId_clientRequestId_key" ON "ArtPaymentAttempt"("userId", "clientRequestId");
CREATE INDEX "ArtPaymentAttempt_artCampaignId_status_idx" ON "ArtPaymentAttempt"("artCampaignId", "status");
CREATE INDEX "ArtPaymentAttempt_userId_createdAt_idx" ON "ArtPaymentAttempt"("userId", "createdAt");
CREATE INDEX "ArtPaymentAttempt_status_updatedAt_idx" ON "ArtPaymentAttempt"("status", "updatedAt");
CREATE UNIQUE INDEX "ArtPaymentProviderEvent_providerEventId_key" ON "ArtPaymentProviderEvent"("providerEventId");
CREATE INDEX "ArtPaymentProviderEvent_artPaymentAttemptId_idx" ON "ArtPaymentProviderEvent"("artPaymentAttemptId");
CREATE INDEX "ArtPaymentProviderEvent_processingStatus_receivedAt_idx" ON "ArtPaymentProviderEvent"("processingStatus", "receivedAt");

ALTER TABLE "ArtPaymentAttempt" ADD CONSTRAINT "ArtPaymentAttempt_artCampaignId_fkey" FOREIGN KEY ("artCampaignId") REFERENCES "ArtCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtPaymentAttempt" ADD CONSTRAINT "ArtPaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtPaymentAttempt" ADD CONSTRAINT "ArtPaymentAttempt_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtPaymentProviderEvent" ADD CONSTRAINT "ArtPaymentProviderEvent_artPaymentAttemptId_fkey" FOREIGN KEY ("artPaymentAttemptId") REFERENCES "ArtPaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
