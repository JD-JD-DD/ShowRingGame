CREATE TYPE "DogVisibilityState" AS ENUM ('VISIBLE', 'HIDDEN_NEONATAL_LOSS');

ALTER TABLE "Dog"
  ADD COLUMN "visibilityState" "DogVisibilityState" NOT NULL DEFAULT 'VISIBLE',
  ADD COLUMN "isPlayerVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showInMemoriam" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Dog"
SET
  "visibilityState" = 'HIDDEN_NEONATAL_LOSS',
  "isPlayerVisible" = false,
  "showInMemoriam" = false
WHERE
  "originType" = 'PLAYER_BRED'
  AND "litterId" IS NOT NULL
  AND "lifecycleState" = 'DECEASED'
  AND "deathEpoch" IS NOT NULL
  AND "deathEpoch" - "birthEpoch" < 56;

CREATE INDEX "Dog_visibilityState_idx" ON "Dog"("visibilityState");
CREATE INDEX "Dog_isPlayerVisible_idx" ON "Dog"("isPlayerVisible");
