ALTER TYPE "LedgerTransactionType" ADD VALUE 'KENNEL_SERVICE_PAYOUT';
ALTER TYPE "KennelNoticeType" ADD VALUE 'KENNEL_SERVICE';

CREATE TYPE "KennelServiceType" AS ENUM (
  'CLUB_STEWARDING',
  'GROOMING_ASSISTANCE',
  'BOARDING',
  'PUPPY_SOCIALIZATION',
  'TRANSPORT_ASSISTANCE',
  'HANDLING_ASSISTANCE'
);

CREATE TYPE "KennelServiceClaimStatus" AS ENUM (
  'CLAIMED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "KennelServiceClaim" (
  "id" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "serviceType" "KennelServiceType" NOT NULL,
  "showClusterId" TEXT,
  "dogId" TEXT,
  "weekendKey" TEXT,
  "status" "KennelServiceClaimStatus" NOT NULL DEFAULT 'CLAIMED',
  "payoutAmount" INTEGER NOT NULL,
  "claimedAtEpoch" INTEGER NOT NULL,
  "completedAtEpoch" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KennelServiceClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KennelServiceClaim_kennelId_serviceType_showClusterId_key"
  ON "KennelServiceClaim"("kennelId", "serviceType", "showClusterId");
CREATE UNIQUE INDEX "KennelServiceClaim_kennelId_serviceType_weekendKey_key"
  ON "KennelServiceClaim"("kennelId", "serviceType", "weekendKey");
CREATE INDEX "KennelServiceClaim_kennelId_idx" ON "KennelServiceClaim"("kennelId");
CREATE INDEX "KennelServiceClaim_serviceType_idx" ON "KennelServiceClaim"("serviceType");
CREATE INDEX "KennelServiceClaim_showClusterId_idx" ON "KennelServiceClaim"("showClusterId");
CREATE INDEX "KennelServiceClaim_dogId_idx" ON "KennelServiceClaim"("dogId");
CREATE INDEX "KennelServiceClaim_weekendKey_idx" ON "KennelServiceClaim"("weekendKey");
CREATE INDEX "KennelServiceClaim_status_idx" ON "KennelServiceClaim"("status");

ALTER TABLE "KennelServiceClaim"
  ADD CONSTRAINT "KennelServiceClaim_kennelId_fkey"
  FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelServiceClaim"
  ADD CONSTRAINT "KennelServiceClaim_showClusterId_fkey"
  FOREIGN KEY ("showClusterId") REFERENCES "ShowCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KennelServiceClaim"
  ADD CONSTRAINT "KennelServiceClaim_dogId_fkey"
  FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
