-- AlterEnum
ALTER TYPE "BreedingAttemptStatus" ADD VALUE 'REPRODUCTIVE_EMERGENCY';

-- CreateEnum
CREATE TYPE "ReproductiveEmergencyType" AS ENUM ('WHELPING_COMPLICATION');

-- CreateEnum
CREATE TYPE "ReproductiveEmergencyStatus" AS ENUM ('PENDING', 'TREATMENT_AUTHORIZED', 'RESOLVED_TREATED', 'RESOLVED_UNTREATED');

-- CreateEnum
CREATE TYPE "ReproductiveDamOutcome" AS ENUM ('SURVIVED', 'DIED');

-- CreateEnum
CREATE TYPE "ReproductivePuppyOutcome" AS ENUM ('ALL_SURVIVED', 'PARTIAL_SURVIVAL', 'NONE_SURVIVED');

-- CreateEnum
CREATE TYPE "ReproductiveConsequence" AS ENUM ('NONE', 'EXTENDED_RECOVERY', 'PERMANENT_BREEDING_RESTRICTION');

-- CreateTable
CREATE TABLE "ReproductiveEmergencyEvent" (
    "id" TEXT NOT NULL,
    "breedingAttemptId" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "kennelIdAtEvent" TEXT,
    "litterId" TEXT,
    "ledgerTransactionId" TEXT,
    "type" "ReproductiveEmergencyType" NOT NULL,
    "status" "ReproductiveEmergencyStatus" NOT NULL DEFAULT 'PENDING',
    "sourceKey" TEXT NOT NULL,
    "createdAtEpoch" INTEGER NOT NULL,
    "responseDeadlineEpoch" INTEGER NOT NULL,
    "treatmentAuthorizedEpoch" INTEGER,
    "resolvedEpoch" INTEGER,
    "treatmentCost" INTEGER NOT NULL,
    "intendedPuppyCount" INTEGER NOT NULL,
    "survivingPuppyCount" INTEGER,
    "damOutcome" "ReproductiveDamOutcome",
    "puppyOutcome" "ReproductivePuppyOutcome",
    "reproductiveConsequence" "ReproductiveConsequence",
    "recoveryUntilEpoch" INTEGER,
    "rulesetVersion" TEXT NOT NULL,
    "rngSeed" INTEGER NOT NULL,
    "triggerRoll" INTEGER NOT NULL,
    "damOutcomeRoll" INTEGER,
    "puppyOutcomeRoll" INTEGER,
    "reproductiveConsequenceRoll" INTEGER,
    "outcomeMetadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproductiveEmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReproductiveEmergencyEvent_breedingAttemptId_key" ON "ReproductiveEmergencyEvent"("breedingAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "ReproductiveEmergencyEvent_litterId_key" ON "ReproductiveEmergencyEvent"("litterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReproductiveEmergencyEvent_ledgerTransactionId_key" ON "ReproductiveEmergencyEvent"("ledgerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReproductiveEmergencyEvent_sourceKey_key" ON "ReproductiveEmergencyEvent"("sourceKey");

-- CreateIndex
CREATE INDEX "ReproductiveEmergencyEvent_damId_idx" ON "ReproductiveEmergencyEvent"("damId");

-- CreateIndex
CREATE INDEX "ReproductiveEmergencyEvent_kennelIdAtEvent_idx" ON "ReproductiveEmergencyEvent"("kennelIdAtEvent");

-- CreateIndex
CREATE INDEX "ReproductiveEmergencyEvent_status_idx" ON "ReproductiveEmergencyEvent"("status");

-- CreateIndex
CREATE INDEX "ReproductiveEmergencyEvent_responseDeadlineEpoch_idx" ON "ReproductiveEmergencyEvent"("responseDeadlineEpoch");

-- AddForeignKey
ALTER TABLE "ReproductiveEmergencyEvent" ADD CONSTRAINT "ReproductiveEmergencyEvent_breedingAttemptId_fkey" FOREIGN KEY ("breedingAttemptId") REFERENCES "BreedingAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveEmergencyEvent" ADD CONSTRAINT "ReproductiveEmergencyEvent_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveEmergencyEvent" ADD CONSTRAINT "ReproductiveEmergencyEvent_kennelIdAtEvent_fkey" FOREIGN KEY ("kennelIdAtEvent") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveEmergencyEvent" ADD CONSTRAINT "ReproductiveEmergencyEvent_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproductiveEmergencyEvent" ADD CONSTRAINT "ReproductiveEmergencyEvent_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
