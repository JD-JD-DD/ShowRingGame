ALTER TYPE "LedgerTransactionType" ADD VALUE IF NOT EXISTS 'HEALTH_TEST_FEE';

DROP INDEX IF EXISTS "HealthTestRecord_dogId_testTypeCode_key";

ALTER TABLE "HealthTestRecord"
ADD COLUMN "testedAtEpoch" INTEGER,
ADD COLUMN "detailsJson" JSONB;

CREATE INDEX "HealthTestRecord_dogId_testTypeCode_testedAtEpoch_idx"
ON "HealthTestRecord"("dogId", "testTypeCode", "testedAtEpoch");

CREATE TABLE "DogHealthConditionTruth" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "conditionCode" TEXT NOT NULL,
    "geneticLiability" DOUBLE PRECISION NOT NULL,
    "environmentModifier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alleleA" TEXT,
    "alleleB" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogHealthConditionTruth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogHealthConditionTruth_dogId_conditionCode_key"
ON "DogHealthConditionTruth"("dogId", "conditionCode");

CREATE INDEX "DogHealthConditionTruth_conditionCode_idx"
ON "DogHealthConditionTruth"("conditionCode");

ALTER TABLE "DogHealthConditionTruth"
ADD CONSTRAINT "DogHealthConditionTruth_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
