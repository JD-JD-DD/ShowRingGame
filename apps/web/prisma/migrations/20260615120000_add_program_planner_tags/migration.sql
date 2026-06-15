CREATE TYPE "DogPlannerTagType" AS ENUM (
  'KEEP',
  'WATCH',
  'SELL_CANDIDATE',
  'REHOME_CANDIDATE',
  'NO_ACTION'
);

CREATE TYPE "DogPlannerTagSource" AS ENUM (
  'PROGRAM_PLANNER'
);

CREATE TABLE "DogPlannerTag" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "tagType" "DogPlannerTagType" NOT NULL,
  "source" "DogPlannerTagSource" NOT NULL DEFAULT 'PROGRAM_PLANNER',
  "breedCode2" TEXT NOT NULL,
  "goalKey" TEXT NOT NULL,
  "note" TEXT,
  "isVisibleOnDogPage" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DogPlannerTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DogPlannerTag_kennelId_dogId_source_key" ON "DogPlannerTag"("kennelId", "dogId", "source");
CREATE INDEX "DogPlannerTag_dogId_idx" ON "DogPlannerTag"("dogId");
CREATE INDEX "DogPlannerTag_kennelId_breedCode2_idx" ON "DogPlannerTag"("kennelId", "breedCode2");
CREATE INDEX "DogPlannerTag_tagType_idx" ON "DogPlannerTag"("tagType");

ALTER TABLE "DogPlannerTag" ADD CONSTRAINT "DogPlannerTag_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DogPlannerTag" ADD CONSTRAINT "DogPlannerTag_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
