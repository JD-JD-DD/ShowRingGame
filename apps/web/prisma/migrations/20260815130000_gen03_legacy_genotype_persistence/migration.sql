-- GEN-03: nullable fields permit the deterministic application backfill while
-- current phenotype-only puppy creation remains unchanged. No Dog rows or
-- existing phenotype/pedigree columns are modified by this migration.
ALTER TABLE "Dog"
  ADD COLUMN "genotype" TEXT,
  ADD COLUMN "geneticsVersion" TEXT;
