-- CreateTable
CREATE TABLE "DogShowPrestigeCredit" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "gameYear" INTEGER NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "breedDogsBeaten" INTEGER NOT NULL DEFAULT 0,
    "allBreedDogsBeaten" INTEGER NOT NULL DEFAULT 0,
    "breedWinCount" INTEGER NOT NULL DEFAULT 0,
    "groupWinCount" INTEGER NOT NULL DEFAULT 0,
    "bestInShowWinCount" INTEGER NOT NULL DEFAULT 0,
    "reserveBisCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAtEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogShowPrestigeCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogYearlyPrestigeStat" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "gameYear" INTEGER NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "breedDogsBeaten" INTEGER NOT NULL DEFAULT 0,
    "allBreedDogsBeaten" INTEGER NOT NULL DEFAULT 0,
    "breedWinCount" INTEGER NOT NULL DEFAULT 0,
    "groupWinCount" INTEGER NOT NULL DEFAULT 0,
    "bestInShowWinCount" INTEGER NOT NULL DEFAULT 0,
    "reserveBisCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAtEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogYearlyPrestigeStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DogShowPrestigeCredit_dogId_showDayId_key" ON "DogShowPrestigeCredit"("dogId", "showDayId");

-- CreateIndex
CREATE INDEX "DogShowPrestigeCredit_showDayId_idx" ON "DogShowPrestigeCredit"("showDayId");

-- CreateIndex
CREATE INDEX "DogShowPrestigeCredit_gameYear_idx" ON "DogShowPrestigeCredit"("gameYear");

-- CreateIndex
CREATE INDEX "DogShowPrestigeCredit_breedCode2_idx" ON "DogShowPrestigeCredit"("breedCode2");

-- CreateIndex
CREATE INDEX "DogShowPrestigeCredit_breedDogsBeaten_idx" ON "DogShowPrestigeCredit"("breedDogsBeaten");

-- CreateIndex
CREATE INDEX "DogShowPrestigeCredit_allBreedDogsBeaten_idx" ON "DogShowPrestigeCredit"("allBreedDogsBeaten");

-- CreateIndex
CREATE UNIQUE INDEX "DogYearlyPrestigeStat_dogId_gameYear_key" ON "DogYearlyPrestigeStat"("dogId", "gameYear");

-- CreateIndex
CREATE INDEX "DogYearlyPrestigeStat_gameYear_idx" ON "DogYearlyPrestigeStat"("gameYear");

-- CreateIndex
CREATE INDEX "DogYearlyPrestigeStat_breedCode2_idx" ON "DogYearlyPrestigeStat"("breedCode2");

-- CreateIndex
CREATE INDEX "DogYearlyPrestigeStat_breedDogsBeaten_idx" ON "DogYearlyPrestigeStat"("breedDogsBeaten");

-- CreateIndex
CREATE INDEX "DogYearlyPrestigeStat_allBreedDogsBeaten_idx" ON "DogYearlyPrestigeStat"("allBreedDogsBeaten");

-- AddForeignKey
ALTER TABLE "DogShowPrestigeCredit" ADD CONSTRAINT "DogShowPrestigeCredit_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogShowPrestigeCredit" ADD CONSTRAINT "DogShowPrestigeCredit_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogYearlyPrestigeStat" ADD CONSTRAINT "DogYearlyPrestigeStat_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
