-- CreateEnum
CREATE TYPE "ShowGroupCode" AS ENUM ('SPORTING', 'HOUND', 'WORKING', 'TERRIER', 'TOY', 'NON_SPORTING', 'HERDING', 'MISCELLANEOUS');

-- CreateTable
CREATE TABLE "ShowDayGroupJudgeAssignment" (
    "id" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "groupCode" "ShowGroupCode" NOT NULL,
    "judgeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowDayGroupJudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowDayGroupJudgeAssignment_showDayId_groupCode_key" ON "ShowDayGroupJudgeAssignment"("showDayId", "groupCode");

-- CreateIndex
CREATE INDEX "ShowDayGroupJudgeAssignment_showDayId_idx" ON "ShowDayGroupJudgeAssignment"("showDayId");

-- CreateIndex
CREATE INDEX "ShowDayGroupJudgeAssignment_judgeId_idx" ON "ShowDayGroupJudgeAssignment"("judgeId");

-- AddForeignKey
ALTER TABLE "ShowDayGroupJudgeAssignment" ADD CONSTRAINT "ShowDayGroupJudgeAssignment_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDayGroupJudgeAssignment" ADD CONSTRAINT "ShowDayGroupJudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
