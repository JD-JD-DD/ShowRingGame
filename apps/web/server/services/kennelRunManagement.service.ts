import { db } from "@/lib/db";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  UNCATEGORIZED_KENNEL_RUN_NAME,
  ensureStarterKennelRuns,
  ensureUncategorizedKennelRun,
} from "@/server/services/kennelRun.service";

const MAX_KENNEL_RUN_NAME_LENGTH = 60;

type KennelRunClient = Pick<PrismaClient, "dog" | "kennelRun">;
type KennelRunTransactionRunner = KennelRunClient & {
  $transaction<T>(fn: (tx: KennelRunClient) => Promise<T>): Promise<T>;
};

export class KennelRunServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message);
  }
}

function normalizeRunName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function assertRunName(value: unknown): string {
  const name = normalizeRunName(value);

  if (!name) {
    throw new KennelRunServiceError("Run name is required.");
  }

  if (name.length > MAX_KENNEL_RUN_NAME_LENGTH) {
    throw new KennelRunServiceError(
      `Run name cannot exceed ${MAX_KENNEL_RUN_NAME_LENGTH} characters.`
    );
  }

  return name;
}

async function assertUniqueRunName(args: {
  client: KennelRunClient;
  kennelId: string;
  name: string;
  exceptRunId?: string;
}) {
  const existing = await args.client.kennelRun.findFirst({
    where: {
      kennelId: args.kennelId,
      name: args.name,
      ...(args.exceptRunId ? { id: { not: args.exceptRunId } } : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new KennelRunServiceError("A run with that name already exists.");
  }
}

async function getNextSortOrder(client: KennelRunClient, kennelId: string) {
  const lastRun = await client.kennelRun.findFirst({
    where: {
      kennelId,
    },
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return (lastRun?.sortOrder ?? -1) + 1;
}

export async function listKennelRuns(args: {
  kennelId: string;
  client?: KennelRunClient;
}) {
  const client = args.client ?? db;
  const existingRuns = await client.kennelRun.findMany({
    where: {
      kennelId: args.kennelId,
    },
    select: {
      id: true,
    },
  });

  if (existingRuns.length === 0) {
    await ensureStarterKennelRuns({
      kennelId: args.kennelId,
      client,
    });
  } else {
    await ensureUncategorizedKennelRun({
      kennelId: args.kennelId,
      client,
    });
  }

  const runs = await client.kennelRun.findMany({
    where: {
      kennelId: args.kennelId,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      isSystem: true,
    },
  });
  const activeDogs = await client.dog.findMany({
    where: {
      ownerKennelId: args.kennelId,
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      kennelRunId: {
        in: runs.map((run) => run.id),
      },
    },
    select: {
      kennelRunId: true,
    },
  });
  const dogCountByRunId = new Map<string, number>();

  for (const dog of activeDogs) {
    if (!dog.kennelRunId) {
      continue;
    }

    dogCountByRunId.set(
      dog.kennelRunId,
      (dogCountByRunId.get(dog.kennelRunId) ?? 0) + 1
    );
  }

  return runs.map((run) => ({
    ...run,
    dogCount: dogCountByRunId.get(run.id) ?? 0,
  }));
}

export async function createKennelRun(args: {
  kennelId: string;
  name: unknown;
  client?: KennelRunClient;
}) {
  const client = args.client ?? db;
  const name = assertRunName(args.name);

  await assertUniqueRunName({
    client,
    kennelId: args.kennelId,
    name,
  });

  try {
    return await client.kennelRun.create({
      data: {
        kennelId: args.kennelId,
        name,
        sortOrder: await getNextSortOrder(client, args.kennelId),
        isSystem: false,
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        isSystem: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new KennelRunServiceError("A run with that name already exists.");
    }

    throw error;
  }
}

export async function updateKennelRun(args: {
  kennelId: string;
  runId: string;
  name?: unknown;
  sortOrder?: unknown;
  client?: KennelRunClient;
}) {
  const client = args.client ?? db;
  const run = await client.kennelRun.findUnique({
    where: {
      id: args.runId,
    },
    select: {
      id: true,
      kennelId: true,
      name: true,
      isSystem: true,
    },
  });

  if (!run || run.kennelId !== args.kennelId) {
    throw new KennelRunServiceError("Kennel Run not found.", 404);
  }

  if (run.isSystem) {
    throw new KennelRunServiceError(
      `${UNCATEGORIZED_KENNEL_RUN_NAME} cannot be renamed or reordered.`
    );
  }

  const data: { name?: string; sortOrder?: number } = {};

  if (args.name !== undefined) {
    const name = assertRunName(args.name);

    if (name !== run.name) {
      await assertUniqueRunName({
        client,
        kennelId: args.kennelId,
        name,
        exceptRunId: run.id,
      });
      data.name = name;
    }
  }

  if (args.sortOrder !== undefined) {
    const sortOrder = Number(args.sortOrder);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      throw new KennelRunServiceError("sortOrder must be a non-negative integer.");
    }

    data.sortOrder = sortOrder;
  }

  if (Object.keys(data).length === 0) {
    throw new KennelRunServiceError("No Kennel Run changes provided.");
  }

  try {
    return await client.kennelRun.update({
      where: {
        id: run.id,
      },
      data,
      select: {
        id: true,
        name: true,
        sortOrder: true,
        isSystem: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new KennelRunServiceError("A run with that name already exists.");
    }

    throw error;
  }
}

export async function deleteKennelRun(args: {
  kennelId: string;
  runId: string;
  client?: KennelRunTransactionRunner;
}) {
  const client =
    args.client ?? (db as unknown as KennelRunTransactionRunner);

  return client.$transaction(async (tx: KennelRunClient) => {
    const run = await tx.kennelRun.findUnique({
      where: {
        id: args.runId,
      },
      select: {
        id: true,
        kennelId: true,
        isSystem: true,
      },
    });

    if (!run || run.kennelId !== args.kennelId) {
      throw new KennelRunServiceError("Kennel Run not found.", 404);
    }

    if (run.isSystem) {
      throw new KennelRunServiceError(
        `${UNCATEGORIZED_KENNEL_RUN_NAME} cannot be deleted.`
      );
    }

    const uncategorizedRun = await ensureUncategorizedKennelRun({
      kennelId: args.kennelId,
      client: tx,
    });
    const moved = await tx.dog.updateMany({
      where: {
        ownerKennelId: args.kennelId,
        kennelRunId: run.id,
      },
      data: {
        kennelRunId: uncategorizedRun.id,
      },
    });

    await tx.kennelRun.delete({
      where: {
        id: run.id,
      },
    });

    return {
      runId: run.id,
      movedCount: moved.count,
    };
  });
}

export async function moveDogsToKennelRun(args: {
  kennelId: string;
  dogIds: unknown;
  targetRunId: unknown;
  client?: KennelRunClient;
}) {
  const client = args.client ?? db;
  const dogIds = Array.isArray(args.dogIds)
    ? [...new Set(args.dogIds.map((dogId) => String(dogId).trim()))].filter(
        Boolean
      )
    : [];
  const targetRunId = String(args.targetRunId ?? "").trim();

  if (dogIds.length === 0) {
    throw new KennelRunServiceError("At least one dog is required.");
  }

  if (!targetRunId) {
    throw new KennelRunServiceError("targetRunId is required.");
  }

  const targetRun = await client.kennelRun.findUnique({
    where: {
      id: targetRunId,
    },
    select: {
      id: true,
      kennelId: true,
    },
  });

  if (!targetRun || targetRun.kennelId !== args.kennelId) {
    throw new KennelRunServiceError("Target Kennel Run not found.", 404);
  }

  const dogs = await client.dog.findMany({
    where: {
      id: {
        in: dogIds,
      },
    },
    select: {
      id: true,
      ownerKennelId: true,
    },
  });
  const foundDogIds = new Set(dogs.map((dog) => dog.id));
  const invalidDogIds = dogIds.filter(
    (dogId) =>
      !foundDogIds.has(dogId) ||
      dogs.find((dog) => dog.id === dogId)?.ownerKennelId !== args.kennelId
  );

  if (invalidDogIds.length > 0) {
    throw new KennelRunServiceError(
      "All requested dogs must belong to the current kennel.",
      400
    );
  }

  const moved = await client.dog.updateMany({
    where: {
      id: {
        in: dogIds,
      },
      ownerKennelId: args.kennelId,
    },
    data: {
      kennelRunId: targetRun.id,
    },
  });

  return {
    targetRunId: targetRun.id,
    movedCount: moved.count,
  };
}
