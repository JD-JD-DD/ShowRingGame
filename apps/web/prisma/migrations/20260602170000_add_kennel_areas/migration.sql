CREATE TABLE "KennelArea" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KennelArea_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KennelAreaDog" (
    "id" TEXT NOT NULL,
    "kennelAreaId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KennelAreaDog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KennelArea_kennelId_name_key"
ON "KennelArea"("kennelId", "name");

CREATE INDEX "KennelArea_kennelId_sortOrder_idx"
ON "KennelArea"("kennelId", "sortOrder");

CREATE UNIQUE INDEX "KennelAreaDog_kennelAreaId_dogId_key"
ON "KennelAreaDog"("kennelAreaId", "dogId");

CREATE INDEX "KennelAreaDog_dogId_idx"
ON "KennelAreaDog"("dogId");

ALTER TABLE "KennelArea"
ADD CONSTRAINT "KennelArea_kennelId_fkey"
FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KennelAreaDog"
ADD CONSTRAINT "KennelAreaDog_kennelAreaId_fkey"
FOREIGN KEY ("kennelAreaId") REFERENCES "KennelArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KennelAreaDog"
ADD CONSTRAINT "KennelAreaDog_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
