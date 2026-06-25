ALTER TABLE "DogTitleProgress"
ADD COLUMN "grandMajorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "grandChampionDefeatShowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "grandCompletedAtShowDayId" TEXT,
ADD COLUMN "grandCompletedAtEpoch" INTEGER;

CREATE TABLE "DogGrandChampionCredit" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "showAwardId" TEXT,
    "awardCode" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "defeatedChampionCount" INTEGER NOT NULL DEFAULT 0,
    "countsAsChampionDefeat" BOOLEAN NOT NULL DEFAULT false,
    "createdAtEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogGrandChampionCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogGrandChampionCredit_showAwardId_key" ON "DogGrandChampionCredit"("showAwardId");
CREATE UNIQUE INDEX "DogGrandChampionCredit_dogId_showDayId_awardCode_key" ON "DogGrandChampionCredit"("dogId", "showDayId", "awardCode");
CREATE INDEX "DogGrandChampionCredit_dogId_idx" ON "DogGrandChampionCredit"("dogId");
CREATE INDEX "DogGrandChampionCredit_showDayId_idx" ON "DogGrandChampionCredit"("showDayId");
CREATE INDEX "DogGrandChampionCredit_awardCode_idx" ON "DogGrandChampionCredit"("awardCode");
CREATE INDEX "DogGrandChampionCredit_pointsAwarded_idx" ON "DogGrandChampionCredit"("pointsAwarded");
CREATE INDEX "DogGrandChampionCredit_isMajor_idx" ON "DogGrandChampionCredit"("isMajor");
CREATE INDEX "DogGrandChampionCredit_countsAsChampionDefeat_idx" ON "DogGrandChampionCredit"("countsAsChampionDefeat");
CREATE INDEX "DogGrandChampionCredit_dogId_countsAsChampionDefeat_showDayId_idx" ON "DogGrandChampionCredit"("dogId", "countsAsChampionDefeat", "showDayId");
CREATE INDEX "DogGrandChampionCredit_createdAtEpoch_idx" ON "DogGrandChampionCredit"("createdAtEpoch");
CREATE INDEX "DogTitleProgress_grandCompletedAtShowDayId_idx" ON "DogTitleProgress"("grandCompletedAtShowDayId");

ALTER TABLE "DogGrandChampionCredit" ADD CONSTRAINT "DogGrandChampionCredit_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DogGrandChampionCredit" ADD CONSTRAINT "DogGrandChampionCredit_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DogGrandChampionCredit" ADD CONSTRAINT "DogGrandChampionCredit_showAwardId_fkey" FOREIGN KEY ("showAwardId") REFERENCES "ShowAward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DogTitleProgress" ADD CONSTRAINT "DogTitleProgress_grandCompletedAtShowDayId_fkey" FOREIGN KEY ("grandCompletedAtShowDayId") REFERENCES "ShowDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
