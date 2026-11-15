import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
  assertValidKennelPrestigeLeaderboardEntries,
  getCurrentKennelPrestigeLeaderboardState,
  listCurrentKennelPrestigeLeaderboardEntries,
  publishCurrentOverallKennelPrestigeLeaderboard,
  replaceCurrentKennelPrestigeLeaderboard,
  type KennelPrestigeLeaderboardEntryInput,
} from "../server/services/kennelPrestigeLeaderboard.service";
import type { KennelPrestigeLeaderboardRow } from "../server/services/kennelPrestige.service";

type State = {
  id: number;
  lastCalculatedAt: Date | null;
  lastCalculatedEpoch: number | null;
  nextRefreshAt: Date | null;
  refreshClaimToken: string | null;
  refreshClaimedAt: Date | null;
  refreshClaimExpiresAt: Date | null;
  lastRefreshFailedAt: Date | null;
  lastRefreshError: string | null;
};

type Entry = KennelPrestigeLeaderboardEntryInput & {
  leaderboardStateId: number;
};

function entry(
  overrides: Partial<KennelPrestigeLeaderboardEntryInput> = {}
): KennelPrestigeLeaderboardEntryInput {
  return {
    scope: "OVERALL",
    breedCode2: null,
    rank: 1,
    kennelId: "kennel-one",
    kennelName: "First Kennel",
    kennelSlug: "first-kennel",
    prestigeScore: 500,
    tierLabel: "Established Kennel",
    championsBred: 2,
    bestInShowWins: 1,
    ...overrides,
  };
}

function fixtureDatabase() {
  let state: State | null = null;
  let entries: Entry[] = [];
  let failCreateMany = false;

  const createClient = () => ({
    kennelPrestigeLeaderboardState: {
      findUnique: async () => state,
      upsert: async () => {
        state ??= {
          id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
          lastCalculatedAt: null,
          lastCalculatedEpoch: null,
          nextRefreshAt: null,
          refreshClaimToken: "active-claim",
          refreshClaimedAt: new Date("2026-11-10T00:00:00.000Z"),
          refreshClaimExpiresAt: new Date("2026-11-10T01:00:00.000Z"),
          lastRefreshFailedAt: new Date("2026-11-09T00:00:00.000Z"),
          lastRefreshError: "previous failure",
        };
        return state;
      },
      update: async ({ data }: { data: Partial<State> }) => {
        state = { ...(state as State), ...data };
        return state;
      },
    },
    kennelPrestigeLeaderboardEntry: {
      findMany: async ({
        where,
      }: {
        where: { scope: string; breedCode2: string | null };
      }) =>
        entries
          .filter(
            (candidate) =>
              candidate.scope === where.scope &&
              candidate.breedCode2 === where.breedCode2
          )
          .sort((left, right) => left.rank - right.rank),
      deleteMany: async () => {
        entries = [];
      },
      createMany: async ({ data }: { data: Entry[] }) => {
        if (failCreateMany) throw new Error("controlled entry write failure");
        entries = data.map((candidate) => ({ ...candidate }));
      },
    },
  });

  return {
    database: {
      $transaction: async (
        action: (client: ReturnType<typeof createClient>) => Promise<unknown>
      ) => {
        const stateBefore = state ? { ...state } : null;
        const entriesBefore = entries.map((candidate) => ({ ...candidate }));
        try {
          return await action(createClient());
        } catch (error) {
          state = stateBefore;
          entries = entriesBefore;
          throw error;
        }
      },
    },
    client: createClient(),
    setFailCreateMany: (value: boolean) => {
      failCreateMany = value;
    },
    entries: () => entries,
  };
}

function canonicalRow(
  overrides: Partial<KennelPrestigeLeaderboardRow> = {}
): KennelPrestigeLeaderboardRow {
  return {
    rank: 1,
    kennel: {
      id: "canonical-kennel-one",
      name: "Canonical First Kennel",
      slug: "canonical-first-kennel",
    },
    prestige: {
      score: 725,
      tier: {
        label: "Established Kennel",
        nextLabel: "Respected Kennel",
        nextScore: 750,
      },
      currentYear: 12,
      categories: {
        breeding: 300,
        show: 225,
        legacy: 100,
        care: 100,
      },
      metrics: {
        championsBred: 2,
        championProducingLitters: 1,
        championsFinishedOwnerHandled: 1,
        championsFinishedWithHandler: 1,
        grandChampionsCompletedOwnerHandled: 0,
        grandChampionsCompletedWithHandler: 0,
        grandChampionsCompletedHandlingUnknown: 0,
        grandChampionMilestoneTitles: 0,
        grandChampionMilestonePrestige: 0,
        allGreenChampionsBred: 1,
        currentBreedTopTenOwned: 0,
        currentBreedTopTenBred: 0,
        currentAllBreedTopTenOwned: 1,
        currentAllBreedTopTenBred: 1,
        currentBreedNumberOnes: 0,
        currentAllBreedNumberOnes: 0,
        bestInShowWins: 1,
        reserveBestInShowWins: 0,
        groupOneWins: 1,
        groupPlacements: 2,
      },
    },
    ...overrides,
  };
}

