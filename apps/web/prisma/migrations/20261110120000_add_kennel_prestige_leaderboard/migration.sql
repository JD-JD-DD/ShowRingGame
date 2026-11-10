CREATE TYPE "KennelPrestigeLeaderboardScope" AS ENUM ('OVERALL', 'BREED');

CREATE TABLE "KennelPrestigeLeaderboardState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastCalculatedAt" TIMESTAMP(3),
    "lastCalculatedEpoch" INTEGER,
    "nextRefreshAt" TIMESTAMP(3),
    "refreshClaimToken" TEXT,
    "refreshClaimedAt" TIMESTAMP(3),
    "refreshClaimExpiresAt" TIMESTAMP(3),
    "lastRefreshFailedAt" TIMESTAMP(3),
    "lastRefreshError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KennelPrestigeLeaderboardState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KennelPrestigeLeaderboardState_singleton_check" CHECK ("id" = 1)
);

CREATE TABLE "KennelPrestigeLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "leaderboardStateId" INTEGER NOT NULL,
    "scope" "KennelPrestigeLeaderboardScope" NOT NULL,
    "breedCode2" TEXT,
    "rank" INTEGER NOT NULL,
    "kennelId" TEXT NOT NULL,
    "kennelName" TEXT NOT NULL,
    "kennelSlug" TEXT NOT NULL,
    "prestigeScore" INTEGER NOT NULL,
    "tierLabel" TEXT NOT NULL,
    "championsBred" INTEGER NOT NULL,
    "bestInShowWins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KennelPrestigeLeaderboardEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KennelPrestigeLeaderboardEntry_scope_breed_check"
      CHECK (("scope" = 'OVERALL' AND "breedCode2" IS NULL) OR ("scope" = 'BREED' AND "breedCode2" IS NOT NULL)),
    CONSTRAINT "KennelPrestigeLeaderboardEntry_rank_check" CHECK ("rank" > 0)
);

CREATE INDEX "KennelPrestigeLeaderboardEntry_leaderboardStateId_scope_breedCode2_rank_idx"
  ON "KennelPrestigeLeaderboardEntry"("leaderboardStateId", "scope", "breedCode2", "rank");

CREATE INDEX "KennelPrestigeLeaderboardEntry_kennelId_idx"
  ON "KennelPrestigeLeaderboardEntry"("kennelId");

CREATE UNIQUE INDEX "KennelPrestigeLeaderboardEntry_overall_rank_key"
  ON "KennelPrestigeLeaderboardEntry"("leaderboardStateId", "rank")
  WHERE "scope" = 'OVERALL';

CREATE UNIQUE INDEX "KennelPrestigeLeaderboardEntry_breed_rank_key"
  ON "KennelPrestigeLeaderboardEntry"("leaderboardStateId", "breedCode2", "rank")
  WHERE "scope" = 'BREED';

ALTER TABLE "KennelPrestigeLeaderboardEntry"
  ADD CONSTRAINT "KennelPrestigeLeaderboardEntry_leaderboardStateId_fkey"
  FOREIGN KEY ("leaderboardStateId") REFERENCES "KennelPrestigeLeaderboardState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KennelPrestigeLeaderboardEntry"
  ADD CONSTRAINT "KennelPrestigeLeaderboardEntry_breedCode2_fkey"
  FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelPrestigeLeaderboardEntry"
  ADD CONSTRAINT "KennelPrestigeLeaderboardEntry_kennelId_fkey"
  FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
