CREATE TABLE "KennelRun" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KennelRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Dog"
ADD COLUMN "kennelRunId" TEXT;

CREATE UNIQUE INDEX "KennelRun_kennelId_name_key"
ON "KennelRun"("kennelId", "name");

CREATE INDEX "KennelRun_kennelId_idx"
ON "KennelRun"("kennelId");

CREATE INDEX "KennelRun_kennelId_sortOrder_idx"
ON "KennelRun"("kennelId", "sortOrder");

CREATE INDEX "Dog_ownerKennelId_kennelRunId_idx"
ON "Dog"("ownerKennelId", "kennelRunId");

CREATE INDEX "Dog_kennelRunId_idx"
ON "Dog"("kennelRunId");

ALTER TABLE "KennelRun"
ADD CONSTRAINT "KennelRun_kennelId_fkey"
FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Dog"
ADD CONSTRAINT "Dog_kennelRunId_fkey"
FOREIGN KEY ("kennelRunId") REFERENCES "KennelRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
