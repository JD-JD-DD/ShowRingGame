-- FINALIZER-01: a canonical key makes Group/BIS writes conflict-safe when two
-- finalizers overlap. Existing historical finals deliberately retain NULL so
-- this migration neither rewrites nor deletes the audited published rows.
ALTER TABLE "ShowAward" ADD COLUMN "finalizationKey" TEXT;

CREATE UNIQUE INDEX "ShowAward_finalizationKey_key"
  ON "ShowAward"("finalizationKey");

-- NOT VALID preserves historical rows that predate finalizationKey while still
-- enforcing the key for every inserted or updated finals row from this point.
ALTER TABLE "ShowAward"
  ADD CONSTRAINT "ShowAward_finalizationKey_required_for_finals"
  CHECK (
    "awardGroup" NOT IN ('GROUP', 'BEST_IN_SHOW')
    OR "finalizationKey" IS NOT NULL
  ) NOT VALID;
