ALTER TABLE "ShowEntry"
ADD COLUMN "enteredKennelId" TEXT,
ADD COLUMN "enteredKennelName" TEXT,
ADD COLUMN "enteredKennelSlug" TEXT;

UPDATE "ShowEntry" AS entry
SET
  "enteredKennelId" = entry."kennelId",
  "enteredKennelName" = kennel."name",
  "enteredKennelSlug" = kennel."slug"
FROM "Kennel" AS kennel
WHERE entry."kennelId" = kennel."id";

CREATE INDEX "ShowEntry_enteredKennelId_idx" ON "ShowEntry"("enteredKennelId");

ALTER TABLE "ShowResult"
ADD COLUMN "enteredKennelId" TEXT,
ADD COLUMN "enteredKennelName" TEXT,
ADD COLUMN "enteredKennelSlug" TEXT;

UPDATE "ShowResult" AS result
SET
  "enteredKennelId" = entry."enteredKennelId",
  "enteredKennelName" = entry."enteredKennelName",
  "enteredKennelSlug" = entry."enteredKennelSlug"
FROM "ShowEntry" AS entry
WHERE result."showEntryId" = entry."id";

CREATE INDEX "ShowResult_enteredKennelId_idx" ON "ShowResult"("enteredKennelId");
