CREATE TYPE "StudContractPuppySelectionStatus" AS ENUM (
  'WAITING',
  'DAM_FIRST_PICK',
  'STUD_PICK',
  'SELECTED',
  'FORFEITED',
  'UNFULFILLABLE',
  'COMPLETED'
);

CREATE TYPE "StudContractPuppySelectionActor" AS ENUM (
  'NONE',
  'DAM_OWNER',
  'STUD_OWNER'
);

CREATE TABLE "StudContractPuppySelection" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "litterId" TEXT NOT NULL,
  "status" "StudContractPuppySelectionStatus" NOT NULL DEFAULT 'WAITING',
  "currentActor" "StudContractPuppySelectionActor" NOT NULL DEFAULT 'NONE',
  "turnStartedAt" TIMESTAMP(3),
  "turnDeadlineAt" TIMESTAMP(3),
  "damFirstPickDogId" TEXT,
  "selectedDogId" TEXT,
  "damFirstPickForfeitedAt" TIMESTAMP(3),
  "studSelectionForfeitedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudContractPuppySelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudContractPuppySelection_contractId_key" ON "StudContractPuppySelection"("contractId");
CREATE UNIQUE INDEX "StudContractPuppySelection_litterId_key" ON "StudContractPuppySelection"("litterId");
CREATE UNIQUE INDEX "StudContractPuppySelection_damFirstPickDogId_key" ON "StudContractPuppySelection"("damFirstPickDogId");
CREATE UNIQUE INDEX "StudContractPuppySelection_selectedDogId_key" ON "StudContractPuppySelection"("selectedDogId");

ALTER TABLE "StudContractPuppySelection"
  ADD CONSTRAINT "StudContractPuppySelection_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "StudContract"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StudContractPuppySelection_litterId_fkey"
  FOREIGN KEY ("litterId") REFERENCES "Litter"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StudContractPuppySelection_damFirstPickDogId_fkey"
  FOREIGN KEY ("damFirstPickDogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "StudContractPuppySelection_selectedDogId_fkey"
  FOREIGN KEY ("selectedDogId") REFERENCES "Dog"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
