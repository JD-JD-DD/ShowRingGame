import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import {
  STARTER_KENNEL_RUNS,
  UNCATEGORIZED_KENNEL_RUN_NAME,
  ensureStarterKennelRuns,
} from "@/server/services/kennelRun.service";

type KennelRunBackfillClient = Pick<
  PrismaClient,
  "dog" | "kennel" | "kennelAreaDog" | "kennelRun"
>;

export type KennelRunBackfillStats = {
  kennelsScanned: number;
  starterRunsCreated: number;
  dogsScanned: number;
  dogsAssignedFromLegacySingleMembership: number;
  dogsAssignedFromLegacyMultipleMemberships: number;
  dogsAssignedToUncategorized: number;
  dogsSkipped: number;
  activeOwnedDogsStillMissingKennelRunId: number;
};

export type LegacyKennelAreaCandidate = {
  id: string;
  kennelId?: string;
  name: string;
  sortOrder: number;
};

type KennelRunRecord = {
  id: string;
  kennelId: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function createEmptyStats(): KennelRunBackfillStats {
  return {
    kennelsScanned: 0,
    starterRunsCreated: 0,
    dogsScanned: 0,
    dogsAssignedFromLegacySingleMembership: 0,
    dogsAssignedFromLegacyMultipleMemberships: 0,
    dogsAssignedToUncategorized: 0,
    dogsSkipped: 0,
    activeOwnedDogsStillMissingKennelRunId: 0,
  };
}

export function selectLegacyKennelRunCandidate(
  candidates: LegacyKennelAreaCandidate[]
): LegacyKennelAreaCandidate | null {
  return [...candidates].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
  )[0] ?? null;
}

async function countMissingStarterRuns(
  client: KennelRunBackfillClient,
  kennelId: string
): Promise<number> {
  const existingStarterRuns = await client.kennelRun.findMany({
    where: {
      kennelId,
      name: {
        in: STARTER_KENNEL_RUNS.map((run) => run.name),
      },
    },
    select: {
      name: true,
    },
  });
  const existingNames = new Set(existingStarterRuns.map((run) => run.name));

  return STARTER_KENNEL_RUNS.filter((run) => !existingNames.has(run.name))
    .length;
}

