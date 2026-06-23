-- CreateEnum
CREATE TYPE "DogEmergencyCareType" AS ENUM ('ACCIDENT_ILLNESS');

-- CreateEnum
CREATE TYPE "DogEmergencyCareStatus" AS ENUM ('PENDING', 'TREATED_SURVIVED', 'TREATED_DIED', 'DECLINED_DIED', 'EXPIRED_DIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DogEmergencyTreatmentOutcome" AS ENUM ('SURVIVED', 'SURVIVED_SHOW_INELIGIBLE_3_MONTHS', 'SURVIVED_SHOW_INELIGIBLE_6_MONTHS_BREED_INELIGIBLE_6_MONTHS', 'SURVIVED_LIFETIME_BREED_INELIGIBLE', 'SURVIVED_TRAIT_MODIFIER', 'DIED_DESPITE_TREATMENT');

-- AlterEnum
ALTER TYPE "LedgerTransactionType" ADD VALUE 'EMERGENCY_VET_CARE';

-- CreateTable
CREATE TABLE "DogEmergencyCareEvent" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "kennelIdAtEvent" TEXT,
    "emergencyType" "DogEmergencyCareType" NOT NULL,
    "status" "DogEmergencyCareStatus" NOT NULL DEFAULT 'PENDING',
    "createdAtEpoch" INTEGER NOT NULL,
    "responseDeadlineEpoch" INTEGER NOT NULL,
    "treatmentCost" INTEGER NOT NULL,
    "survivalChanceBps" INTEGER NOT NULL,
    "paidAtEpoch" INTEGER,
    "resolvedAtEpoch" INTEGER,
    "treatmentOutcome" "DogEmergencyTreatmentOutcome",
    "ledgerTransactionId" TEXT,
    "showIneligibleUntilEpoch" INTEGER,
    "breedIneligibleUntilEpoch" INTEGER,
    "lifetimeBreedIneligible" BOOLEAN NOT NULL DEFAULT false,
    "traitModifierJson" JSONB,
    "outcomeSeed" TEXT,
    "outcomeRollBps" INTEGER,
    "canceledAtEpoch" INTEGER,
    "canceledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogEmergencyCareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DogEmergencyCareEvent_ledgerTransactionId_key" ON "DogEmergencyCareEvent"("ledgerTransactionId");

-- CreateIndex
CREATE INDEX "DogEmergencyCareEvent_dogId_idx" ON "DogEmergencyCareEvent"("dogId");

-- CreateIndex
CREATE INDEX "DogEmergencyCareEvent_kennelIdAtEvent_idx" ON "DogEmergencyCareEvent"("kennelIdAtEvent");

-- CreateIndex
CREATE INDEX "DogEmergencyCareEvent_status_idx" ON "DogEmergencyCareEvent"("status");

-- CreateIndex
CREATE INDEX "DogEmergencyCareEvent_responseDeadlineEpoch_idx" ON "DogEmergencyCareEvent"("responseDeadlineEpoch");

-- AddForeignKey
ALTER TABLE "DogEmergencyCareEvent" ADD CONSTRAINT "DogEmergencyCareEvent_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogEmergencyCareEvent" ADD CONSTRAINT "DogEmergencyCareEvent_kennelIdAtEvent_fkey" FOREIGN KEY ("kennelIdAtEvent") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogEmergencyCareEvent" ADD CONSTRAINT "DogEmergencyCareEvent_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
