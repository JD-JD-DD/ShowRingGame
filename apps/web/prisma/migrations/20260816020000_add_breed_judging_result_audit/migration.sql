ALTER TABLE "ShowResult"
  ADD COLUMN "breedJudgingProfileId" TEXT,
  ADD COLUMN "breedJudgingRulesVersion" TEXT,
  ADD COLUMN "breedJudgingAudit" JSONB;

ALTER TABLE "ShowResult"
  ADD CONSTRAINT "ShowResult_breedJudgingProfileId_fkey"
  FOREIGN KEY ("breedJudgingProfileId") REFERENCES "BreedJudgingProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ShowResult_breedJudgingProfileId_idx"
  ON "ShowResult"("breedJudgingProfileId");
