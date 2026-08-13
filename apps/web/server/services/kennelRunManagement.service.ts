import { db } from "@/lib/db";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  UNCATEGORIZED_KENNEL_RUN_NAME,
  deleteLitterRunIfEmpty,
  ensureStarterKennelRuns,
  ensureUncategorizedKennelRun,
} from "@/server/services/kennelRun.service";
import {
  validateCallName,
  validateRegisteredDogName,
} from "@/server/validation/dogName.validation";

const MAX_KENNEL_RUN_NAME_LENGTH = 60;

type KennelRunClient = Pick<PrismaClient, "dog" | "kennelRun">;
type KennelRunTransactionRunner = KennelRunClient & {
  $transaction<T>(fn: (tx: KennelRunClient) => Promise<T>): Promise<T>;
};

type BulkCallNameUpdate = {
  dogId: string;
  callName?: string | null;
  registeredName?: string;
};

type BulkNamingClient = Pick<PrismaClient, "dog" | "kennelRun" | "breed">;
type BulkNamingTransactionRunner = BulkNamingClient & {
  $transaction<T>(fn: (tx: BulkNamingClient) => Promise<T>): Promise<T>;
};

export type KennelRunMoveDirection = "up" | "down";

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
      kind: true,
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
  const persistedDogs = await client.dog.findMany({
    where: {
      kennelRunId: {
        in: runs.map((run) => run.id),
      },
    },
    select: {
      kennelRunId: true,
    },
  });
  const dogCountByRunId = new Map<string, number>();
  const persistedDogCountByRunId = new Map<string, number>();

  for (const dog of activeDogs) {
    if (!dog.kennelRunId) {
      continue;
    }

    dogCountByRunId.set(
      dog.kennelRunId,
      (dogCountByRunId.get(dog.kennelRunId) ?? 0) + 1
    );
  }

  for (const dog of persistedDogs) {
    if (!dog.kennelRunId) {
      continue;
    }

    persistedDogCountByRunId.set(
      dog.kennelRunId,
      (persistedDogCountByRunId.get(dog.kennelRunId) ?? 0) + 1
    );
  }

  return runs.map((run) => ({
    ...run,
    dogCount: dogCountByRunId.get(run.id) ?? 0,
    persistedDogCount: persistedDogCountByRunId.get(run.id) ?? 0,
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
        kind: "PLAYER",
      },
      select: {
        id: true,
        name: true,
        sortOrder: true,
        isSystem: true,
        kind: true,
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
      kind: true,
    },
  });

  if (!run || run.kennelId !== args.kennelId) {
    throw new KennelRunServiceError("Kennel Run not found.", 404);
  }

  if (run.kind === "UNCATEGORIZED") {
    throw new KennelRunServiceError(
      `${UNCATEGORIZED_KENNEL_RUN_NAME} cannot be renamed or reordered.`
    );
  }

  const data: { name?: string } = {};

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
        kind: true,
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

