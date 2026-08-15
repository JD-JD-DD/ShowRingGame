CREATE TABLE "BreedGeneticBackgroundSnapshot" (
  "id" TEXT NOT NULL, "breedCode2" TEXT NOT NULL, "gameYear" INTEGER NOT NULL,
  "backgroundRulesVersion" TEXT NOT NULL, "geneticsVersion" TEXT NOT NULL,
  "snapshotEpoch" INTEGER NOT NULL, "sourceStatus" TEXT NOT NULL, "priorSnapshotId" TEXT,
  "sourceFingerprint" TEXT NOT NULL, "eligibleDogCount" INTEGER NOT NULL,
  "usableDogCount" INTEGER NOT NULL, "kennelCount" INTEGER NOT NULL, "litterCount" INTEGER NOT NULL,
  "qualifiesForLiveUpdate" BOOLEAN NOT NULL, "exclusionMetricsJson" JSONB NOT NULL,
  "rawConcentrationJson" JSONB NOT NULL, "weightingAuditJson" JSONB NOT NULL,
  "phenotypeMetricsJson" JSONB NOT NULL, "genotypeMetricsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BreedGeneticBackgroundSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BreedGeneticBackgroundSnapshot_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BreedGeneticBackgroundSnapshot_breedCode2_gameYear_backgroundRulesVersion_key" ON "BreedGeneticBackgroundSnapshot"("breedCode2", "gameYear", "backgroundRulesVersion");
CREATE INDEX "BreedGeneticBackgroundSnapshot_breedCode2_gameYear_idx" ON "BreedGeneticBackgroundSnapshot"("breedCode2", "gameYear");
CREATE INDEX "BreedGeneticBackgroundSnapshot_priorSnapshotId_idx" ON "BreedGeneticBackgroundSnapshot"("priorSnapshotId");
