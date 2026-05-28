import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import {
  ACCIDENT_ILLNESS_LIFETIME_DEATH_RATE,
  NEONATAL_PUPPY_DEATH_RATE,
  NEONATAL_PUPPY_DEATH_WINDOW_HOURS,
  projectedDeathEpoch,
} from "@showring/rules";
import { Prisma } from "@prisma/client";

type DbClient = typeof db | Prisma.TransactionClient;
export type DogDeathCause =
  | "AGE"
  | "ACCIDENT_ILLNESS"
  | "NEONATAL_PUPPY"
  | "WHELPING_DAM";
const MAX_DEATHS_PER_RESOLUTION = 3;

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
  originType: string;
  litterId: string | null;
};

export type ResolvedDogDeath = {
  dogId: string;
  regNumber: string;
  deathEpoch: number;
  cause: DogDeathCause;
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

function getProjectedAccidentIllnessDeathEpoch(dog: {
  id: string;
  birthEpoch: number;
  deathEpoch?: number | null;
}): number | null {
  if (
    seeded01(`${dog.id}:accident-illness:will-die`) >=
    ACCIDENT_ILLNESS_LIFETIME_DEATH_RATE
  ) {
    return null;
  }

  const ageDeathEpoch = getProjectedDogDeathEpoch(dog);
  const activeLifespanHours = Math.max(1, ageDeathEpoch - dog.birthEpoch);
  const deathOffset = Math.max(
    1,
    Math.floor(
      seeded01(`${dog.id}:accident-illness:death-epoch`) *
        activeLifespanHours
    )
  );

  return dog.birthEpoch + deathOffset;
}

function getProjectedNeonatalPuppyDeathEpoch(dog: {
  id: string;
  birthEpoch: number;
  originType?: string | null;
  litterId?: string | null;
}): number | null {
  if (dog.originType !== "PLAYER_BRED" || !dog.litterId) {
    return null;
  }

  if (
    seeded01(`${dog.id}:neonatal-puppy:will-die`) >=
    NEONATAL_PUPPY_DEATH_RATE
  ) {
    return null;
  }

  return (
    dog.birthEpoch +
    Math.floor(
      seeded01(`${dog.id}:neonatal-puppy:death-epoch`) *
        NEONATAL_PUPPY_DEATH_WINDOW_HOURS
    )
  );
}

export function getProjectedDogDeath(dog: {
  id: string;
  birthEpoch: number;
  deathEpoch?: number | null;
  originType?: string | null;
  litterId?: string | null;
}): { deathEpoch: number; cause: DogDeathCause } {
  const candidates: Array<{ deathEpoch: number; cause: DogDeathCause }> = [
    {
      deathEpoch: getProjectedDogDeathEpoch(dog),
      cause: "AGE",
    },
  ];

  const accidentIllnessDeathEpoch = getProjectedAccidentIllnessDeathEpoch(dog);
  if (accidentIllnessDeathEpoch !== null) {
    candidates.push({
      deathEpoch: accidentIllnessDeathEpoch,
      cause: "ACCIDENT_ILLNESS",
    });
  }

  const neonatalPuppyDeathEpoch = getProjectedNeonatalPuppyDeathEpoch(dog);
  if (neonatalPuppyDeathEpoch !== null) {
    candidates.push({
      deathEpoch: neonatalPuppyDeathEpoch,
      cause: "NEONATAL_PUPPY",
    });
  }

  return candidates.reduce((earliest, candidate) =>
    candidate.deathEpoch < earliest.deathEpoch ? candidate : earliest
  );
}

function deathNoticeBody(displayName: string, cause: DogDeathCause): string {
  switch (cause) {
    case "ACCIDENT_ILLNESS":
      return `${displayName} has died after an illness or accident.`;
    case "NEONATAL_PUPPY":
      return `${displayName} died during the vulnerable first week of life.`;
    case "WHELPING_DAM":
      return `${displayName} died from whelping complications.`;
    case "AGE":
    default:
      return `${displayName} has died of old age.`;
  }
}

function breedingFailureNote(regNumber: string, cause: DogDeathCause): string {
  if (cause === "ACCIDENT_ILLNESS") {
    return `Dam ${regNumber} died after an illness or accident before the breeding could be completed.`;
  }

  return `Dam ${regNumber} died before the breeding could be completed.`;
}

export async function markDogDeceased(args: {
  client: DbClient;
  dogId: string;
  regNumber: string;
  ownerKennelId: string | null;
  displayName: string;
  deathEpoch: number;
  cause: DogDeathCause;
}): Promise<boolean> {
  const {
    client,
    dogId,
    regNumber,
    ownerKennelId,
    displayName,
    deathEpoch,
    cause,
  } = args;
  const update = await client.dog.updateMany({
    where: {
      id: dogId,
      lifecycleState: {
        in: ["ALIVE", "RETIRED"],
      },
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
      notes: breedingFailureNote(regNumber, cause),
    },
  });

  if (ownerKennelId) {
    await createKennelNotice({
      client,
      kennelId: ownerKennelId,
      type: "DOG_DEATH",
      title: "Dog death",
      body: deathNoticeBody(displayName, cause),
      currentEpoch: deathEpoch,
      linkedDogId: dogId,
      metadataJson: {
        cause,
      },
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
      lifecycleState: {
        in: ["ALIVE", "RETIRED"],
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
      originType: true,
      litterId: true,
    },
  });

  const deceasedDogIds: string[] = [];
  const deceasedDogs: ResolvedDogDeath[] = [];
  const dueDeaths = candidates
    .map((dog) => ({
      dog,
      projected: getProjectedDogDeath(dog),
    }))
    .filter(({ projected }) => projected.deathEpoch <= args.currentEpoch)
    .sort(
      (left, right) =>
        left.projected.deathEpoch - right.projected.deathEpoch ||
        left.dog.regNumber.localeCompare(right.dog.regNumber)
    )
    .slice(0, MAX_DEATHS_PER_RESOLUTION);

  for (const { dog, projected } of dueDeaths) {
    const { deathEpoch, cause } = projected;

    const changed = await markDogDeceased({
      client,
      dogId: dog.id,
      regNumber: dog.regNumber,
      ownerKennelId: dog.ownerKennelId,
      displayName: formatDogDisplayName(dog),
      deathEpoch,
      cause,
    });

    if (changed) {
      deceasedDogIds.push(dog.id);
      deceasedDogs.push({
        dogId: dog.id,
        regNumber: dog.regNumber,
        deathEpoch,
        cause,
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

  return resolveDogDeathsWithClient({
    client: db,
    currentEpoch: args.currentEpoch,
    kennelId: args.kennelId,
    dogIds: args.dogIds,
  });
}