async function main() {
  const leaderboardPublicationService = readFileSync(
    join(
      process.cwd(),
      "server",
      "services",
      "kennelPrestigeLeaderboard.service.ts"
    ),
    "utf8"
  );
  const migrationSql = readFileSync(
    join(
      process.cwd(),
      "prisma",
      "migrations",
      "20261110120000_add_kennel_prestige_leaderboard",
      "migration.sql"
    ),
    "utf8"
  );
  assert.match(migrationSql, /CREATE TABLE "KennelPrestigeLeaderboardState"/);
  assert.match(migrationSql, /CHECK \("id" = 1\)/);
  assert.match(migrationSql, /CREATE TABLE "KennelPrestigeLeaderboardEntry"/);
  assert.match(migrationSql, /"scope" = 'OVERALL' AND "breedCode2" IS NULL/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "KennelPrestigeLeaderboardEntry_overall_rank_key"/);
  assert.match(migrationSql, /CREATE UNIQUE INDEX "KennelPrestigeLeaderboardEntry_breed_rank_key"/);
  assert.doesNotMatch(
    leaderboardPublicationService,
    /kennelPrestigeSourcePartition|calculateKennelPrestigeSummariesFromLoadedData/,
    "Overall publication does not use unfinished all-scopes scaffolding"
  );

  const fixture = fixtureDatabase();
  const firstPublication = {
    calculatedAt: new Date("2026-11-10T07:00:00.000Z"),
    calculatedEpoch: 7520,
    nextRefreshAt: new Date("2026-11-10T14:00:00.000Z"),
    entries: [
      entry(),
      entry({
        scope: "BREED",
        breedCode2: "GR",
        rank: 1,
        kennelId: "kennel-two",
        kennelName: "Golden Kennel",
        kennelSlug: "golden-kennel",
      }),
    ],
  };

  await replaceCurrentKennelPrestigeLeaderboard({
    database: fixture.database as never,
    publication: firstPublication,
  });
  assert.equal(
    (await getCurrentKennelPrestigeLeaderboardState(fixture.client as never))
      ?.lastCalculatedEpoch,
    7520
  );
  assert.equal(
    (
      await listCurrentKennelPrestigeLeaderboardEntries({
        scope: "OVERALL",
        client: fixture.client as never,
      })
    ).length,
    1
  );
  assert.equal(
    (
      await listCurrentKennelPrestigeLeaderboardEntries({
        scope: "BREED",
        breedCode2: "GR",
        client: fixture.client as never,
      })
    )[0]?.kennelSlug,
    "golden-kennel"
  );

  await replaceCurrentKennelPrestigeLeaderboard({
    database: fixture.database as never,
    publication: {
      ...firstPublication,
      calculatedEpoch: 7527,
      nextRefreshAt: new Date("2026-11-10T21:00:00.000Z"),
      entries: [
        entry({
          kennelId: "kennel-three",
          kennelName: "Replacement Kennel",
          kennelSlug: "replacement-kennel",
          prestigeScore: 900,
        }),
      ],
    },
  });
  assert.equal(
    fixture.entries().length,
    1,
    "successful replacement retains no historical entry set"
  );
  assert.equal(
    fixture.entries()[0]?.kennelId,
    "kennel-three",
    "successful replacement replaces the current standings"
  );

  fixture.setFailCreateMany(true);
  await assert.rejects(
    () =>
      replaceCurrentKennelPrestigeLeaderboard({
        database: fixture.database as never,
        publication: {
          ...firstPublication,
          calculatedEpoch: 7534,
          entries: [entry({ kennelId: "failed-kennel" })],
        },
      }),
    /controlled entry write failure/
  );
  assert.equal(
    fixture.entries()[0]?.kennelId,
    "kennel-three",
    "failed replacement preserves prior standings"
  );
  assert.equal(
    (await getCurrentKennelPrestigeLeaderboardState(fixture.client as never))
      ?.lastCalculatedEpoch,
    7527,
    "failed replacement does not advance scheduling metadata"
  );

  assert.doesNotThrow(
    () => assertValidKennelPrestigeLeaderboardEntries([]),
    "empty ranking scopes are valid"
  );
  assert.throws(
    () => assertValidKennelPrestigeLeaderboardEntries([entry(), entry()]),
    /must be unique/
  );
  assert.throws(
    () =>
      assertValidKennelPrestigeLeaderboardEntries([
        entry({ scope: "OVERALL", breedCode2: "GR" }),
      ]),
    /cannot declare a breed/
  );
  assert.throws(
    () =>
      assertValidKennelPrestigeLeaderboardEntries([
        entry({ scope: "BREED", breedCode2: null }),
      ]),
    /require a breed code/
  );

  const publicationFixture = fixtureDatabase();
  await replaceCurrentKennelPrestigeLeaderboard({
    database: publicationFixture.database as never,
    publication: firstPublication,
  });
  const canonicalRows = [
    canonicalRow({ rank: 4 }),
    canonicalRow({
      rank: 7,
      kennel: {
        id: "canonical-kennel-two",
        name: "Canonical Second Kennel",
        slug: "canonical-second-kennel",
      },
      prestige: {
        ...canonicalRow().prestige,
        score: 650,
        tier: { label: "Rising Kennel", nextLabel: "Established Kennel", nextScore: 300 },
        metrics: {
          ...canonicalRow().prestige.metrics,
          championsBred: 3,
          bestInShowWins: 2,
        },
      },
    }),
  ];
  let canonicalCalls = 0;
  const calculatedAt = new Date("2026-11-15T12:00:00.000Z");
  await publishCurrentOverallKennelPrestigeLeaderboard({
    database: publicationFixture.database as never,
    calculateLeaderboard: async (args) => {
      canonicalCalls += 1;
      assert.deepEqual(args, { take: 10 });
      return canonicalRows;
    },
    currentEpoch: () => 8123,
    now: () => calculatedAt,
  });
  assert.equal(canonicalCalls, 1, "publication invokes the canonical leaderboard once");
  assert.deepEqual(
    publicationFixture.entries().map((candidate) => ({
      scope: candidate.scope,
      breedCode2: candidate.breedCode2,
      rank: candidate.rank,
      kennelId: candidate.kennelId,
      kennelName: candidate.kennelName,
      kennelSlug: candidate.kennelSlug,
      prestigeScore: candidate.prestigeScore,
      tierLabel: candidate.tierLabel,
      championsBred: candidate.championsBred,
      bestInShowWins: candidate.bestInShowWins,
    })),
    [
      {
        scope: "OVERALL",
        breedCode2: null,
        rank: 4,
        kennelId: "canonical-kennel-one",
        kennelName: "Canonical First Kennel",
        kennelSlug: "canonical-first-kennel",
        prestigeScore: 725,
        tierLabel: "Established Kennel",
        championsBred: 2,
        bestInShowWins: 1,
      },
      {
        scope: "OVERALL",
        breedCode2: null,
        rank: 7,
        kennelId: "canonical-kennel-two",
        kennelName: "Canonical Second Kennel",
        kennelSlug: "canonical-second-kennel",
        prestigeScore: 650,
        tierLabel: "Rising Kennel",
        championsBred: 3,
        bestInShowWins: 2,
      },
    ],
    "publication preserves canonical order, ranks, identities, scores, tiers, and displayed metrics"
  );
  assert.equal(
    (await getCurrentKennelPrestigeLeaderboardState(publicationFixture.client as never))
      ?.lastCalculatedEpoch,
    8123,
    "publication records the canonical game epoch"
  );
  assert.deepEqual(
    (await getCurrentKennelPrestigeLeaderboardState(publicationFixture.client as never))
      ?.lastCalculatedAt,
    calculatedAt,
    "publication records the successful calculation timestamp"
  );
  assert.deepEqual(
    (await getCurrentKennelPrestigeLeaderboardState(publicationFixture.client as never))
      ?.nextRefreshAt,
    new Date("2026-11-15T19:00:00.000Z"),
    "publication sets the seven-real-hour next refresh"
  );

  const beforeFailedCalculation = publicationFixture.entries();
  await assert.rejects(
    () =>
      publishCurrentOverallKennelPrestigeLeaderboard({
        database: publicationFixture.database as never,
        calculateLeaderboard: async () => {
          throw new Error("controlled calculation failure");
        },
      }),
    /controlled calculation failure/
  );
  assert.deepEqual(
    publicationFixture.entries(),
    beforeFailedCalculation,
    "a failed calculation does not start a replacement"
  );

  await assert.rejects(
    () =>
      publishCurrentOverallKennelPrestigeLeaderboard({
        database: publicationFixture.database as never,
        calculateLeaderboard: async () => [
          canonicalRow({ rank: 1 }),
          canonicalRow({ rank: 1 }),
        ],
      }),
    /must be unique/
  );
  assert.deepEqual(
    publicationFixture.entries(),
    beforeFailedCalculation,
    "invalid mapped entries do not start a replacement"
  );

  publicationFixture.setFailCreateMany(true);
  await assert.rejects(
    () =>
      publishCurrentOverallKennelPrestigeLeaderboard({
        database: publicationFixture.database as never,
        calculateLeaderboard: async () => canonicalRows,
        currentEpoch: () => 8130,
        now: () => calculatedAt,
      }),
    /controlled entry write failure/
  );
  assert.deepEqual(
    publicationFixture.entries(),
    beforeFailedCalculation,
    "a failed atomic replacement preserves the previous publication"
  );
  console.log("Kennel prestige leaderboard persistence checks passed.");
}

void main();