export async function moveKennelRun(args: {
  kennelId: string;
  runId: string;
  direction: unknown;
  client?: KennelRunTransactionRunner;
}) {
  const client =
    args.client ?? (db as unknown as KennelRunTransactionRunner);
  const direction = args.direction as KennelRunMoveDirection;

  if (direction !== "up" && direction !== "down") {
    throw new KennelRunServiceError("direction must be up or down.");
  }

  return client.$transaction(async (tx) => {
    const run = await tx.kennelRun.findUnique({
      where: { id: args.runId },
      select: { id: true, kennelId: true, kind: true },
    });

    if (!run || run.kennelId !== args.kennelId) {
      throw new KennelRunServiceError("Kennel Run not found.", 404);
    }

    if (run.kind === "UNCATEGORIZED") {
      throw new KennelRunServiceError(
        `${UNCATEGORIZED_KENNEL_RUN_NAME} cannot be reordered.`
      );
    }

    const orderedRuns = await tx.kennelRun.findMany({
      where: { kennelId: args.kennelId, kind: { not: "UNCATEGORIZED" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, sortOrder: true },
    });
    const index = orderedRuns.findIndex((candidate) => candidate.id === run.id);
    const neighbor = orderedRuns[index + (direction === "up" ? -1 : 1)];

    if (!neighbor) {
      throw new KennelRunServiceError(
        `This Kennel Run cannot move ${direction}.`,
        409
      );
    }

    await tx.kennelRun.update({
      where: { id: run.id },
      data: { sortOrder: neighbor.sortOrder },
    });
    await tx.kennelRun.update({
      where: { id: neighbor.id },
      data: { sortOrder: orderedRuns[index].sortOrder },
    });

    return { runId: run.id, direction };
  });
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
        kind: true,
      },
    });

    if (!run || run.kennelId !== args.kennelId) {
      throw new KennelRunServiceError("Kennel Run not found.", 404);
    }

    if (run.kind === "UNCATEGORIZED") {
      throw new KennelRunServiceError(
        `${UNCATEGORIZED_KENNEL_RUN_NAME} cannot be deleted.`
      );
    }

    if (run.kind === "LITTER") {
      const deleted = await deleteLitterRunIfEmpty({
        priorRunId: run.id,
        client: tx,
      });

      if (deleted) {
        return { runId: run.id, movedCount: 0 };
      }

      throw new KennelRunServiceError(
        "This litter run will be removed automatically when it is empty."
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
      kennelRunId: true,
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

  const sourceRunIds = new Set(
    dogs
      .map((dog) => dog.kennelRunId)
      .filter((runId): runId is string => Boolean(runId && runId !== targetRun.id))
  );
  await Promise.all(
    [...sourceRunIds].map((priorRunId) =>
      deleteLitterRunIfEmpty({ priorRunId, client })
    )
  );

  return {
    targetRunId: targetRun.id,
    movedCount: moved.count,
  };
}

export async function updateKennelRunDogCallNames(args: {
  kennelId: string;
  kennelRunId: unknown;
  updates: unknown;
  client?: BulkNamingTransactionRunner;
}) {
  const client =
    args.client ?? (db as unknown as BulkNamingTransactionRunner);
  const kennelRunId = String(args.kennelRunId ?? "").trim();

  if (!kennelRunId) {
    throw new KennelRunServiceError("kennelRunId is required.");
  }

  if (!Array.isArray(args.updates) || args.updates.length === 0) {
    throw new KennelRunServiceError("At least one naming update is required.");
  }

  const updatesByDogId = new Map<string, BulkCallNameUpdate>();

  for (const rawUpdate of args.updates) {
    if (!rawUpdate || typeof rawUpdate !== "object") {
      throw new KennelRunServiceError("Each call name update must include a dog.");
    }

    const update = rawUpdate as {
      dogId?: unknown;
      callName?: unknown;
      registeredName?: unknown;
    };
    const dogId = String(update.dogId ?? "").trim();

    if (!dogId) {
      throw new KennelRunServiceError("Each call name update must include a dog.");
    }

    if (update.callName !== undefined && update.callName !== null && typeof update.callName !== "string") {
      throw new KennelRunServiceError("Call names must be text.");
    }

    if (update.registeredName !== undefined && typeof update.registeredName !== "string") {
      throw new KennelRunServiceError("Registered names must be text.");
    }

    const callNameValidation =
      update.callName === undefined
        ? null
        : validateCallName(update.callName ?? null);

    if (callNameValidation && !callNameValidation.ok) {
      throw new KennelRunServiceError(callNameValidation.error);
    }

    updatesByDogId.set(dogId, {
      dogId,
      ...(callNameValidation ? { callName: callNameValidation.name || null } : {}),
      ...(update.registeredName !== undefined
        ? { registeredName: update.registeredName }
        : {}),
    });
  }

  const updates = [...updatesByDogId.values()];

  return client.$transaction(async (tx) => {
    const run = await tx.kennelRun.findUnique({
      where: { id: kennelRunId },
      select: { id: true, kennelId: true },
    });

    if (!run || run.kennelId !== args.kennelId) {
      throw new KennelRunServiceError("Kennel Run not found.", 404);
    }

    const dogs = await tx.dog.findMany({
      where: { id: { in: updates.map((update) => update.dogId) } },
      select: { id: true, ownerKennelId: true, kennelRunId: true, registeredName: true },
    });
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const invalidUpdate = updates.find((update) => {
      const dog = dogsById.get(update.dogId);
      return (
        !dog ||
        dog.ownerKennelId !== args.kennelId ||
        dog.kennelRunId !== kennelRunId
      );
    });

    if (invalidUpdate) {
      throw new KennelRunServiceError(
        "A dog is no longer in this kennel run. Refresh and try again.",
        409
      );
    }

    const requestedRegisteredNames = updates.filter(
      (update): update is BulkCallNameUpdate & { registeredName: string } =>
        update.registeredName !== undefined
    );

    if (requestedRegisteredNames.length > 0) {
      const breeds = await tx.breed.findMany({ select: { name: true } });
      const proposedNames = new Set<string>();

      for (const update of requestedRegisteredNames) {
        const dog = dogsById.get(update.dogId);

        if (dog?.registeredName?.trim()) {
          throw new KennelRunServiceError("This dog already has a registered name.", 409);
        }

        const validation = validateRegisteredDogName(
          update.registeredName,
          breeds.map((breed) => breed.name)
        );

        if (!validation.ok) {
          throw new KennelRunServiceError(validation.error);
        }

        const comparisonName = validation.name.toLowerCase();
        if (proposedNames.has(comparisonName)) {
          throw new KennelRunServiceError("That dog name is already in use.", 409);
        }
        proposedNames.add(comparisonName);
        update.registeredName = validation.name;
      }

      for (const update of requestedRegisteredNames) {
        const existingDog = await tx.dog.findFirst({
          where: {
            id: { not: update.dogId },
            registeredName: {
              equals: update.registeredName,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });

        if (existingDog) {
          throw new KennelRunServiceError("That dog name is already in use.", 409);
        }
      }
    }

    for (const update of updates) {
      const result = await tx.dog.updateMany({
        where: {
          id: update.dogId,
          ownerKennelId: args.kennelId,
          kennelRunId,
        },
        data: {
          ...(update.callName !== undefined ? { callName: update.callName } : {}),
          ...(update.registeredName !== undefined
            ? { registeredName: update.registeredName }
            : {}),
        },
      });

      if (result.count !== 1) {
        throw new KennelRunServiceError(
          "A dog is no longer in this kennel run. Refresh and try again.",
          409
        );
      }
    }

    return { updatedCount: updates.length };
  });
}
