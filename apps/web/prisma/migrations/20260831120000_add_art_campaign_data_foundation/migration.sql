-- ART-02: independent Breed Art campaign, contribution, and final-artwork persistence.
CREATE TYPE "ArtCampaignStatus" AS ENUM ('NEEDS_FUNDING', 'FUNDED', 'DRAWING_COMPLETE');

CREATE TYPE "ArtContributionRecognition" AS ENUM ('KENNEL_CREDIT', 'ANONYMOUS');

CREATE TABLE "ArtCampaign" (
  "id" TEXT NOT NULL,
  "breedCode2" TEXT NOT NULL,
  "campaignKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fundingGoalCents" INTEGER NOT NULL,
  "fundingUnitCents" INTEGER NOT NULL,
  "totalFundingUnits" INTEGER NOT NULL,
  "artistAllocationCents" INTEGER NOT NULL,
  "showRingAllocationCents" INTEGER NOT NULL,
  "status" "ArtCampaignStatus" NOT NULL DEFAULT 'NEEDS_FUNDING',
  "fundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ArtCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtContribution" (
  "id" TEXT NOT NULL,
  "artCampaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "requestedUnits" INTEGER NOT NULL,
  "fundedUnits" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "recognition" "ArtContributionRecognition" NOT NULL,
  "provider" TEXT,
  "providerPaymentId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ArtContribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArtArtwork" (
  "id" TEXT NOT NULL,
  "artCampaignId" TEXT NOT NULL,
  "artistCredit" TEXT,
  "assetReference" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ArtArtwork_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtCampaign_breedCode2_campaignKey_key" ON "ArtCampaign"("breedCode2", "campaignKey");
CREATE INDEX "ArtCampaign_status_idx" ON "ArtCampaign"("status");
CREATE UNIQUE INDEX "ArtContribution_providerPaymentId_key" ON "ArtContribution"("providerPaymentId");
CREATE INDEX "ArtContribution_artCampaignId_idx" ON "ArtContribution"("artCampaignId");
CREATE INDEX "ArtContribution_userId_idx" ON "ArtContribution"("userId");
CREATE INDEX "ArtContribution_kennelId_idx" ON "ArtContribution"("kennelId");
CREATE UNIQUE INDEX "ArtArtwork_artCampaignId_key" ON "ArtArtwork"("artCampaignId");

ALTER TABLE "ArtCampaign" ADD CONSTRAINT "ArtCampaign_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtContribution" ADD CONSTRAINT "ArtContribution_artCampaignId_fkey" FOREIGN KEY ("artCampaignId") REFERENCES "ArtCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtContribution" ADD CONSTRAINT "ArtContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtContribution" ADD CONSTRAINT "ArtContribution_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArtArtwork" ADD CONSTRAINT "ArtArtwork_artCampaignId_fkey" FOREIGN KEY ("artCampaignId") REFERENCES "ArtCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
