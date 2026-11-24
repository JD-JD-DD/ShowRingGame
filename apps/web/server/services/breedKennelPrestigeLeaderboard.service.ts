import { db } from "@/lib/db";
import {
  isCanonicalShowGroupCode,
  type CanonicalShowGroupCode,
} from "@showring/rules";

export const CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID = 1;
// Matches the bounded Overall refresh lease while remaining independent of it.
export const BREED_KENNEL_PRESTIGE_LEADERBOARD_CLAIM_LEASE_MS = 10 * 60 * 1000;
export const BREED_KENNEL_PRESTIGE_LEADERBOARD_REFRESH_INTERVAL_MS = 7 * 60 * 60 * 1000;

export class BreedKennelPrestigeLeaderboardNotDueError extends Error {
  constructor() {
    super("The breed leaderboard refresh is not due.");
  }
}

export type BreedLeaderboardManifestInput = {
  breedCode2: string;
  groupCode: CanonicalShowGroupCode;
};

export type BreedLeaderboardEntryInput = {
  rank: number;
  kennelId: string;
  kennelName: string;
  kennelSlug: string;
  prestigeScore: number;
  tierLabel: string;
  championsBred: number;
  bestInShowWins: number;
};

type BreedLeaderboardDatabase = Pick<
  typeof db,
  "$transaction" | "breedKennelPrestigeLeaderboardState"
>;

function assertManifest(manifest: BreedLeaderboardManifestInput[]) {
  const codes = new Set<string>();
  for (const breed of manifest) {
    if (!breed.breedCode2 || codes.has(breed.breedCode2)) {
      throw new Error("Breed leaderboard manifests require unique breed codes.");
    }
    if (!isCanonicalShowGroupCode(breed.groupCode)) {
      throw new Error("Breed leaderboard manifests require canonical scheduled group codes.");
    }
    codes.add(breed.breedCode2);
  }
}

export function assertBreedLeaderboardEntries(entries: BreedLeaderboardEntryInput[]) {
  if (entries.length > 10) {
    throw new Error("Breed leaderboards cannot contain more than ten entries.");
  }
  const ranks = new Set<number>();
  for (const entry of entries) {
    if (!Number.isInteger(entry.rank) || entry.rank < 1 || entry.rank > 10) {
      throw new Error("Breed leaderboard ranks must be integers from one through ten.");
    }
    if (ranks.has(entry.rank)) {
      throw new Error("Breed leaderboard ranks must be unique within a breed.");
    }
    ranks.add(entry.rank);
  }
}

export async function createWorkingBreedKennelPrestigeLeaderboardGeneration(args: {
  manifest: BreedLeaderboardManifestInput[];
  generationId?: string;
  now?: Date;
  database?: BreedLeaderboardDatabase;
}) {
  assertManifest(args.manifest);
  const database = args.database ?? db;
  return database.$transaction(async (tx) => {
    await tx.breedKennelPrestigeLeaderboardState.upsert({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
      create: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
      update: {},
    });
    const state = await tx.breedKennelPrestigeLeaderboardState.findUniqueOrThrow({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
    });
    if (state.workingGenerationId) {
      throw new Error("A breed leaderboard working generation already exists.");
    }
    if (state.nextRefreshAt && state.nextRefreshAt > (args.now ?? new Date())) {
      throw new BreedKennelPrestigeLeaderboardNotDueError();
    }
    const generation = await tx.breedKennelPrestigeLeaderboardGeneration.create({
      data: {
        ...(args.generationId ? { id: args.generationId } : {}),
        manifestBreeds: { createMany: { data: args.manifest } },
      },
    });
    const activated = await tx.breedKennelPrestigeLeaderboardState.updateMany({
      where: {
        id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID,
        workingGenerationId: null,
        OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: args.now ?? new Date() } }],
      },
      data: { workingGenerationId: generation.id },
    });
    if (activated.count !== 1) {
      await tx.breedKennelPrestigeLeaderboardGeneration.delete({ where: { id: generation.id } });
      const latestState = await tx.breedKennelPrestigeLeaderboardState.findUniqueOrThrow({
        where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
      });
      if (latestState.nextRefreshAt && latestState.nextRefreshAt > (args.now ?? new Date())) {
        throw new BreedKennelPrestigeLeaderboardNotDueError();
      }
      throw new Error("A breed leaderboard working generation already exists.");
    }
    return generation;
  });
}

