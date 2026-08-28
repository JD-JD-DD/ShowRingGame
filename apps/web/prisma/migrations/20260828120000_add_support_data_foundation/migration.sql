-- SUPPORT-01: account-level support records are separate from the in-game
-- economy. Tier periods retain historical support levels when a subscription
-- changes tier or ends.
CREATE TYPE "SupportTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

CREATE TYPE "SupportProvider" AS ENUM ('PAYPAL');

CREATE TYPE "SupportStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'PAYMENT_RETRY',
  'CANCELLATION_SCHEDULED',
  'ENDED'
);

ALTER TABLE "Kennel"
  ADD COLUMN "showSupporterBadge" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SupportSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "SupportProvider" NOT NULL,
  "providerSubscriptionId" TEXT NOT NULL,
  "currentTier" "SupportTier" NOT NULL,
  "status" "SupportStatus" NOT NULL,
  "currentPaidPeriodStart" TIMESTAMP(3),
  "currentPaidPeriodEnd" TIMESTAMP(3),
  "firstSupportedAt" TIMESTAMP(3),
  "cancellationRequestedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportSubscriptionTierPeriod" (
  "id" TEXT NOT NULL,
  "supportSubscriptionId" TEXT NOT NULL,
  "tier" "SupportTier" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupportSubscriptionTierPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportSubscription_providerSubscriptionId_key"
  ON "SupportSubscription"("providerSubscriptionId");
CREATE INDEX "SupportSubscription_userId_status_idx"
  ON "SupportSubscription"("userId", "status");
CREATE INDEX "SupportSubscription_currentPaidPeriodEnd_idx"
  ON "SupportSubscription"("currentPaidPeriodEnd");
CREATE INDEX "SupportSubscriptionTierPeriod_supportSubscriptionId_startedAt_idx"
  ON "SupportSubscriptionTierPeriod"("supportSubscriptionId", "startedAt");

ALTER TABLE "SupportSubscription"
  ADD CONSTRAINT "SupportSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportSubscriptionTierPeriod"
  ADD CONSTRAINT "SupportSubscriptionTierPeriod_supportSubscriptionId_fkey"
  FOREIGN KEY ("supportSubscriptionId") REFERENCES "SupportSubscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
