CREATE TYPE "AnnualChampionshipPointScheduleResolutionType" AS ENUM ('LOCAL', 'PRIOR_PUBLISHED_SCHEDULE', 'NATIONAL_SAME_BREED_SAME_SEX');

ALTER TABLE "AnnualChampionshipPointSchedule"
  ADD COLUMN "resolutionType" "AnnualChampionshipPointScheduleResolutionType" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "sourceObservationCount" INTEGER,
  ADD COLUMN "inheritedFromScheduleId" TEXT;

ALTER TABLE "AnnualChampionshipPointSchedule"
  ALTER COLUMN "resolutionType" DROP DEFAULT;

CREATE INDEX "AnnualChampionshipPointSchedule_inheritedFromScheduleId_idx" ON "AnnualChampionshipPointSchedule"("inheritedFromScheduleId");
