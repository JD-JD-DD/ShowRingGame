CREATE TYPE "KennelRenameSource" AS ENUM ('SELF_SERVICE', 'ADMIN');

CREATE TABLE "KennelRenameHistory" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "previousName" TEXT NOT NULL,
    "previousSlug" TEXT NOT NULL,
    "newName" TEXT NOT NULL,
    "newSlug" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "KennelRenameSource" NOT NULL,

    CONSTRAINT "KennelRenameHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KennelRenameHistory_kennelId_changedAt_idx" ON "KennelRenameHistory"("kennelId", "changedAt");
CREATE INDEX "KennelRenameHistory_previousSlug_idx" ON "KennelRenameHistory"("previousSlug");
CREATE INDEX "KennelRenameHistory_newSlug_idx" ON "KennelRenameHistory"("newSlug");
CREATE INDEX "KennelRenameHistory_source_idx" ON "KennelRenameHistory"("source");

ALTER TABLE "KennelRenameHistory"
ADD CONSTRAINT "KennelRenameHistory_kennelId_fkey"
FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
