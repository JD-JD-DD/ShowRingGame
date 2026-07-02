import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import {
  STARTER_KENNEL_RUNS,
  UNCATEGORIZED_KENNEL_RUN_NAME,
  ensureStarterKennelRuns,
} from "@/server/services/kennelRun.service";

type KennelRunBackfillClient = Pick<PrismaClient, "dog" | "kennel" | "kennelRun">;

type UncategorizedRunRecord = {
  id: string;
  kennelId: string;
};

export type KennelRunResetStats = {
  kennelsScanned: number;
  starterRunsCreated: number;
  activeOwnedDogsScanned: number;
  dogsAlreadyInUncategorized: number;
  dogsMovedToUncategorized: number;
  dogsSkipped: number;
  staleUnownedKennelRunIdsCleared: number;
  activeOwnedDogsMissingKennelRunIdAfterReset: number;
  activeOwnedDogsWithRunOwnerMismatchAfterReset: number;
  unownedDogsWithKennelRunIdAfterReset: number;
};

export type KennelRunRepairStats = {
  kennelsScanned: number;
  activeOwnedDogsAssignedToUncategorized: number;
  unownedDogsCleared: number;
  activeOwnedDogsMissingKennelRunIdAfterRepair: number;
  activeOwnedDogsWithRunOwnerMismatchAfterRepair: number;
  unownedDogsWithKennelRunIdAfterRepair: number;
};

