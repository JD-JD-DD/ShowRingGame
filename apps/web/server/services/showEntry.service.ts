import { db } from "@/lib/db";
import { ENTRY_FEE_PER_SHOW, canEnterShows } from "@showring/rules";
import { Prisma } from "@prisma/client";

const showBlockForEntryArgs =
  Prisma.validator<Prisma.ShowJudgingBlockDefaultArgs>()({
    include: {
      showDay: {
        include: {
          cluster: true,
        },
      },
    },
  });

const dogForEntryArgs = Prisma.validator<Prisma.DogDefaultArgs>()({
  select: {
    id: true,
    callName: true,
    registeredName: true,
    regNumber: true,
    breedCode2: true,
    sex: true,
    ownerKennelId: true,
    birthEpoch: true,
    lifecycleState: true,
    marketState: true,
    ringObedience: true,
    muscleTone: true,
    coatCondition: true,
    fatiguePoints: true,
  },
});

type ShowBlockForEntry = Prisma.ShowJudgingBlockGetPayload<
  typeof showBlockForEntryArgs
>;
type DogForEntry = Prisma.DogGetPayload<typeof dogForEntryArgs>;

export type ShowEntryEligibilityResult = {
  ok: boolean;
  reason?: string;
};

export type CreatedShowEntryDto = {
  showEntryId: string;
  showDayId: string;
  judgingBlockId: string;
  dogId: string;
  kennelId: string;
  breedCode2: string;
  feeCharged: number;
};

export type SeedShowEntriesResult = {
  showId: string;
  blocksVisited: number;
  entriesCreated: number;
  skipped: Array<{
    judgingBlockId: string;
    breedCode2: string;
    reason: string;
  }>;
};

export type EligibleShowDogDto = {
  dogId: string;
  displayName: string;
  regNumber: string;
  sex: "M" | "F";
  ageHours: number;
  conditioningSnapshot: number;
  fatigueSnapshot: number;
};

export type EligibleDogsByBlockDto = Record<string, EligibleShowDogDto[]>;

function getDogDisplayName(dog: DogForEntry): string {
  return dog.registeredName || dog.callName || dog.regNumber;
}

function getConditioningSnapshot(dog: DogForEntry): number {
  return Math.round((dog.ringObedience + dog.muscleTone + dog.coatCondition) / 3);
}

function isEntryWindowOpen(args: {
  block: ShowBlockForEntry;
  currentEpoch: number;
}): boolean {
  const { block, currentEpoch } = args;

  return (
    currentEpoch >= block.showDay.cluster.entryOpenEpoch &&
    currentEpoch <= block.showDay.cluster.entryCloseEpoch &&
    block.showDay.cluster.status !== "COMPLETE" &&
    block.showDay.cluster.status !== "CANCELLED" &&
    block.showDay.status === "ENTRY_OPEN" &&
    block.status === "ENTRY_OPEN"
  );
}

export function getShowEntryEligibilityReason(args: {
  dog: DogForEntry;
  block: ShowBlockForEntry;
  currentEpoch: number;
}): string | null {
  const { dog, block, currentEpoch } = args;

  if (block.showDay.cluster.status === "CANCELLED") {
    return "Show cluster is cancelled.";
  }

  if (block.showDay.status === "CANCELLED") {
    return "Show day is cancelled.";
  }

  if (block.status === "CANCELLED") {
    return "Judging block is cancelled.";
  }

  if (block.status === "RESULTS_PUBLISHED" || block.status === "JUDGING") {
    return "Judging block is already in progress or published.";
  }

  if (!isEntryWindowOpen({ block, currentEpoch })) {
    return "Entry window is closed.";
  }

  if (dog.ownerKennelId == null) {
    return "Dog is not owned by a kennel.";
  }

  if (dog.lifecycleState !== "ALIVE") {
    return "Dog is not alive and active.";
  }

  if (dog.marketState === "SOLD_PENDING_TRANSFER") {
    return "Dog has a pending transfer.";
  }

  if (dog.breedCode2 !== block.breedCode2) {
    return "Dog breed does not match the judging block.";
  }

  if (!canEnterShows(currentEpoch, dog.birthEpoch, dog.lifecycleState)) {
    return "Dog is not show-age eligible.";
  }

  return null;
}

export function canEnterShowBlock(args: {
  dog: DogForEntry;
  block: ShowBlockForEntry;
  currentEpoch: number;
}): ShowEntryEligibilityResult {
  const reason = getShowEntryEligibilityReason(args);

  if (reason) {
    return { ok: false, reason };
  }

  return { ok: true };
}

