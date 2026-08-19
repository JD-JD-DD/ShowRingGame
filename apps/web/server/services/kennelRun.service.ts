import { db } from "@/lib/db";
import { Prisma, type KennelRun, type PrismaClient } from "@prisma/client";

export const UNCATEGORIZED_KENNEL_RUN_NAME = "Uncategorized";

export const STARTER_KENNEL_RUNS = [
  {
    name: UNCATEGORIZED_KENNEL_RUN_NAME,
    sortOrder: 0,
    isSystem: true,
    kind: "UNCATEGORIZED",
  },
  { name: "Specials", sortOrder: 1, isSystem: false, kind: "PLAYER" },
  {
    name: "Brood Bitches",
    sortOrder: 2,
    isSystem: false,
    kind: "PLAYER",
  },
  { name: "Stud Dogs", sortOrder: 3, isSystem: false, kind: "PLAYER" },
  { name: "Puppies", sortOrder: 4, isSystem: false, kind: "PLAYER" },
  {
    name: "Sale Prospects",
    sortOrder: 5,
    isSystem: false,
    kind: "PLAYER",
  },
  { name: "Retired", sortOrder: 6, isSystem: false, kind: "PLAYER" },
] as const;

export type KennelRunClient = Pick<PrismaClient, "kennelRun">;
export type LitterKennelRunClient = Pick<Prisma.TransactionClient, "kennelRun">;
export type LitterKennelRunCleanupClient = Pick<
  Prisma.TransactionClient,
  "dog" | "kennelRun"
>;

function uniqueRunIds(runIds: Array<string | null | undefined>): string[] {
  return [...new Set(runIds.filter((runId): runId is string => Boolean(runId)))];
}

const kennelRunSelect = {
  id: true,
  kennelId: true,
  name: true,
  sortOrder: true,
  isSystem: true,
  kind: true,
  sourceLitterId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof KennelRun, true>;

async function upsertStarterRun(
  client: KennelRunClient,
  kennelId: string,
  starterRun: (typeof STARTER_KENNEL_RUNS)[number]
): Promise<KennelRun> {
  return client.kennelRun.upsert({
    where: {
      kennelId_name: {
        kennelId,
        name: starterRun.name,
      },
    },
    update: {
      sortOrder: starterRun.sortOrder,
      isSystem: starterRun.isSystem,
      kind: starterRun.kind,
    },
    create: {
      kennelId,
      name: starterRun.name,
      sortOrder: starterRun.sortOrder,
      isSystem: starterRun.isSystem,
      kind: starterRun.kind,
    },
    select: kennelRunSelect,
  });
}

export async function ensureUncategorizedKennelRun(args: {
  kennelId: string;
  client?: KennelRunClient;
}): Promise<KennelRun> {
  const client = args.client ?? db;
  const existing = await client.kennelRun.findFirst({
    where: {
      kennelId: args.kennelId,
      kind: "UNCATEGORIZED",
    },
    select: kennelRunSelect,
  });

  return existing ?? upsertStarterRun(client, args.kennelId, STARTER_KENNEL_RUNS[0]);
}

export function formatLitterKennelRunName(args: {
  breedCode2: string;
  serial7: string;
}): string {
  return `${args.breedCode2}${args.serial7}`;
}

export async function ensureLitterKennelRun(args: {
  kennelId: string;
  litterId: string;
  breedCode2: string;
  serial7: string;
  client: LitterKennelRunClient;
}): Promise<KennelRun> {
  const existing = await args.client.kennelRun.findUnique({
    where: { sourceLitterId: args.litterId },
    select: kennelRunSelect,
  });

  if (existing) {
    return existing;
  }

  const name = formatLitterKennelRunName(args);
  const nameConflict = await args.client.kennelRun.findUnique({
    where: { kennelId_name: { kennelId: args.kennelId, name } },
    select: { id: true },
  });

  if (nameConflict) {
    throw new Error(
      `Cannot create litter Kennel Run: name ${name} is already in use for this kennel.`
    );
  }

  const lastRun = await args.client.kennelRun.findFirst({
    where: { kennelId: args.kennelId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  try {
    return await args.client.kennelRun.create({
      data: {
        kennelId: args.kennelId,
        name,
        sortOrder: (lastRun?.sortOrder ?? -1) + 1,
        isSystem: false,
        kind: "LITTER",
        sourceLitterId: args.litterId,
      },
      select: kennelRunSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentRun = await args.client.kennelRun.findUnique({
        where: { sourceLitterId: args.litterId },
        select: kennelRunSelect,
      });

      if (concurrentRun) {
        return concurrentRun;
      }
    }

    throw error;
  }
}

export async function deleteLitterRunIfEmpty(args: {
  priorRunId: string | null | undefined;
  client: LitterKennelRunCleanupClient;
}): Promise<boolean> {
  if (!args.priorRunId) {
    return false;
  }

  const run = await args.client.kennelRun.findUnique({
    where: { id: args.priorRunId },
    select: { id: true, kind: true, sourceLitterId: true },
  });

  if (
    !run ||
    run.kind !== "LITTER" ||
    run.sourceLitterId === null
  ) {
    return false;
  }

  const dogCount = await args.client.dog.count({
    where: { kennelRunId: run.id },
  });

  if (dogCount > 0) {
    return false;
  }

  try {
    await args.client.kennelRun.delete({ where: { id: run.id } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }

    throw error;
  }
}

export async function deleteEmptyLitterRuns(args: {
  priorRunIds: Array<string | null | undefined>;
  client: LitterKennelRunCleanupClient;
}): Promise<number> {
  const priorRunIds = uniqueRunIds(args.priorRunIds);

  if (priorRunIds.length === 0) {
    return 0;
  }

  const deleted = await args.client.kennelRun.deleteMany({
    where: {
      id: { in: priorRunIds },
      kind: "LITTER",
      sourceLitterId: { not: null },
      dogs: { none: {} },
    },
  });

  return deleted.count;
}

export async function ensureStarterKennelRuns(args: {
  kennelId: string;
  client?: KennelRunClient;
}): Promise<KennelRun[]> {
  const client = args.client ?? db;

  for (const starterRun of STARTER_KENNEL_RUNS) {
    await upsertStarterRun(client, args.kennelId, starterRun);
  }

  return client.kennelRun.findMany({
    where: {
      kennelId: args.kennelId,
      name: {
        in: STARTER_KENNEL_RUNS.map((run) => run.name),
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: kennelRunSelect,
  });
}
