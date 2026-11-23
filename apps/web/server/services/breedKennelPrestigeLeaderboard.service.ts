import { db } from "@/lib/db";
import {
  isCanonicalShowGroupCode,
  type CanonicalShowGroupCode,
} from "@showring/rules";

export const CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID = 1;

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
    const generation = await tx.breedKennelPrestigeLeaderboardGeneration.create({
      data: {
        ...(args.generationId ? { id: args.generationId } : {}),
        manifestBreeds: { createMany: { data: args.manifest } },
      },
    });
    await tx.breedKennelPrestigeLeaderboardState.update({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
      data: { workingGenerationId: generation.id },
    });
    return generation;
  });
}

export async function claimWorkingBreedKennelPrestigeLeaderboardBreed(args: {
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
      OR: [{ completionClaimToken: null }, { completionClaimToken: args.claimToken }],
    },
    data: { completionClaimToken: args.claimToken },
  });
}

/** Atomically replaces one breed's working rows and records its completion. */
export async function completeWorkingBreedKennelPrestigeLeaderboardBreed(args: {
  generationId: string;
  breedCode2: string;
  claimToken: string;
  entries: BreedLeaderboardEntryInput[];
  completedAt?: Date;
  database?: BreedLeaderboardDatabase;
}) {
  assertBreedLeaderboardEntries(args.entries);
  const database = args.database ?? db;
  return database.$transaction(async (tx) => {
    const active = await tx.breedKennelPrestigeLeaderboardState.findUnique({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
    });
    if (active?.workingGenerationId !== args.generationId) {
      throw new Error("Breed leaderboard generation is not the active working generation.");
    }
    const completed = await tx.breedKennelPrestigeLeaderboardManifestBreed.updateMany({
      where: {
        generationId: args.generationId,
        breedCode2: args.breedCode2,
        completionClaimToken: args.claimToken,
      },
      data: { completedAt: args.completedAt ?? new Date() },
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
    const moved = await tx.breedKennelPrestigeLeaderboardState.updateMany({
      where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID, workingGenerationId: args.generationId },
      data: { publishedGenerationId: args.generationId, workingGenerationId: null },
    });
    if (moved.count !== 1) throw new Error("Breed leaderboard publication claim was lost.");
    await tx.breedKennelPrestigeLeaderboardGeneration.update({
      where: { id: args.generationId },
      data: { status: "PUBLISHED", publishedAt: args.publishedAt ?? new Date() },
    });
    if (state.publishedGenerationId && state.publishedGenerationId !== args.generationId) {
      await tx.breedKennelPrestigeLeaderboardGeneration.delete({ where: { id: state.publishedGenerationId } });
    }
  });
}

export async function getCurrentPublishedBreedKennelPrestigeLeaderboardState(
  client: Pick<typeof db, "breedKennelPrestigeLeaderboardState"> = db
) {
  return client.breedKennelPrestigeLeaderboardState.findUnique({
    where: { id: CURRENT_BREED_KENNEL_PRESTIGE_LEADERBOARD_STATE_ID },
  });
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
