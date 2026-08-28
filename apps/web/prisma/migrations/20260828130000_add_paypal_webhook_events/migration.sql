-- SUPPORT-03: retained provider events provide webhook idempotency and a small
-- operational audit trail without becoming a payment ledger.
CREATE TYPE "SupportProviderEventProcessingStatus" AS ENUM (
  'RECEIVED',
  'PROCESSED',
  'IGNORED',
  'FAILED'
);

CREATE TABLE "SupportProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" "SupportProvider" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerSubscriptionId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processingStatus" "SupportProviderEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportProviderEvent_providerEventId_key"
  ON "SupportProviderEvent"("providerEventId");
CREATE INDEX "SupportProviderEvent_providerSubscriptionId_idx"
  ON "SupportProviderEvent"("providerSubscriptionId");
CREATE INDEX "SupportProviderEvent_processingStatus_receivedAt_idx"
  ON "SupportProviderEvent"("processingStatus", "receivedAt");