export async function claimWorkingBreedKennelPrestigeLeaderboardBreed(args: {
  generationId: string;
  breedCode2: string;
  claimToken: string;
  now?: Date;
  database?: Pick<typeof db, "breedKennelPrestigeLeaderboardManifestBreed">;
}) {
  const now = args.now ?? new Date();
  return (args.database ?? db).breedKennelPrestigeLeaderboardManifestBreed.updateMany({
    where: {
      generationId: args.generationId,
      breedCode2: args.breedCode2,
      completedAt: null,
      generation: {
        workingState: {
          is: {
            id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID,
            workingGenerationId: args.generationId,
          },
        },
      },
      OR: [
        { completionClaimToken: null },
        { completionClaimExpiresAt: null },
        { completionClaimExpiresAt: { lte: now } },
      ],
    },
    data: {
      completionClaimToken: args.claimToken,
      completionClaimExpiresAt: new Date(
        now.getTime() + BREED_KENNEL_PRESTIGE_LEADERBOARD_CLAIM_LEASE_MS
      ),
    },
  });
}

export async function releaseWorkingBreedKennelPrestigeLeaderboardBreedClaim(args: {
  generationId: string;
  breedCode2: string;
  claimToken: string;
  database?: Pick<typeof db, "breedKennelPrestigeLeaderboardManifestBreed">;
}) {
  return (args.database ?? db).breedKennelPrestigeLeaderboardManifestBreed.updateMany({
    where: {
      generationId: args.generationId,
      breedCode2: args.breedCode2,
      completedAt: null,
      completionClaimToken: args.claimToken,
      generation: {
        workingState: {
          is: {
            id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID,
            workingGenerationId: args.generationId,
          },
        },
      },
    },
    data: { completionClaimToken: null, completionClaimExpiresAt: null },
  });
}

/** Atomically replaces one breed's working rows and records its completion. */
export async function completeWorkingBreedKennelPrestigeLeaderboardBreed(args: {
  generationId: string;
  breedCode2: string;
  claimToken: string;
  entries: BreedLeaderboardEntryInput[];
  completedAt?: Date;
  now?: Date;
  database?: BreedLeaderboardDatabase;
}) {
  assertBreedLeaderboardEntries(args.entries);
  const database = args.database ?? db;
  const now = args.now ?? new Date();
  return database.$transaction(async (tx) => {
    const completed = await tx.breedKennelPrestigeLeaderboardManifestBreed.updateMany({
      where: {
        generationId: args.generationId,
        breedCode2: args.breedCode2,
        completedAt: null,
        completionClaimToken: args.claimToken,
        completionClaimExpiresAt: { gt: now },
        generation: {
          workingState: {
            is: {
              id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID,
              workingGenerationId: args.generationId,
            },
          },
        },
      },
      data: {
        completedAt: args.completedAt ?? now,
        completionClaimToken: null,
        completionClaimExpiresAt: null,
      },
    });
    if (completed.count !== 1) throw new Error("Breed leaderboard completion claim was lost.");
    await tx.breedKennelPrestigeLeaderboardEntry.deleteMany({
      where: { generationId: args.generationId, breedCode2: args.breedCode2 },
    });
    if (args.entries.length) {
      await tx.breedKennelPrestigeLeaderboardEntry.createMany({
        data: args.entries.map((entry) => ({ ...entry, generationId: args.generationId, breedCode2: args.breedCode2 })),
      });
    }
  });
}