async function createShowEntryWithTx(args: {
  tx: Prisma.TransactionClient;
  dog: DogForEntry;
  block: ShowBlockForEntry;
  currentEpoch: number;
  handlerUsed?: boolean;
}): Promise<CreatedShowEntryDto> {
  const { tx, dog, block, currentEpoch, handlerUsed = false } = args;
  const eligibility = canEnterShowBlock({ dog, block, currentEpoch });

  if (!eligibility.ok) {
    throw new Error(eligibility.reason ?? "Dog is not eligible for this show.");
  }

  if (!dog.ownerKennelId) {
    throw new Error("Dog is not owned by a kennel.");
  }

  const duplicateEntry = await tx.showEntry.findUnique({
    where: {
      showDayId_dogId: {
        showDayId: block.showDayId,
        dogId: dog.id,
      },
    },
    select: { id: true },
  });

  if (duplicateEntry) {
    throw new Error("Dog is already entered on this show day.");
  }

  const kennel = await tx.kennel.findUnique({
    where: { id: dog.ownerKennelId },
    select: { id: true, balance: true },
  });

  if (!kennel) {
    throw new Error("Owner kennel not found.");
  }

  if (kennel.balance < ENTRY_FEE_PER_SHOW) {
    throw new Error("Insufficient funds for show entry.");
  }

  const balanceAfter = kennel.balance - ENTRY_FEE_PER_SHOW;

  await tx.kennel.update({
    where: { id: kennel.id },
    data: { balance: balanceAfter },
  });

  const entry = await tx.showEntry.create({
    data: {
      showDayId: block.showDayId,
      judgingBlockId: block.id,
      dogId: dog.id,
      kennelId: kennel.id,
      breedCode2: dog.breedCode2,
      entryStatus: "ENTERED",
      enteredAtEpoch: currentEpoch,
      feeCharged: ENTRY_FEE_PER_SHOW,
      handlerUsed,
      conditioningSnapshot: getConditioningSnapshot(dog),
      fatigueSnapshot: dog.fatiguePoints,
    },
    select: {
      id: true,
      showDayId: true,
      judgingBlockId: true,
      dogId: true,
      kennelId: true,
      breedCode2: true,
      feeCharged: true,
    },
  });

  await tx.ledgerTransaction.create({
    data: {
      kennelId: kennel.id,
      transactionType: "SHOW_ENTRY_FEE",
      amount: -ENTRY_FEE_PER_SHOW,
      balanceAfter,
      occurredAtEpoch: currentEpoch,
      dogId: dog.id,
      showClusterId: block.showDay.clusterId,
      showEntryId: entry.id,
      memo: `Entered dog ${dog.regNumber} in ${block.breedCode2}.`,
    },
  });

  return {
    showEntryId: entry.id,
    showDayId: entry.showDayId,
    judgingBlockId: entry.judgingBlockId ?? block.id,
    dogId: entry.dogId,
    kennelId: entry.kennelId,
    breedCode2: entry.breedCode2,
    feeCharged: entry.feeCharged,
  };
}

export async function createShowEntry(args: {
  dogId: string;
  judgingBlockId: string;
  currentEpoch: number;
  ownerKennelId?: string;
  handlerUsed?: boolean;
}): Promise<CreatedShowEntryDto> {
  const { dogId, judgingBlockId, currentEpoch, ownerKennelId, handlerUsed } = args;

  return db.$transaction(async (tx) => {
    const [dog, block] = await Promise.all([
      tx.dog.findUnique({
        where: { id: dogId },
        ...dogForEntryArgs,
      }),
      tx.showJudgingBlock.findUnique({
        where: { id: judgingBlockId },
        ...showBlockForEntryArgs,
      }),
    ]);

    if (!dog) {
      throw new Error("Dog not found.");
    }

    if (!block) {
      throw new Error("Judging block not found.");
    }

    if (ownerKennelId && dog.ownerKennelId !== ownerKennelId) {
      throw new Error("You do not own this dog.");
    }

    return createShowEntryWithTx({
      tx,
      dog,
      block,
      currentEpoch,
      handlerUsed,
    });
  });
}

