CREATE TABLE "KennelShowWeekendPlan" (
  "id" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "weekendKey" TEXT NOT NULL,
  "primaryClusterId" TEXT NOT NULL,
  "travelFeeCharged" INTEGER NOT NULL DEFAULT 0,
  "createdAtEpoch" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KennelShowWeekendPlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KennelShowWeekendPlan"
  ADD CONSTRAINT "KennelShowWeekendPlan_kennelId_fkey"
  FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelShowWeekendPlan"
  ADD CONSTRAINT "KennelShowWeekendPlan_primaryClusterId_fkey"
  FOREIGN KEY ("primaryClusterId") REFERENCES "ShowCluster"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "KennelShowWeekendPlan_kennelId_weekendKey_key"
  ON "KennelShowWeekendPlan"("kennelId", "weekendKey");

CREATE INDEX "KennelShowWeekendPlan_primaryClusterId_idx"
  ON "KennelShowWeekendPlan"("primaryClusterId");

CREATE INDEX "KennelShowWeekendPlan_weekendKey_idx"
  ON "KennelShowWeekendPlan"("weekendKey");
