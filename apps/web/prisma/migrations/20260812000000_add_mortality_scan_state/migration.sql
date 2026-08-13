CREATE TABLE "MortalityScanState" (
    "id" TEXT NOT NULL,
    "cursorDogId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MortalityScanState_pkey" PRIMARY KEY ("id")
);
