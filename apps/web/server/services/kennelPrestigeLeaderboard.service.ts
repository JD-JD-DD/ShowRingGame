import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer } from "@/lib/perf";
import {
  getKennelPrestigeLeaderboard,
  type KennelPrestigeLeaderboardRow,
} from "@/server/services/kennelPrestige.service";

export const CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID = 1;
const OVERALL_LEADERBOARD_REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;
const OVERALL_LEADERBOARD_REFRESH_LEASE_MS = 10 * 60 * 1000;

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
type LeaderboardStateClient = Pick<typeof db, "kennelPrestigeLeaderboardState">;

export type OverallKennelPrestigeLeaderboardRefreshResult =
  | { outcome: "published" }
  | { outcome: "not_due" }
  | { outcome: "running" }
  | { outcome: "claim_lost" }
  | { outcome: "failed" };

class KennelPrestigeLeaderboardClaimLostError extends Error {
  constructor() {
    super("The leaderboard refresh claim is no longer active.");
  }
}

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
  refreshClaimToken?: string;
  refreshClaimCheckedAt?: Date;
}) {
  assertValidKennelPrestigeLeaderboardEntries(args.publication.entries);
  const database = args.database ?? db;

  return database.$transaction(async (tx) => {
    if (args.refreshClaimToken) {
      const claimCheckedAt = args.refreshClaimCheckedAt ?? new Date();
      const claim = await tx.kennelPrestigeLeaderboardState.updateMany({
        where: {
          id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
          refreshClaimToken: args.refreshClaimToken,
          refreshClaimExpiresAt: { gt: claimCheckedAt },
        },
        data: { refreshClaimedAt: claimCheckedAt },
      });

      if (claim.count !== 1) {
        throw new KennelPrestigeLeaderboardClaimLostError();
      }
    } else {
      await tx.kennelPrestigeLeaderboardState.upsert({
        where: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
        create: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
        update: {},
      });
    }

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

/**
 * Calculates and publishes the current Overall Top Ten as one replacement
 * publication. This is intentionally callable by a future scheduled worker;
 * it does not schedule itself or serve player requests.
 */
export async function publishCurrentOverallKennelPrestigeLeaderboard(
  args: {
    database?: LeaderboardDatabase;
    calculateLeaderboard?: (args: {
      take?: number;
      breedCode2?: string | null;
    }) => Promise<KennelPrestigeLeaderboardRow[]>;
    currentEpoch?: () => number;
    now?: () => Date;
    replaceLeaderboard?: (args: {
      database?: LeaderboardDatabase;
      publication: KennelPrestigeLeaderboardPublicationInput;
    }) => Promise<unknown>;
  } = {}
) {
  const rows = await (args.calculateLeaderboard ?? getKennelPrestigeLeaderboard)(
    { take: 10 }
  );
  const calculatedAt = (args.now ?? (() => new Date()))();

  return (args.replaceLeaderboard ?? replaceCurrentKennelPrestigeLeaderboard)({
    database: args.database,
    publication: {
      calculatedAt,
      calculatedEpoch: (args.currentEpoch ?? getCurrentEpoch)(),
      nextRefreshAt: new Date(
        calculatedAt.getTime() + OVERALL_LEADERBOARD_REFRESH_INTERVAL_MS
      ),
      entries: rows.map((row) => ({
        scope: "OVERALL",
        breedCode2: null,
        rank: row.rank,
        kennelId: row.kennel.id,
        kennelName: row.kennel.name,
        kennelSlug: row.kennel.slug,
        prestigeScore: row.prestige.score,
        tierLabel: row.prestige.tier.label,
        championsBred: row.prestige.metrics.championsBred,
        bestInShowWins: row.prestige.metrics.bestInShowWins,
      })),
    },
  });
}

async function tryClaimDueOverallKennelPrestigeLeaderboardRefresh(args: {
  stateClient: LeaderboardStateClient;
  now: Date;
  claimToken: string;
}) {
  await args.stateClient.kennelPrestigeLeaderboardState.upsert({
    where: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
    create: { id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID },
    update: {},
  });

  const leaseExpiresAt = new Date(
    args.now.getTime() + OVERALL_LEADERBOARD_REFRESH_LEASE_MS
  );
  const claim = await args.stateClient.kennelPrestigeLeaderboardState.updateMany({
    where: {
      id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
      OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: args.now } }],
      AND: [
        {
          OR: [
            { refreshClaimToken: null },
            { refreshClaimExpiresAt: { lte: args.now } },
          ],
        },
      ],
    },
    data: {
      refreshClaimToken: args.claimToken,
      refreshClaimedAt: args.now,
      refreshClaimExpiresAt: leaseExpiresAt,
    },
  });

  if (claim.count === 1) {
    return { outcome: "claimed" as const };
  }

  const state = await getCurrentKennelPrestigeLeaderboardState(args.stateClient);
  if (
    state?.refreshClaimToken &&
    state.refreshClaimExpiresAt &&
    state.refreshClaimExpiresAt > args.now
  ) {
    return { outcome: "running" as const };
  }

  return { outcome: "not_due" as const };
}

