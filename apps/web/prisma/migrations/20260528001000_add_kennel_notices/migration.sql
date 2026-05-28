CREATE TYPE "KennelNoticeType" AS ENUM (
  'BULLETIN_REPLY',
  'NEW_CHAMPION',
  'DOG_DEATH',
  'LITTER_BORN',
  'DID_NOT_TAKE',
  'STUD_FEE_RECEIVED',
  'DOG_SOLD'
);

CREATE TABLE "KennelNotice" (
  "id" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "type" "KennelNoticeType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "createdAtEpoch" INTEGER NOT NULL,
  "readAtEpoch" INTEGER,
  "dismissedAtEpoch" INTEGER,
  "linkedDogId" TEXT,
  "linkedLitterId" TEXT,
  "linkedShowId" TEXT,
  "linkedThreadId" TEXT,
  "linkedListingId" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KennelNotice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "KennelNotice"
  ADD CONSTRAINT "KennelNotice_kennelId_fkey"
  FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "KennelNotice_kennelId_idx" ON "KennelNotice"("kennelId");
CREATE INDEX "KennelNotice_type_idx" ON "KennelNotice"("type");
CREATE INDEX "KennelNotice_createdAtEpoch_idx" ON "KennelNotice"("createdAtEpoch");
CREATE INDEX "KennelNotice_readAtEpoch_idx" ON "KennelNotice"("readAtEpoch");
CREATE INDEX "KennelNotice_dismissedAtEpoch_idx" ON "KennelNotice"("dismissedAtEpoch");
CREATE INDEX "KennelNotice_linkedDogId_idx" ON "KennelNotice"("linkedDogId");
CREATE INDEX "KennelNotice_linkedLitterId_idx" ON "KennelNotice"("linkedLitterId");
CREATE INDEX "KennelNotice_linkedShowId_idx" ON "KennelNotice"("linkedShowId");
CREATE INDEX "KennelNotice_linkedThreadId_idx" ON "KennelNotice"("linkedThreadId");
CREATE INDEX "KennelNotice_linkedListingId_idx" ON "KennelNotice"("linkedListingId");