async function loadKennelRunMap(
  client: KennelRunBackfillClient,
  kennelId: string
): Promise<Map<string, KennelRunRecord>> {
  const runs = await client.kennelRun.findMany({
    where: {
      kennelId,
    },
    select: {
      id: true,
      kennelId: true,
      name: true,
      sortOrder: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return new Map(runs.map((run) => [run.name, run]));
}

async function ensureKennelRunByName(args: {
  client: KennelRunBackfillClient;
  kennelId: string;
  name: string;
  runMap: Map<string, KennelRunRecord>;
}): Promise<KennelRunRecord> {
  const existingRun = args.runMap.get(args.name);

  if (existingRun) {
    return existingRun;
  }

  const nextSortOrder =
    Math.max(-1, ...[...args.runMap.values()].map((run) => run.sortOrder)) + 1;
  const createdRun = await args.client.kennelRun.create({
    data: {
      kennelId: args.kennelId,
      name: args.name,
      sortOrder: nextSortOrder,
      isSystem: false,
    },
    select: {
      id: true,
      kennelId: true,
      name: true,
      sortOrder: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  args.runMap.set(createdRun.name, createdRun);

  return createdRun;
}

export async function backfillKennelRuns(args?: {
  client?: KennelRunBackfillClient;
}): Promise<KennelRunBackfillStats> {
  const client = args?.client ?? db;
  const stats = createEmptyStats();

  const kennels = await client.kennel.findMany({
    where: {
      isNpc: false,
    },
    select: {
      id: true,
    },
  });

  stats.kennelsScanned = kennels.length;
  const kennelIds = kennels.map((kennel) => kennel.id);
  const runMapsByKennelId = new Map<string, Map<string, KennelRunRecord>>();

  for (const kennel of kennels) {
    stats.starterRunsCreated += await countMissingStarterRuns(
      client,
      kennel.id
    );
    await ensureStarterKennelRuns({
      kennelId: kennel.id,
      client,
    });
    runMapsByKennelId.set(
      kennel.id,
      await loadKennelRunMap(client, kennel.id)
    );
  }

  const activeOwnedDogs = await client.dog.findMany({
    where: {
      ownerKennelId: {
        in: kennelIds,
      },
      lifecycleState: "ALIVE",
    },
    select: {
      id: true,
      ownerKennelId: true,
      kennelRunId: true,
    },
  });

  stats.dogsScanned = activeOwnedDogs.length;
  const dogsMissingRuns = activeOwnedDogs.filter((dog) => !dog.kennelRunId);
  const dogOwnerKennelIds = new Map(
    dogsMissingRuns.flatMap((dog) =>
      dog.ownerKennelId ? [[dog.id, dog.ownerKennelId] as const] : []
    )
  );
  const legacyMemberships = dogsMissingRuns.length
    ? await client.kennelAreaDog.findMany({
        where: {
          dogId: {
            in: dogsMissingRuns.map((dog) => dog.id),
          },
        },
        select: {
          dogId: true,
          area: {
            select: {
              id: true,
              kennelId: true,
              name: true,
              sortOrder: true,
            },
          },
        },
      })
    : [];
  const legacyCandidatesByDogId = new Map<
    string,
    LegacyKennelAreaCandidate[]
  >();

  for (const membership of legacyMemberships) {
    if (membership.area.kennelId !== dogOwnerKennelIds.get(membership.dogId)) {
      continue;
    }

    const candidates = legacyCandidatesByDogId.get(membership.dogId) ?? [];
    candidates.push(membership.area);
    legacyCandidatesByDogId.set(membership.dogId, candidates);
  }

  for (const dog of activeOwnedDogs) {
    if (!dog.ownerKennelId || dog.kennelRunId) {
      stats.dogsSkipped += 1;
      continue;
    }

    const legacyCandidates = legacyCandidatesByDogId.get(dog.id) ?? [];
    const selectedLegacyArea = selectLegacyKennelRunCandidate(legacyCandidates);
    const runMap =
      runMapsByKennelId.get(dog.ownerKennelId) ??
      (await loadKennelRunMap(client, dog.ownerKennelId));
    runMapsByKennelId.set(dog.ownerKennelId, runMap);
    const targetRun = selectedLegacyArea
      ? await ensureKennelRunByName({
          client,
          kennelId: dog.ownerKennelId,
          name: selectedLegacyArea.name,
          runMap,
        })
      : await ensureKennelRunByName({
          client,
          kennelId: dog.ownerKennelId,
          name: UNCATEGORIZED_KENNEL_RUN_NAME,
          runMap,
        });

    const updatedDog = await client.dog.updateMany({
      where: {
        id: dog.id,
        ownerKennelId: dog.ownerKennelId,
        lifecycleState: "ALIVE",
        kennelRunId: null,
      },
      data: {
        kennelRunId: targetRun.id,
      },
    });

    if (updatedDog.count === 0) {
      stats.dogsSkipped += 1;
      continue;
    }

    if (legacyCandidates.length === 0) {
      stats.dogsAssignedToUncategorized += 1;
    } else if (legacyCandidates.length === 1) {
      stats.dogsAssignedFromLegacySingleMembership += 1;
    } else {
      stats.dogsAssignedFromLegacyMultipleMemberships += 1;
    }
  }

  stats.activeOwnedDogsStillMissingKennelRunId = await client.dog.count({
    where: {
      ownerKennelId: {
        in: kennelIds,
      },
      lifecycleState: "ALIVE",
      kennelRunId: null,
    },
  });

  return stats;
}

export function formatKennelRunBackfillStats(
  stats: KennelRunBackfillStats
): string {
  return [
    `Kennels scanned: ${stats.kennelsScanned}`,
    `Starter runs created: ${stats.starterRunsCreated}`,
    `Dogs scanned: ${stats.dogsScanned}`,
    `Dogs assigned from legacy single membership: ${stats.dogsAssignedFromLegacySingleMembership}`,
    `Dogs assigned from legacy multiple memberships: ${stats.dogsAssignedFromLegacyMultipleMemberships}`,
    `Dogs assigned to ${UNCATEGORIZED_KENNEL_RUN_NAME}: ${stats.dogsAssignedToUncategorized}`,
    `Dogs skipped: ${stats.dogsSkipped}`,
    `Active owned dogs still missing kennelRunId: ${stats.activeOwnedDogsStillMissingKennelRunId}`,
  ].join("\n");
}
