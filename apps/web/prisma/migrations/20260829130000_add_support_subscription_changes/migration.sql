CREATE TYPE "SupportSubscriptionChangeType" AS ENUM ('UPGRADE');

CREATE TYPE "SupportSubscriptionChangeStatus" AS ENUM ('PENDING_APPROVAL', 'TARGET_ACTIVE_CANCELLATION_PENDING', 'COMPLETED', 'ABANDONED', 'CLEANUP_FAILED');

CREATE TABLE "SupportSubscriptionChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceSupportSubscriptionId" TEXT NOT NULL,
    "targetSupportSubscriptionId" TEXT,
    "targetTier" "SupportTier" NOT NULL,
    "approvalUrl" TEXT,
    "type" "SupportSubscriptionChangeType" NOT NULL DEFAULT 'UPGRADE',
    "status" "SupportSubscriptionChangeStatus" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetActivatedAt" TIMESTAMP(3),
    "sourceCancellationRequestedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "abandonedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportSubscriptionChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportSubscriptionChange_targetSupportSubscriptionId_key" ON "SupportSubscriptionChange"("targetSupportSubscriptionId");
CREATE INDEX "SupportSubscriptionChange_userId_status_idx" ON "SupportSubscriptionChange"("userId", "status");
CREATE INDEX "SupportSubscriptionChange_sourceSupportSubscriptionId_idx" ON "SupportSubscriptionChange"("sourceSupportSubscriptionId");

ALTER TABLE "SupportSubscriptionChange" ADD CONSTRAINT "SupportSubscriptionChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportSubscriptionChange" ADD CONSTRAINT "SupportSubscriptionChange_sourceSupportSubscriptionId_fkey" FOREIGN KEY ("sourceSupportSubscriptionId") REFERENCES "SupportSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportSubscriptionChange" ADD CONSTRAINT "SupportSubscriptionChange_targetSupportSubscriptionId_fkey" FOREIGN KEY ("targetSupportSubscriptionId") REFERENCES "SupportSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
