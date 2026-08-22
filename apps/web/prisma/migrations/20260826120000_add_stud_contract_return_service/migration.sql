CREATE TYPE "StudContractReturnServiceStatus" AS ENUM ('AVAILABLE', 'USED', 'EXPIRED', 'EXTINGUISHED');

CREATE TYPE "StudContractReturnServiceTrigger" AS ENUM ('NO_LITTER', 'SMALL_LITTER');

CREATE TYPE "StudContractReturnServiceExtinguishmentReason" AS ENUM ('OWNERSHIP_TRANSFER', 'DOG_DEATH', 'PERMANENT_BREEDING_INELIGIBILITY');

CREATE TABLE "StudContractReturnService" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "StudContractReturnServiceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "trigger" "StudContractReturnServiceTrigger" NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "extinguishedAt" TIMESTAMP(3),
    "extinguishmentReason" "StudContractReturnServiceExtinguishmentReason",
    "returnBreedingAttemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudContractReturnService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudContractReturnService_contractId_key" ON "StudContractReturnService"("contractId");
CREATE UNIQUE INDEX "StudContractReturnService_returnBreedingAttemptId_key" ON "StudContractReturnService"("returnBreedingAttemptId");
CREATE INDEX "StudContractReturnService_status_expiresAt_idx" ON "StudContractReturnService"("status", "expiresAt");

ALTER TABLE "StudContractReturnService" ADD CONSTRAINT "StudContractReturnService_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StudContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudContractReturnService" ADD CONSTRAINT "StudContractReturnService_returnBreedingAttemptId_fkey" FOREIGN KEY ("returnBreedingAttemptId") REFERENCES "BreedingAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
