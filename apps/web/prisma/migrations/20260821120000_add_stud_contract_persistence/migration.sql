CREATE TYPE "StudCompensationType" AS ENUM ('CASH', 'PUPPY_BACK', 'CASH_AND_PUPPY_BACK');

CREATE TYPE "StudPuppyPickPosition" AS ENUM ('FIRST', 'SECOND');

CREATE TYPE "StudPuppySexRequirement" AS ENUM ('EITHER', 'MALE', 'FEMALE');

CREATE TYPE "StudApprovalMode" AS ENUM ('AUTOMATIC', 'MANUAL');

CREATE TYPE "StudHealthRequirementLevel" AS ENUM ('NONE', 'GREEN_OR_YELLOW', 'GREEN_ONLY');

CREATE TYPE "StudTitleRequirement" AS ENUM ('NONE', 'CH_OR_HIGHER', 'GCH');

CREATE TYPE "StudOfferStatus" AS ENUM ('PUBLISHED', 'RETIRED');

CREATE TYPE "StudContractStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

CREATE TABLE "StudOffer" (
  "id" TEXT NOT NULL,
  "sireDogId" TEXT NOT NULL,
  "ownerKennelId" TEXT NOT NULL,
  "status" "StudOfferStatus" NOT NULL,
  "version" INTEGER NOT NULL,
  "compensationType" "StudCompensationType" NOT NULL,
  "cashAmount" INTEGER,
  "puppyPickPosition" "StudPuppyPickPosition",
  "puppySex" "StudPuppySexRequirement",
  "minimumLitterSize" INTEGER,
  "noLitterReturnService" BOOLEAN NOT NULL DEFAULT false,
  "smallLitterReturnThreshold" INTEGER,
  "brucellosisNegativeRequired" BOOLEAN NOT NULL DEFAULT false,
  "titleRequirement" "StudTitleRequirement" NOT NULL DEFAULT 'NONE',
  "approvalMode" "StudApprovalMode" NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudOffer_sireDogId_fkey" FOREIGN KEY ("sireDogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudOffer_ownerKennelId_fkey" FOREIGN KEY ("ownerKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudOfferHealthRequirement" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "healthTestCode" TEXT NOT NULL,
  "requirementLevel" "StudHealthRequirementLevel" NOT NULL,
  CONSTRAINT "StudOfferHealthRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudOfferHealthRequirement_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "StudOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudContract" (
  "id" TEXT NOT NULL,
  "sourceOfferId" TEXT NOT NULL,
  "sourceOfferVersion" INTEGER NOT NULL,
  "sireDogId" TEXT NOT NULL,
  "damDogId" TEXT NOT NULL,
  "sireKennelId" TEXT NOT NULL,
  "damKennelId" TEXT NOT NULL,
  "status" "StudContractStatus" NOT NULL,
  "compensationType" "StudCompensationType" NOT NULL,
  "cashAmount" INTEGER,
  "puppyPickPosition" "StudPuppyPickPosition",
  "puppySex" "StudPuppySexRequirement",
  "minimumLitterSize" INTEGER,
  "noLitterReturnService" BOOLEAN NOT NULL,
  "smallLitterReturnThreshold" INTEGER,
  "brucellosisNegativeRequired" BOOLEAN NOT NULL,
  "titleRequirement" "StudTitleRequirement" NOT NULL,
  "approvalMode" "StudApprovalMode" NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "approvalDeadlineAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "breedingAttemptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudContract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudContract_sourceOfferId_fkey" FOREIGN KEY ("sourceOfferId") REFERENCES "StudOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudContract_sireDogId_fkey" FOREIGN KEY ("sireDogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudContract_damDogId_fkey" FOREIGN KEY ("damDogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudContract_sireKennelId_fkey" FOREIGN KEY ("sireKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudContract_damKennelId_fkey" FOREIGN KEY ("damKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudContract_breedingAttemptId_fkey" FOREIGN KEY ("breedingAttemptId") REFERENCES "BreedingAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StudContractHealthRequirement" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "healthTestCode" TEXT NOT NULL,
  "requirementLevel" "StudHealthRequirementLevel" NOT NULL,
  CONSTRAINT "StudContractHealthRequirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudContractHealthRequirement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StudContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudOffer_sireDogId_version_key" ON "StudOffer"("sireDogId", "version");
CREATE INDEX "StudOffer_sireDogId_status_idx" ON "StudOffer"("sireDogId", "status");
CREATE INDEX "StudOffer_ownerKennelId_idx" ON "StudOffer"("ownerKennelId");

CREATE UNIQUE INDEX "StudOfferHealthRequirement_offerId_healthTestCode_key" ON "StudOfferHealthRequirement"("offerId", "healthTestCode");
CREATE INDEX "StudOfferHealthRequirement_healthTestCode_idx" ON "StudOfferHealthRequirement"("healthTestCode");

CREATE UNIQUE INDEX "StudContract_breedingAttemptId_key" ON "StudContract"("breedingAttemptId");
CREATE INDEX "StudContract_sourceOfferId_idx" ON "StudContract"("sourceOfferId");
CREATE INDEX "StudContract_sireDogId_idx" ON "StudContract"("sireDogId");
CREATE INDEX "StudContract_damDogId_idx" ON "StudContract"("damDogId");
CREATE INDEX "StudContract_sireKennelId_idx" ON "StudContract"("sireKennelId");
CREATE INDEX "StudContract_damKennelId_idx" ON "StudContract"("damKennelId");
CREATE INDEX "StudContract_status_idx" ON "StudContract"("status");

CREATE UNIQUE INDEX "StudContractHealthRequirement_contractId_healthTestCode_key" ON "StudContractHealthRequirement"("contractId", "healthTestCode");
CREATE INDEX "StudContractHealthRequirement_healthTestCode_idx" ON "StudContractHealthRequirement"("healthTestCode");
