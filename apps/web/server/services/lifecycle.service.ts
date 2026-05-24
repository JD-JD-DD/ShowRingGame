import { db } from "@/lib/db";
import { AGE_DEATH_START_HOURS, projectedDeathEpoch } from "@showring/rules";
import { Prisma } from "@prisma/client";

type DbClient = typeof db | Prisma.TransactionClient;

type DeathCandidate = {
  id: string;
  birthEpoch: number;
  deathEpoch: number | null;
  lifecycleState: string;
};

function seeded01(seed: string): number {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 0x100000000;
}

export function getProjectedDogDeathEpoch(dog: {
  id: string;
  birthEpoch: number;
  deathEpoch?: number | null;
}): number {
  return (
    dog.deathEpoch ??
    projectedDeathEpoch({
      birthEpoch: dog.birthEpoch,
      random01: () => seeded01(`${dog.id}:death-age`),
    })
  );
}

async function markDogDeceased(args: {
  client: DbClient;
  dogId: string;
  deathEpoch: number;
}): Promise<boolean> {
  const { client, dogId, deathEpoch } = args;
  const update = await client.dog.updateMany({
    where: {
      id: dogId,
      lifecycleState: "ALIVE",
    },
    data: {
      lifecycleState: "DECEASED",
      deathEpoch,
      marketState: "NOT_FOR_SALE",
    },
  });

  if (update.count === 0) {
    return false;
  }

  await client.dogListing.updateMany({
    where: {
      dogId,
      status: "ACTIVE",
    },
    data: {
      status: "EXPIRED",
      expiresAtEpoch: deathEpoch,
    },
  });

  await client.showEntry.updateMany({
    where: {
      dogId,
      entryStatus: "ENTERED",
      showDay: {
        scheduledEpoch: {
          gte: deathEpoch,
        },
      },
    },
    data: {
      entryStatus: "INELIGIBLE",
    },
  });

  await client.breedingAttempt.updateMany({
    where: {
      damId: dogId,
      status: {
        in: ["INITIATED", "PREGNANT"],
      },
    },
    data: {
      status: "FAILED",
    },
  });

  return true;
}

export async function resolveDogDeaths(args: {
  currentEpoch: number;
  kennelId?: string;
  dogIds?: string[];
  tx?: Prisma.TransactionClient;
}): Promise<{ deceasedDogIds: string[] }> {
  const client = args.tx ?? db;
  const dogIds = args.dogIds?.filter(Boolean);

  if (args.dogIds && (!dogIds || dogIds.length === 0)) {
    return { deceasedDogIds: [] };
  }

  const candidates: DeathCandidate[] = await client.dog.findMany({
    where: {
      lifecycleState: "ALIVE",
      birthEpoch: {
        lte: args.currentEpoch - AGE_DEATH_START_HOURS,
      },
      ...(args.kennelId ? { ownerKennelId: args.kennelId } : {}),
      ...(dogIds && dogIds.length > 0 ? { id: { in: dogIds } } : {}),
    },
    select: {
      id: true,
      birthEpoch: true,
      deathEpoch: true,
      lifecycleState: true,
    },
  });

  const deceasedDogIds: string[] = [];

  for (const dog of candidates) {
    const deathEpoch = getProjectedDogDeathEpoch(dog);

    if (deathEpoch > args.currentEpoch) {
      continue;
    }

    const changed = await markDogDeceased({
      client,
      dogId: dog.id,
      deathEpoch,
    });

    if (changed) {
      deceasedDogIds.push(dog.id);
    }
  }

  return { deceasedDogIds };
}
