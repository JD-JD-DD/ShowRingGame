ALTER TABLE "DogListing"
ADD COLUMN IF NOT EXISTS "requiresBrucellosisNegativeDam" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "DogInfectiousDiseaseStatus" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "diseaseCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "infectedAtEpoch" INTEGER,
    "sourceDogId" TEXT,
    "sourceBreedingAttemptId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogInfectiousDiseaseStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DogInfectiousDiseaseStatus_dogId_diseaseCode_key"
ON "DogInfectiousDiseaseStatus"("dogId", "diseaseCode");

CREATE INDEX IF NOT EXISTS "DogInfectiousDiseaseStatus_dogId_idx"
ON "DogInfectiousDiseaseStatus"("dogId");

CREATE INDEX IF NOT EXISTS "DogInfectiousDiseaseStatus_diseaseCode_idx"
ON "DogInfectiousDiseaseStatus"("diseaseCode");

CREATE INDEX IF NOT EXISTS "DogInfectiousDiseaseStatus_status_idx"
ON "DogInfectiousDiseaseStatus"("status");

CREATE INDEX IF NOT EXISTS "DogInfectiousDiseaseStatus_sourceDogId_idx"
ON "DogInfectiousDiseaseStatus"("sourceDogId");

ALTER TABLE "DogInfectiousDiseaseStatus"
ADD CONSTRAINT "DogInfectiousDiseaseStatus_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DogInfectiousDiseaseStatus"
ADD CONSTRAINT "DogInfectiousDiseaseStatus_sourceDogId_fkey"
FOREIGN KEY ("sourceDogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "InfectiousDiseaseTestRecord" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "diseaseCode" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL,
    "testedAtEpoch" INTEGER NOT NULL,
    "validUntilEpoch" INTEGER,
    "breedingAttemptId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfectiousDiseaseTestRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InfectiousDiseaseTestRecord_dogId_diseaseCode_testedAtEpoch_idx"
ON "InfectiousDiseaseTestRecord"("dogId", "diseaseCode", "testedAtEpoch");

CREATE INDEX IF NOT EXISTS "InfectiousDiseaseTestRecord_dogId_diseaseCode_validUntilEpoch_idx"
ON "InfectiousDiseaseTestRecord"("dogId", "diseaseCode", "validUntilEpoch");

CREATE INDEX IF NOT EXISTS "InfectiousDiseaseTestRecord_diseaseCode_idx"
ON "InfectiousDiseaseTestRecord"("diseaseCode");

CREATE INDEX IF NOT EXISTS "InfectiousDiseaseTestRecord_resultCode_idx"
ON "InfectiousDiseaseTestRecord"("resultCode");

CREATE INDEX IF NOT EXISTS "InfectiousDiseaseTestRecord_breedingAttemptId_idx"
ON "InfectiousDiseaseTestRecord"("breedingAttemptId");

ALTER TABLE "InfectiousDiseaseTestRecord"
ADD CONSTRAINT "InfectiousDiseaseTestRecord_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InfectiousDiseaseTestRecord"
ADD CONSTRAINT "InfectiousDiseaseTestRecord_breedingAttemptId_fkey"
FOREIGN KEY ("breedingAttemptId") REFERENCES "BreedingAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
