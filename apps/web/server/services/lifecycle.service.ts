import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { AGE_DEATH_START_HOURS, projectedDeathEpoch } from "@showring/rules";
import { Prisma } from "@prisma/client";

type DbClient = typeof db | Prisma.TransactionClient;

type DeathCandidate = {
  id: string;
  regNumber: string;
  registeredName: string | null;
  callName: string | null;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  ownerKennelId: string | null;
  birthEpoch: number;
  deathEpoch: number | null;
  lifecycleState: string;
};

export type ResolvedDogDeath = {
  dogId: string;
  regNumber: string;
  deathEpoch: number;
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
  regNumber: string;
  ownerKennelId: string | null;
  displayName: string;
  deathEpoch: number;
}): Promise<boolean> {
  const { client, dogId, regNumber, ownerKennelId, displayName, deathEpoch } =
    args;
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
      isPregnant: false,
      checkedEpoch: deathEpoch,
      notes: `Dam ${regNumber} died before the breeding could be completed.`,
    },
  });

  if (ownerKennelId) {
    await createKennelNotice({
      client,
      kennelId: ownerKennelId,
      type: "DOG_DEATH",
      title: "Dog death",
      body: `${displayName} has died.`,
      currentEpoch: deathEpoch,
      linkedDogId: dogId,
    });
  }

  return true;
}

async function resolveDogDeathsWithClient(args: {
  client: DbClient;
  currentEpoch: number;
  kennelId?: string;
  dogIds?: string[];
}): Promise<{ deceasedDogIds: string[]; deceasedDogs: ResolvedDogDeath[] }> {
  const { client } = args;
  const dogIds = args.dogIds?.filter(Boolean);

  if (args.dogIds && (!dogIds || dogIds.length === 0)) {
    return { deceasedDogIds: [], deceasedDogs: [] };
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
      regNumber: true,
      registeredName: true,
      callName: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      ownerKennelId: true,
      birthEpoch: true,
      deathEpoch: true,
      lifecycleState: true,
    },
  });

  const deceasedDogIds: string[] = [];
  const deceasedDogs: ResolvedDogDeath[] = [];

  for (const dog of candidates) {
    const deathEpoch = getProjectedDogDeathEpoch(dog);

    if (deathEpoch > args.currentEpoch) {
      continue;
    }

    const changed = await markDogDeceased({
      client,
      dogId: dog.id,
      regNumber: dog.regNumber,
      ownerKennelId: dog.ownerKennelId,
      displayName: formatDogDisplayName(dog),
      deathEpoch,
    });

    if (changed) {
      deceasedDogIds.push(dog.id);
      deceasedDogs.push({
        dogId: dog.id,
        regNumber: dog.regNumber,
        deathEpoch,
      });
    }
  }

  return { deceasedDogIds, deceasedDogs };
}

export async function resolveDogDeaths(args: {
  currentEpoch: number;
  kennelId?: string;
  dogIds?: string[];
  tx?: Prisma.TransactionClient;
}): Promise<{ deceasedDogIds: string[]; deceasedDogs: ResolvedDogDeath[] }> {
  if (args.tx) {
    return resolveDogDeathsWithClient({
      client: args.tx,
      currentEpoch: args.currentEpoch,
      kennelId: args.kennelId,
      dogIds: args.dogIds,
    });
  }

  return db.$transaction((tx) =>
    resolveDogDeathsWithClient({
      client: tx,
      currentEpoch: args.currentEpoch,
      kennelId: args.kennelId,
      dogIds: args.dogIds,
    })
  );
}