export async function listEligibleDogsByShowBlock(args: {
  showId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<EligibleDogsByBlockDto> {
  const { showId, kennelId, currentEpoch } = args;
  const blocks = await db.showJudgingBlock.findMany({
    where: {
      showDay: {
        clusterId: showId,
      },
    },
    orderBy: [
      { startEpoch: "asc" },
      { ringNumber: "asc" },
      { blockOrder: "asc" },
    ],
    ...showBlockForEntryArgs,
  });
  const breedCodes = [...new Set(blocks.map((block) => block.breedCode2))];
  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennelId,
      breedCode2: { in: breedCodes },
      showEntries: {
        none: {
          showDay: {
            clusterId: showId,
          },
        },
      },
    },
    orderBy: [{ breedCode2: "asc" }, { registeredName: "asc" }, { regNumber: "asc" }],
    ...dogForEntryArgs,
  });
  const dogsByBreed = new Map<string, DogForEntry[]>();

  for (const dog of dogs) {
    const breedDogs = dogsByBreed.get(dog.breedCode2) ?? [];
    breedDogs.push(dog);
    dogsByBreed.set(dog.breedCode2, breedDogs);
  }

  return Object.fromEntries(
    blocks.map((block) => [
      block.id,
      (dogsByBreed.get(block.breedCode2) ?? [])
        .filter((dog) => canEnterShowBlock({ dog, block, currentEpoch }).ok)
        .map((dog) => ({
          dogId: dog.id,
          displayName: getDogDisplayName(dog),
          regNumber: dog.regNumber,
          sex: dog.sex,
          ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
          conditioningSnapshot: getConditioningSnapshot(dog),
          fatigueSnapshot: dog.fatiguePoints,
        })),
    ])
  );
}

export async function listEligibleDogsForShowBlock(args: {
  judgingBlockId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<EligibleShowDogDto[]> {
  const { judgingBlockId, kennelId, currentEpoch } = args;
  const block = await db.showJudgingBlock.findUnique({
    where: { id: judgingBlockId },
    ...showBlockForEntryArgs,
  });

  if (!block) {
    return [];
  }

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennelId,
      breedCode2: block.breedCode2,
      showEntries: {
        none: {
          showDayId: block.showDayId,
        },
      },
    },
    orderBy: [{ registeredName: "asc" }, { regNumber: "asc" }],
    ...dogForEntryArgs,
  });

  return dogs
    .filter((dog) => canEnterShowBlock({ dog, block, currentEpoch }).ok)
    .map((dog) => ({
      dogId: dog.id,
      displayName: getDogDisplayName(dog),
      regNumber: dog.regNumber,
      sex: dog.sex,
      ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
      conditioningSnapshot: getConditioningSnapshot(dog),
      fatigueSnapshot: dog.fatiguePoints,
    }));
}

export async function seedTestEntriesForShow(args: {
  showId: string;
  currentEpoch: number;
}): Promise<SeedShowEntriesResult> {
  const { showId, currentEpoch } = args;
  const result: SeedShowEntriesResult = {
    showId,
    blocksVisited: 0,
    entriesCreated: 0,
    skipped: [],
  };

  const blocks = await db.showJudgingBlock.findMany({
    where: {
      showDay: {
        clusterId: showId,
      },
    },
    orderBy: [
      { startEpoch: "asc" },
      { ringNumber: "asc" },
      { blockOrder: "asc" },
    ],
    ...showBlockForEntryArgs,
  });

  for (const block of blocks) {
    result.blocksVisited += 1;

    const targetCount = Math.max(1, block.entryCountHint ?? 1);
    const dogs = await db.dog.findMany({
      where: {
        breedCode2: block.breedCode2,
        lifecycleState: "ALIVE",
        ownerKennelId: { not: null },
        showEntries: {
          none: {
            showDayId: block.showDayId,
          },
        },
      },
      orderBy: [{ ownerKennelId: "asc" }, { birthEpoch: "asc" }],
      take: targetCount,
      ...dogForEntryArgs,
    });

    if (dogs.length === 0) {
      result.skipped.push({
        judgingBlockId: block.id,
        breedCode2: block.breedCode2,
        reason: "No owned eligible candidate dogs found for this breed.",
      });
      continue;
    }

    for (const dog of dogs) {
      try {
        await db.$transaction(async (tx) => {
          await createShowEntryWithTx({
            tx,
            dog,
            block,
            currentEpoch,
          });
        });

        result.entriesCreated += 1;
      } catch (error) {
        result.skipped.push({
          judgingBlockId: block.id,
          breedCode2: block.breedCode2,
          reason:
            error instanceof Error
              ? `${dog.regNumber}: ${error.message}`
              : `${dog.regNumber}: Failed to create entry.`,
        });
      }
    }
  }

  return result;
}
