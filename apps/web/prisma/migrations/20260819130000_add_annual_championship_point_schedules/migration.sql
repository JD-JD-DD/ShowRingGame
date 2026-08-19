CREATE TYPE "AnnualChampionshipPointSchedulePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "AnnualChampionshipPointSchedulePublication" (
  "id" TEXT NOT NULL,
  "sourceYear" INTEGER NOT NULL,
  "effectiveYear" INTEGER NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "status" "AnnualChampionshipPointSchedulePublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "calculatedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnnualChampionshipPointSchedulePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnualChampionshipPointSchedule" (
  "id" TEXT NOT NULL,
  "publicationId" TEXT NOT NULL,
  "effectiveYear" INTEGER NOT NULL,
  "district" INTEGER NOT NULL,
  "breedCode2" TEXT NOT NULL,
  "sex" "Sex" NOT NULL,
  "onePointThreshold" INTEGER NOT NULL,
  "twoPointThreshold" INTEGER NOT NULL,
  "threePointThreshold" INTEGER NOT NULL,
  "fourPointThreshold" INTEGER NOT NULL,
  "fivePointThreshold" INTEGER NOT NULL,
  "observationCount" INTEGER NOT NULL,
  "achievedOnePointRate" DECIMAL(8,6) NOT NULL,
  "achievedMajorRate" DECIMAL(8,6) NOT NULL,
  "achievedFivePointRate" DECIMAL(8,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnnualChampionshipPointSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnnualChampionshipPointSchedule_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AnnualChampionshipPointSchedule_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "AnnualChampionshipPointSchedulePublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AnnualChampionshipPointSchedulePublication_effectiveYear_key" ON "AnnualChampionshipPointSchedulePublication"("effectiveYear");
CREATE UNIQUE INDEX "AnnualChampionshipPointSchedule_effectiveYear_district_breedCode2_sex_key" ON "AnnualChampionshipPointSchedule"("effectiveYear", "district", "breedCode2", "sex");
