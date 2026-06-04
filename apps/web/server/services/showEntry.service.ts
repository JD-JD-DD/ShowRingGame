import { db } from "@/lib/db";
import { hasAllGreenPhenotypeHealthTests } from "@/lib/dogHealth";
import { formatDogDisplayName } from "@/lib/dogNames";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import {
  getShowBlockEntryAvailability,
  getShowDayEntryAvailability,
} from "@/server/services/showAvailability.service";
import {
  DAM_SHOW_POST_WHELP_COOLDOWN_HOURS,
  ENTRY_FEE_PER_SHOW,
  SHOW_WEEK_HOURS,
  canEnterShows,
  getClusterEntryQuote,
  getGeneratedShowWeekendPrefix,
  getShowDistrictRegionName,
  getShowWeekendKey,
  getShowWeekendStartEpoch,
} from "@showring/rules";
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
    visibleTitlePrefix: true,
    visibleTitleSuffix: true,
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
    healthTests: {
      where: {
        isPublic: true,
      },
      orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
      select: {
        testTypeCode: true,
        resultCode: true,
      },
    },
    breedingAttemptsAsDam: {
      where: {
        OR: [
          { status: "PREGNANT" },
          { status: "WHELPED", whelpedEpoch: { not: null } },
        ],
      },
      orderBy: {
        whelpedEpoch: "desc",
      },
      select: {
        status: true,
        whelpedEpoch: true,
      },
    },
  },
});

function isUniqueShowEntryError(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("showDayId") && target.includes("dogId");
  }

  return typeof target === "string" && target.includes("showDayId");
}

function duplicateShowEntryError(): Error {
  return new Error(
    "One or more selected dogs are already entered for that show day."
  );
}

type ShowBlockForEntry = Prisma.ShowJudgingBlockGetPayload<
  typeof showBlockForEntryArgs
>;
type DogForEntry = Prisma.DogGetPayload<typeof dogForEntryArgs>;

type WeekendCluster = {
  id: string;
  startEpoch: number;
};

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
  hasAllGreenHealthTests: boolean;
};

export type EligibleDogsByBlockDto = Record<string, EligibleShowDogDto[]>;

export type ShowEntryPlannerDayDto = {
  showDayId: string;
  dayIndex: number;
  scheduledEpoch: number;
  judgeName: string;
  status: string;
};

export type ShowEntryBreedOptionDto = {
  code2: string;
  name: string;
  eligibleDogCount: number;
};

export type ShowEntryPlannerDogDto = EligibleShowDogDto & {
  eligibleShowDayIds: string[];
  alreadyEnteredShowDayIds: string[];
};

export type ShowEntryPlannerDto = {
  days: ShowEntryPlannerDayDto[];
  dogs: ShowEntryPlannerDogDto[];
  existingDogIdsForBreed: string[];
};

export type ShowWeekendEntryPlanStatusDto = {
  weekendKey: string;
  primaryClusterId: string | null;
  primaryClusterName: string | null;
  isPrimaryShow: boolean;
};

export type BulkShowEntrySelection = {
  dogId: string;
  showDayId: string;
};

export type BulkShowEntryQuoteDto = {
  entryFees: number;
  travelCost: number;
  handlerFeeType: "RINGSIDE" | "TRAVELING";
  handlerDogs: number;
  handlerFee: number;
  totalCost: number;
  balanceAfter: number;
};

export type BulkShowEntryResultDto = {
  showId: string;
  breedCode2: string;
  entriesCreated: number;
  dogsEntered: number;
  quote: BulkShowEntryQuoteDto;
};

function getDogDisplayName(dog: DogForEntry): string {
  return formatDogDisplayName(dog);
}

function getConditioningSnapshot(dog: DogForEntry): number {
  return Math.round((dog.ringObedience + dog.muscleTone + dog.coatCondition) / 3);
}

function getShowReproState(dog: DogForEntry) {
  const latestWhelp = dog.breedingAttemptsAsDam.find(
    (attempt) => attempt.status === "WHELPED" && attempt.whelpedEpoch != null
  );

  return {
    isPregnant: dog.breedingAttemptsAsDam.some(
      (attempt) => attempt.status === "PREGNANT"
    ),
    lastWhelpedEpoch: latestWhelp?.whelpedEpoch ?? null,
  };
}

