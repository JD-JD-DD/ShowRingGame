CREATE TABLE "BreedJudgingProfile" (
  "id" TEXT NOT NULL,
  "breedCode2" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "headWeight" DECIMAL(5,2) NOT NULL,
  "forequartersWeight" DECIMAL(5,2) NOT NULL,
  "hindquartersWeight" DECIMAL(5,2) NOT NULL,
  "gaitWeight" DECIMAL(5,2) NOT NULL,
  "coatWeight" DECIMAL(5,2) NOT NULL,
  "sizeWeight" DECIMAL(5,2) NOT NULL,
  "temperamentWeight" DECIMAL(5,2) NOT NULL,
  "showShineWeight" DECIMAL(5,2) NOT NULL,
  "feetWeight" DECIMAL(5,2) NOT NULL,
  "toplineWeight" DECIMAL(5,2) NOT NULL,
  "source" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BreedJudgingProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BreedJudgingProfile_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BreedJudgingProfile_breedCode2_rulesVersion_key" ON "BreedJudgingProfile"("breedCode2", "rulesVersion");
CREATE INDEX "BreedJudgingProfile_breedCode2_isActive_idx" ON "BreedJudgingProfile"("breedCode2", "isActive");
CREATE INDEX "BreedJudgingProfile_rulesVersion_isActive_idx" ON "BreedJudgingProfile"("rulesVersion", "isActive");
