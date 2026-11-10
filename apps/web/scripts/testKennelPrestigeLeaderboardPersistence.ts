import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
  assertValidKennelPrestigeLeaderboardEntries,
  getCurrentKennelPrestigeLeaderboardState,
  listCurrentKennelPrestigeLeaderboardEntries,
  replaceCurrentKennelPrestigeLeaderboard,
  type KennelPrestigeLeaderboardEntryInput,
} from "../server/services/kennelPrestigeLeaderboard.service";

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

async function main() {
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
  console.log("Kennel prestige leaderboard persistence checks passed.");
}

void main();
