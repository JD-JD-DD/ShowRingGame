-- AlterEnum
ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'GROOMING_INCOME';
ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'STEWARDING_INCOME';

-- AlterTable
ALTER TABLE "Dog" ALTER COLUMN "coatCondition" TYPE DOUBLE PRECISION USING "coatCondition"::DOUBLE PRECISION;
ALTER TABLE "Dog" ALTER COLUMN "coatCondition" SET DEFAULT 0;

-- CreateEnum
CREATE TYPE "GroomingListingStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GroomingServiceActionType" AS ENUM ('SELF_GROOM', 'OUTSIDE_GROOM');

-- CreateTable
CREATE TABLE "GroomingListing" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "ownerKennelId" TEXT NOT NULL,
    "status" "GroomingListingStatus" NOT NULL DEFAULT 'OPEN',
    "price" INTEGER NOT NULL,
    "listedAtEpoch" INTEGER NOT NULL,
    "completedAtEpoch" INTEGER,
    "groomerKennelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroomingListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroomingServiceAction" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "ownerKennelId" TEXT NOT NULL,
    "groomerKennelId" TEXT NOT NULL,
    "listingId" TEXT,
    "actionType" "GroomingServiceActionType" NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "coatGain" DOUBLE PRECISION NOT NULL,
    "occurredAtEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroomingServiceAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KennelServiceProfile" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "groomingXp" INTEGER NOT NULL DEFAULT 0,
    "groomingLevel" INTEGER NOT NULL DEFAULT 0,
    "groomingActionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "outsideGroomingJobsCompleted" INTEGER NOT NULL DEFAULT 0,
    "selfGroomingActionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KennelServiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroomingListing_status_idx" ON "GroomingListing"("status");
CREATE INDEX "GroomingListing_dogId_idx" ON "GroomingListing"("dogId");
CREATE INDEX "GroomingListing_ownerKennelId_idx" ON "GroomingListing"("ownerKennelId");
CREATE INDEX "GroomingListing_groomerKennelId_idx" ON "GroomingListing"("groomerKennelId");
CREATE INDEX "GroomingServiceAction_dogId_idx" ON "GroomingServiceAction"("dogId");
CREATE INDEX "GroomingServiceAction_ownerKennelId_idx" ON "GroomingServiceAction"("ownerKennelId");
CREATE INDEX "GroomingServiceAction_groomerKennelId_idx" ON "GroomingServiceAction"("groomerKennelId");
CREATE INDEX "GroomingServiceAction_occurredAtEpoch_idx" ON "GroomingServiceAction"("occurredAtEpoch");
CREATE INDEX "GroomingServiceAction_actionType_idx" ON "GroomingServiceAction"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "KennelServiceProfile_kennelId_key" ON "KennelServiceProfile"("kennelId");

-- AddForeignKey
ALTER TABLE "GroomingListing" ADD CONSTRAINT "GroomingListing_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroomingListing" ADD CONSTRAINT "GroomingListing_ownerKennelId_fkey" FOREIGN KEY ("ownerKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroomingListing" ADD CONSTRAINT "GroomingListing_groomerKennelId_fkey" FOREIGN KEY ("groomerKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GroomingServiceAction" ADD CONSTRAINT "GroomingServiceAction_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroomingServiceAction" ADD CONSTRAINT "GroomingServiceAction_ownerKennelId_fkey" FOREIGN KEY ("ownerKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroomingServiceAction" ADD CONSTRAINT "GroomingServiceAction_groomerKennelId_fkey" FOREIGN KEY ("groomerKennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroomingServiceAction" ADD CONSTRAINT "GroomingServiceAction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GroomingListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KennelServiceProfile" ADD CONSTRAINT "KennelServiceProfile_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
