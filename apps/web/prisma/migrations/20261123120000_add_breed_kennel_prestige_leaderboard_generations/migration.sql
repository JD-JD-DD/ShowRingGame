CREATE TYPE "BreedKennelPrestigeLeaderboardGenerationStatus" AS ENUM ('WORKING', 'PUBLISHED');

CREATE TABLE "BreedKennelPrestigeLeaderboardState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "publishedGenerationId" TEXT,
  "workingGenerationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BreedKennelPrestigeLeaderboardState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BreedKennelPrestigeLeaderboardState_singleton_check" CHECK ("id" = 1)
);

CREATE TABLE "BreedKennelPrestigeLeaderboardGeneration" (
  "id" TEXT NOT NULL,
  "status" "BreedKennelPrestigeLeaderboardGenerationStatus" NOT NULL DEFAULT 'WORKING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BreedKennelPrestigeLeaderboardGeneration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BreedKennelPrestigeLeaderboardManifestBreed" (
  "generationId" TEXT NOT NULL,
  "breedCode2" TEXT NOT NULL,
  "groupCode" "ShowGroupCode" NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completionClaimToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BreedKennelPrestigeLeaderboardManifestBreed_pkey" PRIMARY KEY ("generationId", "breedCode2")
);

CREATE TABLE "BreedKennelPrestigeLeaderboardEntry" (
  "id" TEXT NOT NULL,
  "generationId" TEXT NOT NULL,
  "breedCode2" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "kennelId" TEXT NOT NULL,
  "kennelName" TEXT NOT NULL,
  "kennelSlug" TEXT NOT NULL,
  "prestigeScore" INTEGER NOT NULL,
  "tierLabel" TEXT NOT NULL,
  "championsBred" INTEGER NOT NULL,
  "bestInShowWins" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BreedKennelPrestigeLeaderboardEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BreedKennelPrestigeLeaderboardEntry_rank_check" CHECK ("rank" > 0 AND "rank" <= 10)
);

CREATE UNIQUE INDEX "BreedKennelPrestigeLeaderboardState_publishedGenerationId_key" ON "BreedKennelPrestigeLeaderboardState"("publishedGenerationId");
CREATE UNIQUE INDEX "BreedKennelPrestigeLeaderboardState_workingGenerationId_key" ON "BreedKennelPrestigeLeaderboardState"("workingGenerationId");
CREATE INDEX "BreedKennelPrestigeLeaderboardManifestBreed_generationId_groupCode_breedCode2_idx" ON "BreedKennelPrestigeLeaderboardManifestBreed"("generationId", "groupCode", "breedCode2");
CREATE UNIQUE INDEX "BreedKennelPrestigeLeaderboardEntry_generationId_breedCode2_rank_key" ON "BreedKennelPrestigeLeaderboardEntry"("generationId", "breedCode2", "rank");
CREATE INDEX "BreedKennelPrestigeLeaderboardEntry_generationId_breedCode2_rank_idx" ON "BreedKennelPrestigeLeaderboardEntry"("generationId", "breedCode2", "rank");
CREATE INDEX "BreedKennelPrestigeLeaderboardEntry_kennelId_idx" ON "BreedKennelPrestigeLeaderboardEntry"("kennelId");

ALTER TABLE "BreedKennelPrestigeLeaderboardState" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardState_publishedGenerationId_fkey" FOREIGN KEY ("publishedGenerationId") REFERENCES "BreedKennelPrestigeLeaderboardGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardState" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardState_workingGenerationId_fkey" FOREIGN KEY ("workingGenerationId") REFERENCES "BreedKennelPrestigeLeaderboardGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardManifestBreed" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardManifestBreed_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "BreedKennelPrestigeLeaderboardGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardManifestBreed" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardManifestBreed_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardEntry" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardEntry_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "BreedKennelPrestigeLeaderboardGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardEntry" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardEntry_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BreedKennelPrestigeLeaderboardEntry" ADD CONSTRAINT "BreedKennelPrestigeLeaderboardEntry_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
