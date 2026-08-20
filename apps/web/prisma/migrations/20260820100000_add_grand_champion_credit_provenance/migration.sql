-- Prospective GCH provenance only. Existing historical credits deliberately remain null.
ALTER TABLE "DogGrandChampionCredit"
  ADD COLUMN "effectiveYear" INTEGER,
  ADD COLUMN "district" INTEGER,
  ADD COLUMN "breedCode2" TEXT,
  ADD COLUMN "sex" "Sex",
  ADD COLUMN "judgeId" TEXT,
  ADD COLUMN "competitionCount" INTEGER,
  ADD COLUMN "bobSameSexComparisonCount" INTEGER,
  ADD COLUMN "qualifyingChampionOpponentCount" INTEGER,
  ADD COLUMN "rulesVersion" TEXT,
  ADD COLUMN "finalizedAtEpoch" INTEGER;

CREATE INDEX "DogGrandChampionCredit_effectiveYear_district_breedCode2_sex_idx"
  ON "DogGrandChampionCredit"("effectiveYear", "district", "breedCode2", "sex");
CREATE INDEX "DogGrandChampionCredit_judgeId_idx"
  ON "DogGrandChampionCredit"("judgeId");
