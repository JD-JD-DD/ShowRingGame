-- CreateEnum
CREATE TYPE "DogConditionEventType" AS ENUM ('GROOMING_GAIN', 'MISSED_GROOMING_DECAY');

-- CreateTable
CREATE TABLE "DogConditionEvent" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "actorKennelId" TEXT,
    "ownerKennelIdAtEvent" TEXT,
    "eventType" "DogConditionEventType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "conditionBefore" DOUBLE PRECISION NOT NULL,
    "conditionAfter" DOUBLE PRECISION NOT NULL,
    "groomingWeek" INTEGER NOT NULL,
    "occurredAtEpoch" INTEGER NOT NULL,
    "decayKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DogConditionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DogConditionEvent_decayKey_key" ON "DogConditionEvent"("decayKey");
CREATE INDEX "DogConditionEvent_dogId_idx" ON "DogConditionEvent"("dogId");
CREATE INDEX "DogConditionEvent_actorKennelId_idx" ON "DogConditionEvent"("actorKennelId");
CREATE INDEX "DogConditionEvent_ownerKennelIdAtEvent_idx" ON "DogConditionEvent"("ownerKennelIdAtEvent");
CREATE INDEX "DogConditionEvent_eventType_idx" ON "DogConditionEvent"("eventType");
CREATE INDEX "DogConditionEvent_groomingWeek_idx" ON "DogConditionEvent"("groomingWeek");

-- AddForeignKey
ALTER TABLE "DogConditionEvent" ADD CONSTRAINT "DogConditionEvent_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DogConditionEvent" ADD CONSTRAINT "DogConditionEvent_actorKennelId_fkey" FOREIGN KEY ("actorKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DogConditionEvent" ADD CONSTRAINT "DogConditionEvent_ownerKennelIdAtEvent_fkey" FOREIGN KEY ("ownerKennelIdAtEvent") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
