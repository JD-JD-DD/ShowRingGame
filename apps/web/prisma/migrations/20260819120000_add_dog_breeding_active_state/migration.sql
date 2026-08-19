-- Owner-controlled breeding participation. Existing and newly created dogs default active.
ALTER TABLE "Dog" ADD COLUMN "isBreedingActive" BOOLEAN NOT NULL DEFAULT true;
