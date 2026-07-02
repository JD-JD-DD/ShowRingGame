import { db } from "@/lib/db";
import type { KennelRun, PrismaClient } from "@prisma/client";

export const UNCATEGORIZED_KENNEL_RUN_NAME = "Uncategorized";

export const STARTER_KENNEL_RUNS = [
  { name: UNCATEGORIZED_KENNEL_RUN_NAME, sortOrder: 0, isSystem: true },
  { name: "Specials", sortOrder: 1, isSystem: false },
  { name: "Brood Bitches", sortOrder: 2, isSystem: false },
  { name: "Stud Dogs", sortOrder: 3, isSystem: false },
  { name: "Puppies", sortOrder: 4, isSystem: false },
  { name: "Sale Prospects", sortOrder: 5, isSystem: false },
  { name: "Retired", sortOrder: 6, isSystem: false },
] as const;

export type KennelRunClient = Pick<PrismaClient, "kennelRun">;

const kennelRunSelect = {
  id: true,
  kennelId: true,
  name: true,
  sortOrder: true,
  isSystem: true,
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
    },
    create: {
      kennelId,
      name: starterRun.name,
      sortOrder: starterRun.sortOrder,
      isSystem: starterRun.isSystem,
    },
    select: kennelRunSelect,
  });
}

export async function ensureUncategorizedKennelRun(args: {
  kennelId: string;
  client?: KennelRunClient;
}): Promise<KennelRun> {
  const client = args.client ?? db;

  return upsertStarterRun(client, args.kennelId, STARTER_KENNEL_RUNS[0]);
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