function createEmptyStats(): KennelRunResetStats {
  return {
    kennelsScanned: 0,
    starterRunsCreated: 0,
    activeOwnedDogsScanned: 0,
    dogsAlreadyInUncategorized: 0,
    dogsMovedToUncategorized: 0,
    dogsSkipped: 0,
    staleUnownedKennelRunIdsCleared: 0,
    activeOwnedDogsMissingKennelRunIdAfterReset: 0,
    activeOwnedDogsWithRunOwnerMismatchAfterReset: 0,
    unownedDogsWithKennelRunIdAfterReset: 0,
  };
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

async function getUncategorizedRunsByKennelId(
  client: KennelRunBackfillClient,
  kennelIds: string[]
): Promise<Map<string, UncategorizedRunRecord>> {
  const runs = await client.kennelRun.findMany({
    where: {
      kennelId: {
        in: kennelIds,
      },
      name: UNCATEGORIZED_KENNEL_RUN_NAME,
      isSystem: true,
    },
    select: {
      id: true,
      kennelId: true,
    },
  });

  return new Map(runs.map((run) => [run.kennelId, run]));
}

async function countActiveOwnedRunOwnerMismatches(
  client: KennelRunBackfillClient
): Promise<number> {
  const assignedDogs = await client.dog.findMany({
    where: {
      ownerKennelId: {
        not: null,
      },
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      kennelRunId: {
        not: null,
      },
    },
    select: {
      ownerKennelId: true,
      kennelRun: {
        select: {
          kennelId: true,
        },
      },
    },
  });

  return assignedDogs.filter(
    (dog) => dog.kennelRun?.kennelId !== dog.ownerKennelId
  ).length;
}

export async function resetKennelRunsToUncategorized(args?: {
  client?: KennelRunBackfillClient;
}): Promise<KennelRunResetStats> {
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

  for (const kennel of kennels) {
    stats.starterRunsCreated += await countMissingStarterRuns(
      client,
      kennel.id
    );
    await ensureStarterKennelRuns({
      kennelId: kennel.id,
      client,
    });
  }

  const kennelIds = kennels.map((kennel) => kennel.id);
  const uncategorizedRunsByKennelId = await getUncategorizedRunsByKennelId(
    client,
    kennelIds
  );
  const activeOwnedDogs = await client.dog.findMany({
    where: {
      ownerKennelId: {
        in: kennelIds,
      },
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
    },
    select: {
      id: true,
      ownerKennelId: true,
      kennelRunId: true,
    },
  });

  stats.activeOwnedDogsScanned = activeOwnedDogs.length;
  stats.dogsAlreadyInUncategorized = activeOwnedDogs.filter((dog) => {
    if (!dog.ownerKennelId) {
      return false;
    }

    return (
      dog.kennelRunId === uncategorizedRunsByKennelId.get(dog.ownerKennelId)?.id
    );
  }).length;

  for (const dog of activeOwnedDogs) {
    if (!dog.ownerKennelId) {
      stats.dogsSkipped += 1;
      continue;
    }

    const uncategorizedRun = uncategorizedRunsByKennelId.get(dog.ownerKennelId);

    if (!uncategorizedRun) {
      stats.dogsSkipped += 1;
      continue;
    }

    if (dog.kennelRunId === uncategorizedRun.id) {
      continue;
    }

    const update = await client.dog.updateMany({
      where: {
        id: dog.id,
        ownerKennelId: dog.ownerKennelId,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        OR: [
          { kennelRunId: null },
          { kennelRunId: { not: uncategorizedRun.id } },
        ],
      },
      data: {
        kennelRunId: uncategorizedRun.id,
      },
    });

    if (update.count === 0) {
      stats.dogsSkipped += 1;
    } else {
      stats.dogsMovedToUncategorized += update.count;
    }
  }

  const staleUnownedClear = await client.dog.updateMany({
    where: {
      ownerKennelId: null,
      kennelRunId: {
        not: null,
      },
    },
    data: {
      kennelRunId: null,
    },
  });

  stats.staleUnownedKennelRunIdsCleared = staleUnownedClear.count;
  stats.activeOwnedDogsMissingKennelRunIdAfterReset = await client.dog.count({
    where: {
      ownerKennelId: {
        not: null,
      },
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      kennelRunId: null,
    },
  });
  stats.activeOwnedDogsWithRunOwnerMismatchAfterReset =
    await countActiveOwnedRunOwnerMismatches(client);
  stats.unownedDogsWithKennelRunIdAfterReset = await client.dog.count({
    where: {
      ownerKennelId: null,
      kennelRunId: {
        not: null,
      },
    },
  });

  return stats;
}

export async function backfillKennelRuns(args?: {
  client?: KennelRunBackfillClient;
}): Promise<KennelRunResetStats> {
  return resetKennelRunsToUncategorized(args);
}

export async function repairKennelRunAssignments(args?: {
  client?: KennelRunBackfillClient;
}): Promise<KennelRunRepairStats> {
  const client = args?.client ?? db;
  const kennels = await client.kennel.findMany({
    where: {
      isNpc: false,
    },
    select: {
      id: true,
    },
  });
  const stats: KennelRunRepairStats = {
    kennelsScanned: kennels.length,
    activeOwnedDogsAssignedToUncategorized: 0,
    unownedDogsCleared: 0,
    activeOwnedDogsMissingKennelRunIdAfterRepair: 0,
    activeOwnedDogsWithRunOwnerMismatchAfterRepair: 0,
    unownedDogsWithKennelRunIdAfterRepair: 0,
  };

  for (const kennel of kennels) {
    await ensureStarterKennelRuns({
      kennelId: kennel.id,
      client,
    });
  }

  const kennelIds = kennels.map((kennel) => kennel.id);
  const uncategorizedRunsByKennelId = await getUncategorizedRunsByKennelId(
    client,
    kennelIds
  );
  const activeOwnedDogsMissingRuns = await client.dog.findMany({
    where: {
      ownerKennelId: {
        in: kennelIds,
      },
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      kennelRunId: null,
    },
    select: {
      id: true,
      ownerKennelId: true,
    },
  });

  for (const dog of activeOwnedDogsMissingRuns) {
    if (!dog.ownerKennelId) {
      continue;
    }

    const uncategorizedRun = uncategorizedRunsByKennelId.get(dog.ownerKennelId);

    if (!uncategorizedRun) {
      continue;
    }

    const update = await client.dog.updateMany({
      where: {
        id: dog.id,
        ownerKennelId: dog.ownerKennelId,
        lifecycleState: "ALIVE",
        isPlayerVisible: true,
        kennelRunId: null,
      },
      data: {
        kennelRunId: uncategorizedRun.id,
      },
    });

    stats.activeOwnedDogsAssignedToUncategorized += update.count;
  }

  const unownedClear = await client.dog.updateMany({
    where: {
      ownerKennelId: null,
      kennelRunId: {
        not: null,
      },
    },
    data: {
      kennelRunId: null,
    },
  });

  stats.unownedDogsCleared = unownedClear.count;
  stats.activeOwnedDogsMissingKennelRunIdAfterRepair = await client.dog.count({
    where: {
      ownerKennelId: {
        not: null,
      },
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      kennelRunId: null,
    },
  });
  stats.activeOwnedDogsWithRunOwnerMismatchAfterRepair =
    await countActiveOwnedRunOwnerMismatches(client);
  stats.unownedDogsWithKennelRunIdAfterRepair = await client.dog.count({
    where: {
      ownerKennelId: null,
      kennelRunId: {
        not: null,
      },
    },
  });

  return stats;
}

export function kennelRunResetHasIntegrityFailures(
  stats: KennelRunResetStats
): boolean {
  return (
    stats.activeOwnedDogsMissingKennelRunIdAfterReset > 0 ||
    stats.activeOwnedDogsWithRunOwnerMismatchAfterReset > 0 ||
    stats.unownedDogsWithKennelRunIdAfterReset > 0
  );
}

export function formatKennelRunResetStats(stats: KennelRunResetStats): string {
  return [
    `Kennels scanned: ${stats.kennelsScanned}`,
    `Starter runs created: ${stats.starterRunsCreated}`,
    `Active owned dogs scanned: ${stats.activeOwnedDogsScanned}`,
    `Dogs already in ${UNCATEGORIZED_KENNEL_RUN_NAME}: ${stats.dogsAlreadyInUncategorized}`,
    `Dogs moved to ${UNCATEGORIZED_KENNEL_RUN_NAME}: ${stats.dogsMovedToUncategorized}`,
    `Dogs skipped: ${stats.dogsSkipped}`,
    `Stale unowned kennelRunId rows cleared: ${stats.staleUnownedKennelRunIdsCleared}`,
    `Active owned dogs missing kennelRunId after reset: ${stats.activeOwnedDogsMissingKennelRunIdAfterReset}`,
    `Active owned dogs assigned to another kennel's run after reset: ${stats.activeOwnedDogsWithRunOwnerMismatchAfterReset}`,
    `Unowned dogs with kennelRunId after reset: ${stats.unownedDogsWithKennelRunIdAfterReset}`,
  ].join("\n");
}

export const formatKennelRunBackfillStats = formatKennelRunResetStats;
