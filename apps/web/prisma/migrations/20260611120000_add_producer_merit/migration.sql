CREATE TYPE "ProducerMeritLevel" AS ENUM (
  'NONE',
  'MERIT',
  'EXCELLENT',
  'ELITE',
  'LEGACY'
);

ALTER TABLE "Dog"
  ADD COLUMN "championOffspringCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "producerMeritLevel" "ProducerMeritLevel" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "producerMeritSuffix" TEXT,
  ADD COLUMN "producerMeritLabel" TEXT;

CREATE INDEX "Dog_producerMeritLevel_idx" ON "Dog"("producerMeritLevel");

WITH champion_offspring_counts AS (
  SELECT
    parent_ids."parentId",
    COUNT(DISTINCT offspring."id")::INTEGER AS "championOffspringCount"
  FROM "Dog" offspring
  INNER JOIN "DogTitleProgress" progress
    ON progress."dogId" = offspring."id"
    AND progress."currentTitleCode" = 'CH'
  CROSS JOIN LATERAL (
    VALUES (offspring."sireId"), (offspring."damId")
  ) AS parent_ids("parentId")
  WHERE parent_ids."parentId" IS NOT NULL
  GROUP BY parent_ids."parentId"
),
derived_merit AS (
  SELECT
    dog."id",
    counts."championOffspringCount",
    CASE
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 50 ELSE 25 END THEN 'LEGACY'::"ProducerMeritLevel"
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 35 ELSE 15 END THEN 'ELITE'::"ProducerMeritLevel"
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 20 ELSE 10 END THEN 'EXCELLENT'::"ProducerMeritLevel"
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 10 ELSE 5 END THEN 'MERIT'::"ProducerMeritLevel"
      ELSE 'NONE'::"ProducerMeritLevel"
    END AS "producerMeritLevel",
    CASE
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 50 ELSE 25 END THEN 'LEGACY'
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 35 ELSE 15 END THEN CASE WHEN dog."sex" = 'M' THEN 'SOMXX' ELSE 'DOMXX' END
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 20 ELSE 10 END THEN CASE WHEN dog."sex" = 'M' THEN 'SOMX' ELSE 'DOMX' END
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 10 ELSE 5 END THEN CASE WHEN dog."sex" = 'M' THEN 'SOM' ELSE 'DOM' END
      ELSE NULL
    END AS "producerMeritSuffix",
    CASE
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 50 ELSE 25 END THEN 'Legacy Producer'
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 35 ELSE 15 END THEN 'Elite Producer'
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 20 ELSE 10 END THEN 'Excellent Producer'
      WHEN counts."championOffspringCount" >= CASE WHEN dog."sex" = 'M' THEN 10 ELSE 5 END THEN CASE WHEN dog."sex" = 'M' THEN 'Sire of Merit' ELSE 'Dam of Merit' END
      ELSE NULL
    END AS "producerMeritLabel"
  FROM "Dog" dog
  INNER JOIN champion_offspring_counts counts ON counts."parentId" = dog."id"
)
UPDATE "Dog" dog
SET
  "championOffspringCount" = derived."championOffspringCount",
  "producerMeritLevel" = derived."producerMeritLevel",
  "producerMeritSuffix" = derived."producerMeritSuffix",
  "producerMeritLabel" = derived."producerMeritLabel",
  "visibleTitleSuffix" = CASE
    WHEN derived."producerMeritSuffix" IS NULL THEN dog."visibleTitleSuffix"
    WHEN NULLIF(BTRIM(dog."visibleTitleSuffix"), '') IS NULL THEN derived."producerMeritSuffix"
    ELSE CONCAT_WS(' ', dog."visibleTitleSuffix", derived."producerMeritSuffix")
  END
FROM derived_merit derived
WHERE dog."id" = derived."id";
