-- Establish canonical run semantics without inferring historical litter provenance.
CREATE TYPE "KennelRunKind" AS ENUM ('UNCATEGORIZED', 'PLAYER', 'LITTER');

ALTER TABLE "KennelRun"
ADD COLUMN "kind" "KennelRunKind",
ADD COLUMN "sourceLitterId" TEXT;

UPDATE "KennelRun"
SET "kind" = CASE
  WHEN "isSystem" THEN 'UNCATEGORIZED'::"KennelRunKind"
  ELSE 'PLAYER'::"KennelRunKind"
END;

ALTER TABLE "KennelRun"
ALTER COLUMN "kind" SET NOT NULL,
ADD CONSTRAINT "KennelRun_sourceLitterId_fkey"
  FOREIGN KEY ("sourceLitterId") REFERENCES "Litter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "KennelRun_sourceLitterId_key"
ON "KennelRun"("sourceLitterId");