function getShowReproEligibilityReason(
  dog: DogForEntry,
  showEpoch: number
): string | null {
  const repro = getShowReproState(dog);

  if (repro.isPregnant) {
    return "Bitch cannot be shown after pregnancy confirmation.";
  }

  if (
    repro.lastWhelpedEpoch != null &&
    showEpoch < repro.lastWhelpedEpoch + DAM_SHOW_POST_WHELP_COOLDOWN_HOURS
  ) {
    return "Bitch cannot be shown until 8 weeks after whelping.";
  }

  return null;
}

function getSameWeekendClusterWhere(
  cluster: WeekendCluster
): Prisma.ShowClusterWhereInput {
  const generatedPrefix = getGeneratedShowWeekendPrefix(cluster.id);

  if (generatedPrefix) {
    return {
      id: {
        startsWith: generatedPrefix,
      },
    };
  }

  const weekStartEpoch = getShowWeekendStartEpoch(cluster.startEpoch);

  return {
    startEpoch: {
      gte: weekStartEpoch,
      lt: weekStartEpoch + SHOW_WEEK_HOURS,
    },
  };
}

function getWeekendKeyForCluster(cluster: WeekendCluster): string {
  return getShowWeekendKey({
    clusterId: cluster.id,
    startEpoch: cluster.startEpoch,
  });
}