async function recordOverallKennelPrestigeLeaderboardRefreshFailure(args: {
  stateClient: LeaderboardStateClient;
  claimToken: string;
  failedAt: Date;
}) {
  return args.stateClient.kennelPrestigeLeaderboardState.updateMany({
    where: {
      id: CURRENT_KENNEL_PRESTIGE_LEADERBOARD_ID,
      refreshClaimToken: args.claimToken,
    },
    data: {
      refreshClaimToken: null,
      refreshClaimedAt: null,
      refreshClaimExpiresAt: null,
      lastRefreshFailedAt: args.failedAt,
      lastRefreshError: "Overall leaderboard refresh failed.",
    },
  });
}

/**
 * Claims and refreshes a due Overall leaderboard without holding a transaction
 * during canonical prestige calculation. Publication is fenced by the claim.
 */
export async function refreshDueOverallKennelPrestigeLeaderboard(
  args: {
    database?: LeaderboardDatabase;
    stateClient?: LeaderboardStateClient;
    calculateLeaderboard?: (args: {
      take?: number;
      breedCode2?: string | null;
    }) => Promise<KennelPrestigeLeaderboardRow[]>;
    currentEpoch?: () => number;
    now?: () => Date;
    createClaimToken?: () => string;
  } = {}
): Promise<OverallKennelPrestigeLeaderboardRefreshResult> {
  const perf = createPerfTimer({
    route: "service:kennelPrestigeLeaderboard.refreshDueOverall",
  });
  const stateClient = args.stateClient ?? db;
  const now = args.now ?? (() => new Date());
  const claimToken = (args.createClaimToken ?? randomUUID)();
  const claimNow = now();

  try {
    const claim = await perf.measure("refreshClaimMs", () =>
      tryClaimDueOverallKennelPrestigeLeaderboardRefresh({
        stateClient,
        now: claimNow,
        claimToken,
      })
    );
    if (claim.outcome !== "claimed") {
      perf.log({ outcome: claim.outcome, claimAcquired: false });
      return claim;
    }

    try {
      await perf.measure("calculationAndPublicationMs", () =>
        publishCurrentOverallKennelPrestigeLeaderboard({
          database: args.database,
          calculateLeaderboard: args.calculateLeaderboard,
          currentEpoch: args.currentEpoch,
          now,
          replaceLeaderboard: ({ database, publication }) =>
            replaceCurrentKennelPrestigeLeaderboard({
              database,
              publication,
              refreshClaimToken: claimToken,
              refreshClaimCheckedAt: now(),
            }),
        })
      );
      perf.log({ outcome: "published", claimAcquired: true });
      return { outcome: "published" };
    } catch (error) {
      if (error instanceof KennelPrestigeLeaderboardClaimLostError) {
        perf.log({ outcome: "claim_lost", claimAcquired: true });
        return { outcome: "claim_lost" };
      }

      const failure = await recordOverallKennelPrestigeLeaderboardRefreshFailure({
        stateClient,
        claimToken,
        failedAt: now(),
      });
      const outcome = failure.count === 1 ? "failed" : "claim_lost";
      perf.log({ outcome, claimAcquired: true });
      return { outcome };
    }
  } catch {
    perf.log({ outcome: "failed", claimAcquired: false });
    return { outcome: "failed" };
  }
}
