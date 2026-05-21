-- CreateTable
CREATE TABLE "ShowAward" (
    "id" TEXT NOT NULL,
    "showResultId" TEXT,
    "showEntryId" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "judgingBlockId" TEXT,
    "dogId" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "awardCode" TEXT NOT NULL,
    "awardGroup" TEXT NOT NULL,
    "sex" "Sex",
    "rank" INTEGER,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "dogsInCompetition" INTEGER,
    "uniqueKennelsInCompetition" INTEGER,
    "publishedAtEpoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowAward_showResultId_idx" ON "ShowAward"("showResultId");

-- CreateIndex
CREATE INDEX "ShowAward_showEntryId_idx" ON "ShowAward"("showEntryId");

-- CreateIndex
CREATE INDEX "ShowAward_showDayId_idx" ON "ShowAward"("showDayId");

-- CreateIndex
CREATE INDEX "ShowAward_judgingBlockId_idx" ON "ShowAward"("judgingBlockId");

-- CreateIndex
CREATE INDEX "ShowAward_dogId_idx" ON "ShowAward"("dogId");

-- CreateIndex
CREATE INDEX "ShowAward_breedCode2_idx" ON "ShowAward"("breedCode2");

-- CreateIndex
CREATE INDEX "ShowAward_judgeId_idx" ON "ShowAward"("judgeId");

-- CreateIndex
CREATE INDEX "ShowAward_awardCode_idx" ON "ShowAward"("awardCode");

-- CreateIndex
CREATE INDEX "ShowAward_pointsAwarded_idx" ON "ShowAward"("pointsAwarded");

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_showResultId_fkey" FOREIGN KEY ("showResultId") REFERENCES "ShowResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_showEntryId_fkey" FOREIGN KEY ("showEntryId") REFERENCES "ShowEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_judgingBlockId_fkey" FOREIGN KEY ("judgingBlockId") REFERENCES "ShowJudgingBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAward" ADD CONSTRAINT "ShowAward_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill awards for any blocks judged before ShowAward existed.
WITH ranked_by_sex AS (
    SELECT
        sr.*,
        d."sex",
        ROW_NUMBER() OVER (
            PARTITION BY sr."judgingBlockId", d."sex"
            ORDER BY sr."finalScore" DESC, sr."finalRank" ASC NULLS LAST
        ) AS "sexRank",
        COUNT(*) OVER (
            PARTITION BY sr."judgingBlockId", d."sex"
        ) AS "sexCount"
    FROM "ShowResult" sr
    INNER JOIN "Dog" d ON d."id" = sr."dogId"
    WHERE sr."judgingBlockId" IS NOT NULL
),
class_awards AS (
    SELECT
        ranked_by_sex.*,
        "sexRank"::TEXT AS "awardCode",
        CASE WHEN "sex" = 'M'::"Sex" THEN 'DOG_CLASS' ELSE 'BITCH_CLASS' END AS "awardGroup",
        "sexRank" AS "awardRank",
        0 AS "awardPoints"
    FROM ranked_by_sex
    WHERE "sexRank" <= 4
),
winners_awards AS (
    SELECT
        ranked_by_sex.*,
        CASE
            WHEN "sex" = 'M'::"Sex" AND "sexRank" = 1 THEN 'WD'
            WHEN "sex" = 'M'::"Sex" AND "sexRank" = 2 THEN 'RWD'
            WHEN "sex" = 'F'::"Sex" AND "sexRank" = 1 THEN 'WB'
            ELSE 'RWB'
        END AS "awardCode",
        'WINNERS' AS "awardGroup",
        "sexRank" AS "awardRank",
        CASE
            WHEN "sexRank" <> 1 THEN 0
            WHEN "sexCount" >= 7 THEN 5
            WHEN "sexCount" >= 6 THEN 4
            WHEN "sexCount" >= 5 THEN 3
            WHEN "sexCount" >= 4 THEN 2
            WHEN "sexCount" >= 3 THEN 1
            ELSE 0
        END AS "awardPoints"
    FROM ranked_by_sex
    WHERE "sexRank" <= 2
),
breed_candidates AS (
    SELECT
        ranked_by_sex.*,
        ROW_NUMBER() OVER (
            PARTITION BY "judgingBlockId"
            ORDER BY "finalScore" DESC, "finalRank" ASC NULLS LAST
        ) AS "breedRank"
    FROM ranked_by_sex
    WHERE "sexRank" = 1
),
breed_awards AS (
    SELECT
        breed_candidates.*,
        CASE WHEN "breedRank" = 1 THEN 'BOB' ELSE 'BOS' END AS "awardCode",
        'BREED' AS "awardGroup",
        "breedRank" AS "awardRank",
        0 AS "awardPoints"
    FROM breed_candidates
    WHERE "breedRank" <= 2
),
all_awards AS (
    SELECT
        "id",
        "showEntryId",
        "showDayId",
        "judgingBlockId",
        "dogId",
        "breedCode2",
        "judgeId",
        "sex",
        "sexCount",
        "uniqueKennelsInCompetition",
        "publishedAtEpoch",
        "awardCode",
        "awardGroup",
        "awardRank",
        "awardPoints"
    FROM class_awards
    UNION ALL
    SELECT
        "id",
        "showEntryId",
        "showDayId",
        "judgingBlockId",
        "dogId",
        "breedCode2",
        "judgeId",
        "sex",
        "sexCount",
        "uniqueKennelsInCompetition",
        "publishedAtEpoch",
        "awardCode",
        "awardGroup",
        "awardRank",
        "awardPoints"
    FROM winners_awards
    UNION ALL
    SELECT
        "id",
        "showEntryId",
        "showDayId",
        "judgingBlockId",
        "dogId",
        "breedCode2",
        "judgeId",
        "sex",
        "sexCount",
        "uniqueKennelsInCompetition",
        "publishedAtEpoch",
        "awardCode",
        "awardGroup",
        "awardRank",
        "awardPoints"
    FROM breed_awards
)
INSERT INTO "ShowAward" (
    "id",
    "showResultId",
    "showEntryId",
    "showDayId",
    "judgingBlockId",
    "dogId",
    "breedCode2",
    "judgeId",
    "awardCode",
    "awardGroup",
    "sex",
    "rank",
    "pointsAwarded",
    "isMajor",
    "dogsInCompetition",
    "uniqueKennelsInCompetition",
    "publishedAtEpoch"
)
SELECT
    'award-' || md5("showEntryId" || '-' || "awardCode" || '-' || COALESCE("judgingBlockId", '')),
    "id",
    "showEntryId",
    "showDayId",
    "judgingBlockId",
    "dogId",
    "breedCode2",
    "judgeId",
    "awardCode",
    "awardGroup",
    CASE WHEN "awardGroup" = 'BREED' THEN NULL ELSE "sex" END,
    "awardRank",
    "awardPoints",
    "awardPoints" >= 3,
    CASE WHEN "awardGroup" = 'BREED' THEN NULL ELSE "sexCount" END,
    "uniqueKennelsInCompetition",
    "publishedAtEpoch"
FROM all_awards;

WITH winner_points AS (
    SELECT
        "showResultId",
        SUM("pointsAwarded") AS "totalPoints"
    FROM "ShowAward"
    WHERE "awardCode" IN ('WD', 'WB')
    GROUP BY "showResultId"
)
UPDATE "ShowResult" sr
SET
    "pointsAwarded" = winner_points."totalPoints",
    "isMajor" = winner_points."totalPoints" >= 3
FROM winner_points
WHERE sr."id" = winner_points."showResultId";
