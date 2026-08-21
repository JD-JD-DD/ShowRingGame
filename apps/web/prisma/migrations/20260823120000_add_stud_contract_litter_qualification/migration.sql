ALTER TABLE "StudContract"
  ADD COLUMN "litterId" TEXT,
  ADD COLUMN "qualificationCheckpointAt" TIMESTAMP(3),
  ADD COLUMN "qualifyingSurvivingPuppyCount" INTEGER,
  ADD COLUMN "puppyBackMinimumMet" BOOLEAN,
  ADD COLUMN "smallLitterReturnServiceMet" BOOLEAN;

CREATE UNIQUE INDEX "StudContract_litterId_key" ON "StudContract"("litterId");

ALTER TABLE "StudContract"
  ADD CONSTRAINT "StudContract_litterId_fkey"
  FOREIGN KEY ("litterId") REFERENCES "Litter"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