async function getShowWeekendPlanStatusWithClient(args: {
  client: typeof db | Prisma.TransactionClient;
  showId: string;
  kennelId: string;
}): Promise<ShowWeekendEntryPlanStatusDto | null> {
  const cluster = await args.client.showCluster.findUnique({
    where: { id: args.showId },
    select: {
      id: true,
      startEpoch: true,
    },
  });

  if (!cluster) {
    return null;
  }

  const weekendKey = getWeekendKeyForCluster(cluster);
  const plan = await args.client.kennelShowWeekendPlan.findUnique({
    where: {
      kennelId_weekendKey: {
        kennelId: args.kennelId,
        weekendKey,
      },
    },
    select: {
      primaryClusterId: true,
      primaryCluster: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    weekendKey,
    primaryClusterId: plan?.primaryClusterId ?? null,
    primaryClusterName: plan?.primaryCluster.name ?? null,
    isPrimaryShow: plan?.primaryClusterId === args.showId,
  };
}

async function getDogIdsWithSameWeekendEntries(args: {
  client: typeof db | Prisma.TransactionClient;
  dogIds: string[];
  cluster: WeekendCluster;
  excludeClusterId?: string;
}): Promise<Set<string>> {
  const dogIds = [...new Set(args.dogIds)].filter(Boolean);

  if (dogIds.length === 0) {
    return new Set();
  }

  const entries = await args.client.showEntry.findMany({
    where: {
      dogId: {
        in: dogIds,
      },
      entryStatus: "ENTERED",
      showDay: {
        ...(args.excludeClusterId
          ? {
              clusterId: {
                not: args.excludeClusterId,
              },
            }
          : {}),
        cluster: getSameWeekendClusterWhere(args.cluster),
      },
    },
    select: {
      dogId: true,
    },
  });

  return new Set(entries.map((entry) => entry.dogId));
}

async function getSameWeekendEntryConflict(args: {
  client: typeof db | Prisma.TransactionClient;
  dogIds: string[];
  cluster: WeekendCluster;
  excludeClusterId: string;
}) {
  const dogIds = [...new Set(args.dogIds)].filter(Boolean);

  if (dogIds.length === 0) {
    return null;
  }

  return args.client.showEntry.findFirst({
    where: {
      dogId: {
        in: dogIds,
      },
      entryStatus: "ENTERED",
      showDay: {
        clusterId: {
          not: args.excludeClusterId,
        },
        cluster: getSameWeekendClusterWhere(args.cluster),
      },
    },
    select: {
      dog: {
        select: {
          regNumber: true,
        },
      },
      showDay: {
        select: {
          cluster: {
            select: {
              name: true,
              district: true,
            },
          },
        },
      },
    },
  });
}

export async function getShowWeekendEntryPlanStatus(args: {
  showId: string;
  kennelId: string;
}): Promise<ShowWeekendEntryPlanStatusDto | null> {
  return getShowWeekendPlanStatusWithClient({
    client: db,
    showId: args.showId,
    kennelId: args.kennelId,
  });
}

function getShowDayEntryEligibilityReason(args: {
  dog: DogForEntry;
  cluster: {
    entryOpenEpoch: number;
    entryCloseEpoch: number;
    status: string;
  };
  showDay: {
    status: string;
    scheduledEpoch: number;
  };
  breedCode2: string;
  currentEpoch: number;
}): string | null {
  const { dog, cluster, showDay, breedCode2, currentEpoch } = args;
  const dayAvailability = getShowDayEntryAvailability({
    cluster,
    showDay,
    currentEpoch,
  });

  if (!dayAvailability.canEnter) {
    return dayAvailability.message;
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

  if (dog.breedCode2 !== breedCode2) {
    return "Dog breed does not match the selected breed.";
  }

  const reproReason = getShowReproEligibilityReason(dog, showDay.scheduledEpoch);

  if (reproReason) {
    return reproReason;
  }

  if (
    !canEnterShows(
      showDay.scheduledEpoch,
      dog.birthEpoch,
      dog.lifecycleState,
      getShowReproState(dog)
    )
  ) {
    return "Dog is not eligible to be shown on this show day.";
  }

  return null;
}

function uniqueSelections(
  selections: BulkShowEntrySelection[]
): BulkShowEntrySelection[] {
  const seen = new Set<string>();
  const result: BulkShowEntrySelection[] = [];

  for (const selection of selections) {
    const dogId = selection.dogId.trim();
    const showDayId = selection.showDayId.trim();

    if (!dogId || !showDayId) {
      continue;
    }

    const key = `${dogId}:${showDayId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({ dogId, showDayId });
  }

  return result;
}

export function getShowEntryEligibilityReason(args: {
  dog: DogForEntry;
  block: ShowBlockForEntry;
  currentEpoch: number;
}): string | null {
  const { dog, block, currentEpoch } = args;
  const blockAvailability = getShowBlockEntryAvailability({
    block,
    currentEpoch,
  });

  if (!blockAvailability.canEnter) {
    return blockAvailability.message;
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

  const reproReason = getShowReproEligibilityReason(dog, block.startEpoch);

  if (reproReason) {
    return reproReason;
  }

  if (
    !canEnterShows(
      block.startEpoch,
      dog.birthEpoch,
      dog.lifecycleState,
      getShowReproState(dog)
    )
  ) {
    return "Dog is not eligible to be shown in this judging block.";
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

  const weekendConflict = await getSameWeekendEntryConflict({
    client: tx,
    dogIds: [dog.id],
    cluster: block.showDay.cluster,
    excludeClusterId: block.showDay.clusterId,
  });

  if (weekendConflict) {
    throw new Error(
      `${dog.regNumber} is already entered in ${weekendConflict.showDay.cluster.name} (${getShowDistrictRegionName(weekendConflict.showDay.cluster.district)}) this weekend.`
    );
  }

  const kennel = await tx.kennel.findUnique({
    where: { id: dog.ownerKennelId },
    select: { id: true, name: true, slug: true, balance: true },
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

  const entry = await tx.showEntry
    .create({
      data: {
        showDayId: block.showDayId,
        judgingBlockId: block.id,
        dogId: dog.id,
        kennelId: kennel.id,
        enteredKennelId: kennel.id,
        enteredKennelName: kennel.name,
        enteredKennelSlug: kennel.slug,
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
    })
    .catch((error: unknown) => {
      if (isUniqueShowEntryError(error)) {
        throw duplicateShowEntryError();
      }

      throw error;
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

  await resolveDogDeaths({
    currentEpoch,
    ...(ownerKennelId ? { kennelId: ownerKennelId } : { dogIds: [dogId] }),
  });

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

export async function pullShowEntry(args: {
  showEntryId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<void> {
  const { showEntryId, kennelId, currentEpoch } = args;

  await db.$transaction(async (tx) => {
    const entry = await tx.showEntry.findUnique({
      where: { id: showEntryId },
      select: {
        id: true,
        kennelId: true,
        entryStatus: true,
        showDay: {
          select: {
            scheduledEpoch: true,
            status: true,
            cluster: {
              select: {
                status: true,
              },
            },
          },
        },
        judgingBlock: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!entry) {
      throw new Error("Show entry not found.");
    }

    if (entry.kennelId !== kennelId) {
      throw new Error("You do not own this show entry.");
    }

    if (entry.entryStatus === "ABSENT") {
      return;
    }

    if (entry.entryStatus !== "ENTERED") {
      throw new Error("Only current show entries can be pulled.");
    }

    if (
      currentEpoch >= entry.showDay.scheduledEpoch ||
      entry.showDay.status === "JUDGING" ||
      entry.showDay.status === "RESULTS_PUBLISHED" ||
      entry.showDay.status === "CANCELLED" ||
      entry.showDay.cluster.status === "CANCELLED" ||
      entry.judgingBlock?.status === "JUDGING" ||
      entry.judgingBlock?.status === "RESULTS_PUBLISHED" ||
      entry.judgingBlock?.status === "CANCELLED"
    ) {
      throw new Error("This dog can no longer be pulled from the show.");
    }

    const update = await tx.showEntry.updateMany({
      where: {
        id: entry.id,
        entryStatus: "ENTERED",
      },
      data: {
        entryStatus: "ABSENT",
      },
    });

    if (update.count === 0) {
      throw new Error("This show entry is no longer available to pull.");
    }
  });
}

export async function listEligibleDogsByShowBlock(args: {
  showId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<EligibleDogsByBlockDto> {
  const { showId, kennelId, currentEpoch } = args;
  await resolveDogDeaths({ kennelId, currentEpoch });

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
  const weekendConflictDogIds =
    blocks[0] == null
      ? new Set<string>()
      : await getDogIdsWithSameWeekendEntries({
          client: db,
          dogIds: dogs.map((dog) => dog.id),
          cluster: blocks[0].showDay.cluster,
          excludeClusterId: showId,
        });
  const dogsByBreed = new Map<string, DogForEntry[]>();

  for (const dog of dogs) {
    if (weekendConflictDogIds.has(dog.id)) {
      continue;
    }

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
          hasAllGreenHealthTests: hasAllGreenPhenotypeHealthTests(
            dog.healthTests
          ),
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
  await resolveDogDeaths({ kennelId, currentEpoch });

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
  const weekendConflictDogIds = await getDogIdsWithSameWeekendEntries({
    client: db,
    dogIds: dogs.map((dog) => dog.id),
    cluster: block.showDay.cluster,
    excludeClusterId: block.showDay.clusterId,
  });

  return dogs
    .filter((dog) => !weekendConflictDogIds.has(dog.id))
    .filter((dog) => canEnterShowBlock({ dog, block, currentEpoch }).ok)
    .map((dog) => ({
      dogId: dog.id,
      displayName: getDogDisplayName(dog),
      regNumber: dog.regNumber,
      sex: dog.sex,
      ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
      conditioningSnapshot: getConditioningSnapshot(dog),
      fatigueSnapshot: dog.fatiguePoints,
      hasAllGreenHealthTests: hasAllGreenPhenotypeHealthTests(dog.healthTests),
    }));
}

export async function listShowEntryBreedOptions(args: {
  showId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<ShowEntryBreedOptionDto[]> {
  const { showId, kennelId, currentEpoch } = args;
  await resolveDogDeaths({ kennelId, currentEpoch });

  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        select: {
          id: true,
          status: true,
          scheduledEpoch: true,
        },
      },
    },
  });

  if (!cluster) {
    return [];
  }

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennelId,
      lifecycleState: "ALIVE",
    },
    orderBy: [{ breedCode2: "asc" }, { registeredName: "asc" }, { regNumber: "asc" }],
    include: {
      breed: { select: { code2: true, name: true } },
      breedingAttemptsAsDam: {
        where: {
          OR: [
            { status: "PREGNANT" },
            { status: "WHELPED", whelpedEpoch: { not: null } },
          ],
        },
        orderBy: {
          whelpedEpoch: "desc",
        },
        select: {
          status: true,
          whelpedEpoch: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          testTypeCode: true,
          resultCode: true,
        },
      },
    },
  });
  const weekendConflictDogIds = await getDogIdsWithSameWeekendEntries({
    client: db,
    dogIds: dogs.map((dog) => dog.id),
    cluster,
    excludeClusterId: cluster.id,
  });
  const optionByBreed = new Map<string, ShowEntryBreedOptionDto>();

  for (const dog of dogs) {
    if (weekendConflictDogIds.has(dog.id)) {
      continue;
    }

    const hasEligibleDay = cluster.showDays.some((showDay) => {
      const reason = getShowDayEntryEligibilityReason({
        dog,
        cluster,
        showDay,
        breedCode2: dog.breedCode2,
        currentEpoch,
      });

      return reason == null;
    });

    if (!hasEligibleDay) {
      continue;
    }

    const existing = optionByBreed.get(dog.breedCode2);

    if (existing) {
      existing.eligibleDogCount += 1;
    } else {
      optionByBreed.set(dog.breedCode2, {
        code2: dog.breed.code2,
        name: dog.breed.name,
        eligibleDogCount: 1,
      });
    }
  }

  return [...optionByBreed.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getShowEntryPlanner(args: {
  showId: string;
  kennelId: string;
  breedCode2: string;
  currentEpoch: number;
  selectedDogIds?: Set<string>;
}): Promise<ShowEntryPlannerDto> {
  const { showId, kennelId, breedCode2, currentEpoch, selectedDogIds } = args;
  await resolveDogDeaths({ kennelId, currentEpoch });

  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judge: { select: { name: true } },
        },
      },
    },
  });

  if (!cluster) {
    return { days: [], dogs: [], existingDogIdsForBreed: [] };
  }

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennelId,
      breedCode2,
      ...(selectedDogIds && selectedDogIds.size > 0
        ? { id: { in: [...selectedDogIds] } }
        : {}),
    },
    orderBy: [{ registeredName: "asc" }, { regNumber: "asc" }],
    ...dogForEntryArgs,
  });
  const weekendConflictDogIds = await getDogIdsWithSameWeekendEntries({
    client: db,
    dogIds: dogs.map((dog) => dog.id),
    cluster,
    excludeClusterId: cluster.id,
  });
  const existingEntries = await db.showEntry.findMany({
    where: {
      kennelId,
      breedCode2,
      showDay: { clusterId: showId },
      dogId: { in: dogs.map((dog) => dog.id) },
    },
    select: {
      dogId: true,
      showDayId: true,
    },
  });
  const existingBreedDogEntries = await db.showEntry.findMany({
    where: {
      kennelId,
      breedCode2,
      showDay: { clusterId: showId },
    },
    distinct: ["dogId"],
    select: {
      dogId: true,
    },
  });
  const enteredDayIdsByDogId = new Map<string, Set<string>>();

  for (const entry of existingEntries) {
    const enteredDayIds = enteredDayIdsByDogId.get(entry.dogId) ?? new Set<string>();
    enteredDayIds.add(entry.showDayId);
    enteredDayIdsByDogId.set(entry.dogId, enteredDayIds);
  }

  const days = cluster.showDays.map((showDay) => ({
    showDayId: showDay.id,
    dayIndex: showDay.dayIndex,
    scheduledEpoch: showDay.scheduledEpoch,
    judgeName: showDay.judge.name,
    status: showDay.status,
  }));

  return {
    days,
    existingDogIdsForBreed: existingBreedDogEntries.map((entry) => entry.dogId),
    dogs: dogs
      .filter((dog) => !weekendConflictDogIds.has(dog.id))
      .map((dog) => {
        const alreadyEnteredShowDayIds = [
          ...(enteredDayIdsByDogId.get(dog.id) ?? new Set<string>()),
        ];
        const eligibleShowDayIds = cluster.showDays
          .filter((showDay) => {
            if (alreadyEnteredShowDayIds.includes(showDay.id)) {
              return false;
            }

            return (
              getShowDayEntryEligibilityReason({
                dog,
                cluster,
                showDay,
                breedCode2,
                currentEpoch,
              }) == null
            );
          })
          .map((showDay) => showDay.id);

        return {
          dogId: dog.id,
          displayName: getDogDisplayName(dog),
          regNumber: dog.regNumber,
          sex: dog.sex,
          ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
          conditioningSnapshot: getConditioningSnapshot(dog),
          fatigueSnapshot: dog.fatiguePoints,
          hasAllGreenHealthTests: hasAllGreenPhenotypeHealthTests(
            dog.healthTests
          ),
          eligibleShowDayIds,
          alreadyEnteredShowDayIds,
        };
      })
      .filter(
        (dog) =>
          dog.eligibleShowDayIds.length > 0 ||
          dog.alreadyEnteredShowDayIds.length > 0
      ),
  };
}

async function ensureBreedBlockForEntry(args: {
  tx: Prisma.TransactionClient;
  showDay: {
    id: string;
    judgeId: string;
    scheduledEpoch: number;
    status: string;
  };
  breedCode2: string;
}): Promise<string> {
  const { tx, showDay, breedCode2 } = args;
  const existingBlock = await tx.showJudgingBlock.findFirst({
    where: {
      showDayId: showDay.id,
      breedCode2,
    },
    select: { id: true },
  });

  if (existingBlock) {
    return existingBlock.id;
  }

  const lastBlock = await tx.showJudgingBlock.findFirst({
    where: { showDayId: showDay.id },
    orderBy: [{ blockOrder: "desc" }],
    select: { blockOrder: true },
  });

  const createdBlock = await tx.showJudgingBlock.create({
    data: {
      showDayId: showDay.id,
      judgeId: showDay.judgeId,
      breedCode2,
      ringNumber: 1,
      ringName: "Breed Judging",
      startEpoch: showDay.scheduledEpoch,
      classType: "REGULAR",
      blockOrder: (lastBlock?.blockOrder ?? 0) + 1,
      status: showDay.status === "ENTRY_OPEN" ? "ENTRY_OPEN" : "SCHEDULED",
    },
    select: { id: true },
  });

  return createdBlock.id;
}

export async function createShowEntriesForCluster(args: {
  showId: string;
  kennelId: string;
  breedCode2: string;
  selections: BulkShowEntrySelection[];
  currentEpoch: number;
}): Promise<BulkShowEntryResultDto> {
  const { showId, kennelId, currentEpoch } = args;
  await resolveDogDeaths({ kennelId, currentEpoch });

  const breedCode2 = args.breedCode2.trim().toUpperCase();
  const selections = uniqueSelections(args.selections);

  if (!breedCode2) {
    throw new Error("Choose a breed to enter.");
  }

  if (selections.length === 0) {
    throw new Error("Select at least one dog and show day.");
  }

  return db.$transaction(async (tx) => {
    const cluster = await tx.showCluster.findUnique({
      where: { id: showId },
      include: {
        showDays: {
          orderBy: [{ dayIndex: "asc" }],
          select: {
            id: true,
            dayIndex: true,
            scheduledEpoch: true,
            status: true,
            judgeId: true,
          },
        },
      },
    });

    if (!cluster) {
      throw new Error("Show cluster not found.");
    }

    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: { id: true, name: true, slug: true, balance: true, homeDistrict: true },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    const weekendKey = getWeekendKeyForCluster(cluster);
    const weekendPlan = await tx.kennelShowWeekendPlan.findUnique({
      where: {
        kennelId_weekendKey: {
          kennelId: kennel.id,
          weekendKey,
        },
      },
      select: {
        primaryClusterId: true,
        primaryCluster: {
          select: {
            name: true,
            district: true,
          },
        },
      },
    });

    const showRole =
      weekendPlan && weekendPlan.primaryClusterId !== cluster.id
        ? "SECONDARY"
        : "PRIMARY";

    const dayById = new Map(cluster.showDays.map((day) => [day.id, day]));
    const dogIds = [...new Set(selections.map((selection) => selection.dogId))];
    const dogs = await tx.dog.findMany({
      where: { id: { in: dogIds } },
      ...dogForEntryArgs,
    });
    const dogById = new Map(dogs.map((dog) => [dog.id, dog]));

    if (dogs.length !== dogIds.length) {
      throw new Error("One or more selected dogs could not be found.");
    }

    const existingEntries = await tx.showEntry.findMany({
      where: {
        dogId: { in: dogIds },
        showDayId: { in: selections.map((selection) => selection.showDayId) },
      },
      select: {
        dogId: true,
        showDayId: true,
      },
    });
    const existingEntryKeys = new Set(
      existingEntries.map((entry) => `${entry.dogId}:${entry.showDayId}`)
    );
    const existingBreedDogEntries = await tx.showEntry.findMany({
      where: {
        kennelId,
        breedCode2,
        showDay: { clusterId: showId },
      },
      distinct: ["dogId"],
      select: {
        dogId: true,
      },
    });
    const weekendConflict = await getSameWeekendEntryConflict({
      client: tx,
      dogIds,
      cluster,
      excludeClusterId: cluster.id,
    });

    if (weekendConflict) {
      throw new Error(
        `${weekendConflict.dog.regNumber} is already entered in ${weekendConflict.showDay.cluster.name} (${getShowDistrictRegionName(weekendConflict.showDay.cluster.district)}) this weekend.`
      );
    }

    for (const selection of selections) {
      const dog = dogById.get(selection.dogId);
      const showDay = dayById.get(selection.showDayId);

      if (!dog || !showDay) {
        throw new Error("Selected dog or show day was not found.");
      }

      if (dog.ownerKennelId !== kennelId) {
        throw new Error(`You do not own ${dog.regNumber}.`);
      }

      if (existingEntryKeys.has(`${dog.id}:${showDay.id}`)) {
        throw new Error(`${dog.regNumber} is already entered on day ${showDay.dayIndex}.`);
      }

      const reason = getShowDayEntryEligibilityReason({
        dog,
        cluster,
        showDay,
        breedCode2,
        currentEpoch,
      });

      if (reason) {
        throw new Error(`${dog.regNumber}: ${reason}`);
      }
    }

    const selectedDaysByDogId = new Map<string, number[]>();

    for (const selection of selections) {
      const showDay = dayById.get(selection.showDayId);

      if (!showDay) {
        continue;
      }

      const selectedDays = selectedDaysByDogId.get(selection.dogId) ?? [];
      selectedDays.push(showDay.dayIndex);
      selectedDaysByDogId.set(selection.dogId, selectedDays);
    }

    const quote = getClusterEntryQuote({
      homeDistrict: kennel.homeDistrict ?? cluster.district,
      clusterDistrict: cluster.district,
      ledgerBalance: kennel.balance,
      showRole,
      existingDogIdsByBreed: {
        [breedCode2]: existingBreedDogEntries.map((entry) => entry.dogId),
      },
      dogs: dogs.map((dog) => ({
        dogId: dog.id,
        dogName: getDogDisplayName(dog),
        breed: dog.breedCode2,
        sex: dog.sex === "M" ? "Dog" : "Bitch",
        selectedShowDays: selectedDaysByDogId.get(dog.id) ?? [],
      })),
    });
    const shouldChargeTravel = weekendPlan == null;
    const travelCost = shouldChargeTravel ? quote.travel.totalCost : 0;
    const totalCost = quote.entryFees + travelCost + quote.handlerFee;
    const balanceAfter = kennel.balance - totalCost;
    const shortfall = balanceAfter < 0 ? Math.abs(balanceAfter) : 0;

    if (shortfall > 0) {
      throw new Error(`Insufficient funds for show entry. Shortfall: $${shortfall}.`);
    }

    const blockIdByDayId = new Map<string, string>();

    for (const showDayId of new Set(selections.map((selection) => selection.showDayId))) {
      const showDay = dayById.get(showDayId);

      if (!showDay) {
        continue;
      }

      blockIdByDayId.set(
        showDay.id,
        await ensureBreedBlockForEntry({
          tx,
          showDay,
          breedCode2,
        })
      );
    }

    await tx.kennel.update({
      where: { id: kennel.id },
      data: { balance: balanceAfter },
    });

    if (!weekendPlan) {
      await tx.kennelShowWeekendPlan.create({
        data: {
          kennelId: kennel.id,
          weekendKey,
          primaryClusterId: cluster.id,
          travelFeeCharged: travelCost,
          createdAtEpoch: currentEpoch,
        },
      });
    }

    await tx.showEntry
      .createMany({
        data: selections.map((selection) => {
          const dog = dogById.get(selection.dogId);

          if (!dog) {
            throw new Error("Selected dog could not be found.");
          }

          return {
            showDayId: selection.showDayId,
            judgingBlockId: blockIdByDayId.get(selection.showDayId),
            dogId: dog.id,
            kennelId: kennel.id,
            enteredKennelId: kennel.id,
            enteredKennelName: kennel.name,
            enteredKennelSlug: kennel.slug,
            breedCode2: dog.breedCode2,
            entryStatus: "ENTERED",
            enteredAtEpoch: currentEpoch,
            feeCharged: ENTRY_FEE_PER_SHOW,
            handlerUsed:
              quote.handlerFee > 0 &&
              !existingBreedDogEntries.some((entry) => entry.dogId === dog.id),
            conditioningSnapshot: getConditioningSnapshot(dog),
            fatigueSnapshot: dog.fatiguePoints,
          };
        }),
      })
      .catch((error: unknown) => {
        if (isUniqueShowEntryError(error)) {
          throw duplicateShowEntryError();
        }

        throw error;
      });

    const ledgerRows: Prisma.LedgerTransactionCreateManyInput[] = [];
    let runningBalance = kennel.balance;

    if (quote.entryFees > 0) {
      runningBalance -= quote.entryFees;
      ledgerRows.push({
        kennelId: kennel.id,
        transactionType: "SHOW_ENTRY_FEE",
        amount: -quote.entryFees,
        balanceAfter: runningBalance,
        occurredAtEpoch: currentEpoch,
        showClusterId: cluster.id,
        memo: `Entered ${selections.length} ${breedCode2} show entry slot(s).`,
      });
    }

    if (travelCost > 0) {
      runningBalance -= travelCost;
      ledgerRows.push({
        kennelId: kennel.id,
        transactionType: "TRAVEL_COST",
        amount: -travelCost,
        balanceAfter: runningBalance,
        occurredAtEpoch: currentEpoch,
        showClusterId: cluster.id,
        memo: `Travel for ${quote.dogsEntered} dog(s) to ${cluster.name}.`,
      });
    }

    if (quote.handlerFee > 0) {
      runningBalance -= quote.handlerFee;
      ledgerRows.push({
        kennelId: kennel.id,
        transactionType: "HANDLER_FEE",
        amount: -quote.handlerFee,
        balanceAfter: runningBalance,
        occurredAtEpoch: currentEpoch,
        showClusterId: cluster.id,
        memo:
          quote.handlerFeeType === "TRAVELING"
            ? `Traveling handler fee for ${quote.handlerDogs} dog(s) at ${cluster.name}.`
            : `Ringside handler fee for ${quote.handlerDogs} dog(s) at ${cluster.name}.`,
      });
    }

    if (ledgerRows.length > 0) {
      await tx.ledgerTransaction.createMany({ data: ledgerRows });
    }

    return {
      showId,
      breedCode2,
      entriesCreated: selections.length,
      dogsEntered: quote.dogsEntered,
      quote: {
        entryFees: quote.entryFees,
        travelCost,
        handlerFeeType: quote.handlerFeeType,
        handlerDogs: quote.handlerDogs,
        handlerFee: quote.handlerFee,
        totalCost,
        balanceAfter,
      },
    };
  });
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
