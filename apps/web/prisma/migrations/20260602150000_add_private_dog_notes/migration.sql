CREATE TABLE "KennelDogPrivateNote" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KennelDogPrivateNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KennelDogPrivateNote_kennelId_dogId_key"
ON "KennelDogPrivateNote"("kennelId", "dogId");

CREATE INDEX "KennelDogPrivateNote_dogId_idx"
ON "KennelDogPrivateNote"("dogId");

ALTER TABLE "KennelDogPrivateNote"
ADD CONSTRAINT "KennelDogPrivateNote_kennelId_fkey"
FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KennelDogPrivateNote"
ADD CONSTRAINT "KennelDogPrivateNote_dogId_fkey"
FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
