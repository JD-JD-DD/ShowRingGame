-- CreateEnum
CREATE TYPE "ShowJudgingBlockStatus" AS ENUM ('SCHEDULED', 'ENTRY_OPEN', 'ENTRY_LOCKED', 'JUDGING', 'RESULTS_PUBLISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShowJudgingBlock" (
    "id" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "ringNumber" INTEGER NOT NULL,
    "ringName" TEXT,
    "startEpoch" INTEGER NOT NULL,
    "classType" TEXT NOT NULL DEFAULT 'REGULAR',
    "blockOrder" INTEGER NOT NULL,
    "entryCountHint" INTEGER,
    "status" "ShowJudgingBlockStatus" NOT NULL DEFAULT 'SCHEDULED',
    "publishedAtEpoch" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShowJudgingBlock_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ShowEntry" ADD COLUMN "judgingBlockId" TEXT;

-- AlterTable
ALTER TABLE "ShowResult" ADD COLUMN "judgingBlockId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ShowJudgingBlock_showDayId_ringNumber_blockOrder_key" ON "ShowJudgingBlock"("showDayId", "ringNumber", "blockOrder");

-- CreateIndex
CREATE INDEX "ShowJudgingBlock_showDayId_idx" ON "ShowJudgingBlock"("showDayId");

-- CreateIndex
CREATE INDEX "ShowJudgingBlock_judgeId_idx" ON "ShowJudgingBlock"("judgeId");

-- CreateIndex
CREATE INDEX "ShowJudgingBlock_breedCode2_idx" ON "ShowJudgingBlock"("breedCode2");

-- CreateIndex
CREATE INDEX "ShowJudgingBlock_startEpoch_idx" ON "ShowJudgingBlock"("startEpoch");

-- CreateIndex
CREATE INDEX "ShowJudgingBlock_status_idx" ON "ShowJudgingBlock"("status");

-- CreateIndex
CREATE INDEX "ShowEntry_judgingBlockId_idx" ON "ShowEntry"("judgingBlockId");

-- CreateIndex
CREATE INDEX "ShowResult_judgingBlockId_idx" ON "ShowResult"("judgingBlockId");

-- AddForeignKey
ALTER TABLE "ShowJudgingBlock" ADD CONSTRAINT "ShowJudgingBlock_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowJudgingBlock" ADD CONSTRAINT "ShowJudgingBlock_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowJudgingBlock" ADD CONSTRAINT "ShowJudgingBlock_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowEntry" ADD CONSTRAINT "ShowEntry_judgingBlockId_fkey" FOREIGN KEY ("judgingBlockId") REFERENCES "ShowJudgingBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_judgingBlockId_fkey" FOREIGN KEY ("judgingBlockId") REFERENCES "ShowJudgingBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