export async function publishCompleteBreedKennelPrestigeLeaderboardGeneration(args: {
  generationId: string;
  publishedAt?: Date;
  database?: BreedLeaderboardDatabase;
}) {
  const database = args.database ?? db;
  return database.$transaction(async (tx) => {
    const state = await tx.breedKennelPrestigeLeaderboardState.findUniqueOrThrow({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
    });
    if (state.workingGenerationId !== args.generationId) {
      throw new Error("Only the active breed leaderboard generation can publish.");
    }
    const incomplete = await tx.breedKennelPrestigeLeaderboardManifestBreed.count({
      where: { generationId: args.generationId, completedAt: null },
    });
    if (incomplete) throw new Error("Cannot publish an incomplete breed leaderboard generation.");
    const publishedAt = args.publishedAt ?? new Date();
    const moved = await tx.breedKennelPrestigeLeaderboardState.updateMany({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID, workingGenerationId: args.generationId },
      data: {
        publishedGenerationId: args.generationId,
        workingGenerationId: null,
        nextRefreshAt: new Date(publishedAt.getTime() + BREED_KENNEL_PRESTIGE_LEADERBOARD_REFRESH_INTERVAL_MS),
      },
    });
    if (moved.count !== 1) throw new Error("Breed leaderboard publication claim was lost.");
    await tx.breedKennelPrestigeLeaderboardGeneration.update({
      where: { id: args.generationId },
      data: { status: "PUBLISHED", publishedAt },
    });
    if (state.publishedGenerationId && state.publishedGenerationId !== args.generationId) {
      await tx.breedKennelPrestigeLeaderboardGeneration.delete({ where: { id: state.publishedGenerationId } });
    }
  });
}

export async function getCurrentPublishedBreedKennelPrestigeLeaderboardState(
  client: Pick<typeof db, "breedKennelPrestigeLeaderboardState"> = db
) {
  const state = await client.breedKennelPrestigeLeaderboardState.findUnique({
    where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
    include: { publishedGeneration: { select: { publishedAt: true } } },
  });
  if (!state) return null;
  const { publishedGeneration, ...stateFields } = state;
  return { ...stateFields, publishedAt: publishedGeneration?.publishedAt ?? null };
}

export async function listCurrentPublishedBreedKennelPrestigeLeaderboardEntries(args: {
  breedCode2: string;
  client?: Pick<typeof db, "breedKennelPrestigeLeaderboardState" | "breedKennelPrestigeLeaderboardEntry">;
}) {
  const client = args.client ?? db;
  const state = await getCurrentPublishedBreedKennelPrestigeLeaderboardState(client);
  if (!state?.publishedGenerationId) return [];
  return client.breedKennelPrestigeLeaderboardEntry.findMany({
    where: { generationId: state.publishedGenerationId, breedCode2: args.breedCode2 },
    orderBy: { rank: "asc" },
    take: 10,
  });
}

export async function getCurrentWorkingBreedKennelPrestigeLeaderboardGeneration(
  client: Pick<typeof db, "breedKennelPrestigeLeaderboardState" | "breedKennelPrestigeLeaderboardGeneration"> = db
) {
  const state = await client.breedKennelPrestigeLeaderboardState.findUnique({ where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID } });
  return state?.workingGenerationId
    ? client.breedKennelPrestigeLeaderboardGeneration.findUnique({ where: { id: state.workingGenerationId }, include: { manifestBreeds: { orderBy: [{ groupCode: "asc" }, { breedCode2: "asc" }] } } })
    : null;
}

/** Removes only generations no longer referenced by either current pointer. */
export async function cleanupInactiveBreedKennelPrestigeLeaderboardGenerations(
  database: BreedLeaderboardDatabase = db
) {
  return database.$transaction(async (tx) => {
    const state = await tx.breedKennelPrestigeLeaderboardState.findUnique({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
    });
    const activeGenerationIds = [
      state?.publishedGenerationId,
      state?.workingGenerationId,
    ].filter((value): value is string => Boolean(value));
    return tx.breedKennelPrestigeLeaderboardGeneration.deleteMany({
      where: activeGenerationIds.length ? { id: { notIn: activeGenerationIds } } : {},
    });
  });
}
