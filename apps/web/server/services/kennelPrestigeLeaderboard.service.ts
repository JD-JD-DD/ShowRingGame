import { db } from "@/lib/db";

export const CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID = 1;

export type KennelPrestigeLeaderboardEntryInput = {
  scope: "OVERALL" | "BREED";
  breedCode2: string | null;
  rank: number;
  kennelId: string;
  kennelName: string;
  kennelSlug: string;
  prestigeScore: number;
  tierLabel: string;
  championsBred: number;
  bestInShowWins: number;
};

export type KennelPrestigeLeaderboardPublicationInput = {
  calculatedAt: Date;
  calculatedEpoch: number;
  nextRefreshAt: Date;
  entries: KennelPrestigeLeaderboardEntryInput[];
};

type LeaderboardDatabase = Pick<typeof db, "$transaction">;

function entryKey(entry: KennelPrestigeLeaderboardEntryInput): string {
  return `${entry.scope}:${entry.breedCode2 ?? ""}:${entry.rank}`;
}

export function assertValidKennelPrestigeLeaderboardEntries(
  entries: KennelPrestigeLeaderboardEntryInput[]
): void {
  const keys = new Set<string>();

  for (const entry of entries) {
    if (!Number.isInteger(entry.rank) || entry.rank < 1) {
      throw new Error("Leaderboard ranks must be positive integers.");
    }

    if (entry.scope === "OVERALL" && entry.breedCode2 !== null) {
      throw new Error("Overall leaderboard entries cannot declare a breed.");
    }

    if (entry.scope === "BREED" && !entry.breedCode2) {
      throw new Error("Breed leaderboard entries require a breed code.");
    }

    const key = entryKey(entry);
    if (keys.has(key)) {
      throw new Error("Leaderboard scope, breed, and rank must be unique.");
    }
    keys.add(key);
  }
}

export async function getCurrentKennelPrestigeLeaderboardState(
  client: Pick<typeof db, "kennelPrestigeLeaderboardState"> = db
) {
  return client.kennelPrestigeLeaderboardState.findUnique({
    where: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
  });
}

export async function listCurrentKennelPrestigeLeaderboardEntries(args: {
  scope: "OVERALL" | "BREED";
  breedCode2?: string;
  client?: Pick<typeof db, "kennelPrestigeLeaderboardEntry">;
}) {
  if (args.scope === "BREED" && !args.breedCode2) {
    throw new Error("A breed code is required for breed leaderboard entries.");
  }

  return (args.client ?? db).kennelPrestigeLeaderboardEntry.findMany({
    where: {
      leaderboardStateId: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
      scope: args.scope,
      breedCode2: args.scope === "BREED" ? args.breedCode2 : null,
    },
    orderBy: { rank: "asc" },
  });
}

/**
 * Replaces every current row and advances publication metadata together. A
 * failed transaction leaves the previously published leaderboard untouched.
 */
export async function replaceCurrentKennelPrestigeLeaderboard(args: {
  database?: LeaderboardDatabase;
  publication: KennelPrestigeLeaderboardPublicationInput;
}) {
  assertValidKennelPrestigeLeaderboardEntries(args.publication.entries);
  const database = args.database ?? db;

  return database.$transaction(async (tx) => {
    await tx.kennelPrestigeLeaderboardState.upsert({
      where: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
      create: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
      update: {},
    });

    await tx.kennelPrestigeLeaderboardEntry.deleteMany({
      where: { leaderboardStateId: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
    });

    if (args.publication.entries.length > 0) {
      await tx.kennelPrestigeLeaderboardEntry.createMany({
        data: args.publication.entries.map((entry) => ({
          ...entry,
          leaderboardStateId: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
        })),
      });
    }

    return tx.kennelPrestigeLeaderboardState.update({
      where: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
      data: {
        lastCalculatedAt: args.publication.calculatedAt,
        lastCalculatedEpoch: args.publication.calculatedEpoch,
        nextRefreshAt: args.publication.nextRefreshAt,
        refreshClaimToken: null,
        refreshClaimedAt: null,
        refreshClaimExpiresAt: null,
        lastRefreshFailedAt: null,
        lastRefreshError: null,
      },
    });
  });
}
