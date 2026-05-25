import { db } from "@/lib/db";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { recalculateDogTitleProgressForDogs } from "@/server/services/titleProgress.service";
import {
  JUDGING_SCORING_VERSION,
  judgeBestInShow,
  judgeBreedBlock,
  judgeGroup,
  mapJudgeRosterStyleToJudgeStyle,
  type Dog as EngineDog,
  type Judge as EngineJudge,
} from "@showring/rules";
import { Prisma, ShowDayStatus, ShowJudgingBlockStatus } from "@prisma/client";

const showBlockForJudgingArgs =
  Prisma.validator<Prisma.ShowJudgingBlockDefaultArgs>()({
    include: {
      judge: true,
      showDay: {
        include: {
          cluster: true,
        },
      },
      showEntries: {
        include: {
          dog: {
            include: {
              titleProgress: {
                select: {
                  currentTitleCode: true,
                },
              },
            },
          },
        },
        orderBy: [{ enteredAtEpoch: "asc" }],
      },
    },
  });

type ShowBlockForJudging = Prisma.ShowJudgingBlockGetPayload<
  typeof showBlockForJudgingArgs
>;

type EntryForJudging = ShowBlockForJudging["showEntries"][number];
type JudgeForEngine = {
  id: string;
  name: string;
  style: string | null;
  weightTypeExpression: number;
  weightStructureBalance: number;
  weightMovement: number;
  weightCoatPresentation: number;
  weightTemperamentRingBehavior: number;
  weightConditioningHandling: number;
};
type DogForEngine = {
  id: string;
  regNumber: string;
  breedCode2: string;
  birthEpoch: number;
  sex: "M" | "F";
  litterId: string | null;
  litterOrder: number | null;
  sireId: string | null;
  damId: string | null;
  traitHead: number;
  traitForequarters: number;
  traitHindquarters: number;
  traitGait: number;
  traitCoat: number;
  traitSize: number;
  traitTemperament: number;
  traitShowShine: number;
  traitFeet: number;
  traitTopline: number;
};

export type JudgedShowResultDto = {
  showEntryId: string;
  showDayId: string;
  judgingBlockId: string | null;
  dogId: string;
  breedCode2: string;
  finalRank: number | null;
  placementCode: string | null;
  baseScore: number;
  finalScore: number;
};

export type JudgeShowBlockDto = {
  judgingBlockId: string;
  showDayId: string;
  status: ShowJudgingBlockStatus;
  alreadyPublished: boolean;
  eligibleEntryCount: number;
  ineligibleEntryCount: number;
  results: JudgedShowResultDto[];
};

export type JudgeShowDayDto = {
  showDayId: string;
  status: ShowDayStatus;
  blocks: JudgeShowBlockDto[];
};

function toEngineJudge(judge: JudgeForEngine): EngineJudge {
  return {
    judgeId: judge.id,
    name: judge.name,
    style: mapJudgeRosterStyleToJudgeStyle(judge.style ?? "balanced"),
    categoryWeights: {
      TYPE_EXPRESSION: judge.weightTypeExpression,
      STRUCTURE_BALANCE: judge.weightStructureBalance,
      MOVEMENT: judge.weightMovement,
      COAT_PRESENTATION: judge.weightCoatPresentation,
      TEMPERAMENT_RING_BEHAVIOR: judge.weightTemperamentRingBehavior,
      CONDITIONING_HANDLING: judge.weightConditioningHandling,
    },
  };
}

function toEngineDogRecord(dog: DogForEngine): EngineDog {
  return {
    dogId: dog.id,
    regNumber: dog.regNumber,
    breedCode2: dog.breedCode2,
    birthEpoch: dog.birthEpoch,
    sex: dog.sex,
    status: "ALIVE",
    litterId: dog.litterId,
    litterOrder: dog.litterOrder,
    sireId: dog.sireId,
    damId: dog.damId,
    traits: {
      head: dog.traitHead,
      forequarters: dog.traitForequarters,
      hindquarters: dog.traitHindquarters,
      gait: dog.traitGait,
      coat: dog.traitCoat,
      size: dog.traitSize,
      temperament: dog.traitTemperament,
      show_shine: dog.traitShowShine,
      feet: dog.traitFeet,
      topline: dog.traitTopline,
    },
  };
}

function toEngineDog(entry: EntryForJudging): EngineDog {
  return toEngineDogRecord(entry.dog);
}

function isChampionEntry(entry: EntryForJudging): boolean {
  return (
    entry.dog.visibleTitlePrefix === "CH" ||
    entry.dog.titleProgress?.currentTitleCode === "CH"
  );
}

function canBlockMoveToJudging(
  block: ShowBlockForJudging,
  currentEpoch: number
): boolean {
  if (block.status === "ENTRY_LOCKED" || block.status === "JUDGING") {
    return true;
  }

  return (
    currentEpoch >= block.startEpoch &&
    (block.status === "SCHEDULED" || block.status === "ENTRY_OPEN")
  );
}

function isEntryEligibleForBlockJudging(
  entry: EntryForJudging,
  block: ShowBlockForJudging
): boolean {
  const aliveAtBlockStart =
    entry.dog.lifecycleState === "ALIVE" ||
    (entry.dog.lifecycleState === "DECEASED" &&
      entry.dog.deathEpoch !== null &&
      entry.dog.deathEpoch > block.startEpoch);

  return (
    entry.entryStatus === "ENTERED" &&
    entry.breedCode2 === block.breedCode2 &&
    aliveAtBlockStart &&
    entry.dog.ownerKennelId === entry.kennelId
  );
}

function mapPersistedResult(result: {
  showEntryId: string;
  showDayId: string;
  judgingBlockId: string | null;
  dogId: string;
  breedCode2: string;
  finalRank: number | null;
  placementCode: string | null;
  baseScore: number;
  finalScore: number;
}): JudgedShowResultDto {
  return {
    showEntryId: result.showEntryId,
    showDayId: result.showDayId,
    judgingBlockId: result.judgingBlockId,
    dogId: result.dogId,
    breedCode2: result.breedCode2,
    finalRank: result.finalRank,
    placementCode: result.placementCode,
    baseScore: result.baseScore,
    finalScore: result.finalScore,
  };
}

async function listPersistedBlockResults(
  tx: Prisma.TransactionClient,
  judgingBlockId: string
): Promise<JudgedShowResultDto[]> {
  const results = await tx.showResult.findMany({
    where: { judgingBlockId },
    orderBy: [{ finalRank: "asc" }, { finalScore: "desc" }],
    select: {
      showEntryId: true,
      showDayId: true,
      judgingBlockId: true,
      dogId: true,
      breedCode2: true,
      finalRank: true,
      placementCode: true,
      baseScore: true,
      finalScore: true,
    },
  });

  return results.map(mapPersistedResult);
}

async function repairPublishedBlockState(args: {
  tx: Prisma.TransactionClient;
  block: ShowBlockForJudging;
  currentEpoch: number;
}): Promise<JudgeShowBlockDto> {
  const { tx, block, currentEpoch } = args;
  const persistedResults = await listPersistedBlockResults(tx, block.id);
  const existingAwardCount = await tx.showAward.count({
    where: { judgingBlockId: block.id },
  });

  if (existingAwardCount === 0) {
    throw new Error(
      "Show judging block has persisted results but no persisted awards."
    );
  }

  const judgedEntryIds = persistedResults
    .map((result) => result.showEntryId)
    .filter((showEntryId): showEntryId is string => Boolean(showEntryId));
  const publishedAtEpoch = block.publishedAtEpoch ?? currentEpoch;

  if (judgedEntryIds.length > 0) {
    await tx.showEntry.updateMany({
      where: { id: { in: judgedEntryIds } },
      data: { entryStatus: "JUDGED" },
    });
  }

  await tx.showJudgingBlock.update({
    where: { id: block.id },
    data: {
      status: "RESULTS_PUBLISHED",
      publishedAtEpoch,
    },
  });

  return {
    judgingBlockId: block.id,
    showDayId: block.showDayId,
    status: ShowJudgingBlockStatus.RESULTS_PUBLISHED,
    alreadyPublished: true,
    eligibleEntryCount: persistedResults.length,
    ineligibleEntryCount: block.showEntries.filter(
      (entry) => entry.entryStatus === "INELIGIBLE"
    ).length,
    results: persistedResults,
  };
}

async function maybeCompleteCluster(
  tx: Prisma.TransactionClient,
  clusterId: string
): Promise<void> {
  const remainingDays = await tx.showDay.count({
    where: {
      clusterId,
      status: {
        notIn: ["RESULTS_PUBLISHED", "CANCELLED"],
      },
    },
  });

  if (remainingDays === 0) {
    await tx.showCluster.update({
      where: { id: clusterId },
      data: { status: "COMPLETE" },
    });
  }
}

async function maybePublishShowDay(args: {
  tx: Prisma.TransactionClient;
  showDayId: string;
  currentEpoch: number;
}): Promise<void> {
  const { tx, showDayId, currentEpoch } = args;

  const showDay = await tx.showDay.findUnique({
    where: { id: showDayId },
    select: { clusterId: true, status: true },
  });

  if (!showDay || showDay.status === "CANCELLED") {
    return;
  }

  const totalBlocks = await tx.showJudgingBlock.count({
    where: { showDayId },
  });
  const remainingBlocks = await tx.showJudgingBlock.count({
    where: {
      showDayId,
      status: {
        notIn: ["RESULTS_PUBLISHED", "CANCELLED"],
      },
    },
  });

  if (totalBlocks > 0 && remainingBlocks === 0) {
    await tx.showDay.update({
      where: { id: showDayId },
      data: {
        status: "RESULTS_PUBLISHED",
        publishedAtEpoch: currentEpoch,
      },
    });

    await maybeCompleteCluster(tx, showDay.clusterId);
    return;
  }

  if (showDay.status !== "JUDGING") {
    await tx.showDay.update({
      where: { id: showDayId },
      data: { status: "JUDGING" },
    });
  }
}

export async function judgeShowBlock(args: {
  judgingBlockId: string;
  currentEpoch: number;
}): Promise<JudgeShowBlockDto> {
  const { judgingBlockId, currentEpoch } = args;
  const blockTiming = await db.showJudgingBlock.findUnique({
    where: { id: judgingBlockId },
    select: {
      startEpoch: true,
      showEntries: {
        select: {
          dogId: true,
        },
      },
    },
  });

  if (blockTiming && currentEpoch >= blockTiming.startEpoch) {
    await resolveDogDeaths({
      currentEpoch: blockTiming.startEpoch,
      dogIds: blockTiming.showEntries.map((entry) => entry.dogId),
    });
  }

  return db.$transaction(async (tx) => {
    const block = await tx.showJudgingBlock.findUnique({
      where: { id: judgingBlockId },
      ...showBlockForJudgingArgs,
    });

    if (!block) {
      throw new Error("Show judging block not found.");
    }

    if (block.showDay.cluster.status === "CANCELLED") {
      throw new Error("Blocks in cancelled clusters cannot be judged.");
    }

    if (block.showDay.status === "CANCELLED") {
      throw new Error("Blocks in cancelled show days cannot be judged.");
    }

    if (block.status === "CANCELLED") {
      throw new Error("Cancelled judging blocks cannot be judged.");
    }

    if (block.status === "RESULTS_PUBLISHED") {
      return {
        judgingBlockId,
        showDayId: block.showDayId,
        status: block.status,
        alreadyPublished: true,
        eligibleEntryCount: block.showEntries.filter(
          (entry) => entry.entryStatus === "JUDGED"
        ).length,
        ineligibleEntryCount: block.showEntries.filter(
          (entry) => entry.entryStatus === "INELIGIBLE"
        ).length,
        results: await listPersistedBlockResults(tx, judgingBlockId),
      };
    }

    if (!canBlockMoveToJudging(block, currentEpoch)) {
      throw new Error("Show judging block is not ready for judging.");
    }

    const existingResultCount = await tx.showResult.count({
      where: { judgingBlockId },
    });

    if (existingResultCount > 0) {
      return repairPublishedBlockState({ tx, block, currentEpoch });
    }

    await tx.showJudgingBlock.update({
      where: { id: judgingBlockId },
      data: { status: "JUDGING" },
    });

    await tx.showDay.update({
      where: { id: block.showDayId },
      data: { status: "JUDGING" },
    });

    const eligibleEntries = block.showEntries.filter((entry) =>
      isEntryEligibleForBlockJudging(entry, block)
    );
    const ineligibleEntryIds = block.showEntries
      .filter(
        (entry) =>
          entry.entryStatus === "ENTERED" &&
          !isEntryEligibleForBlockJudging(entry, block)
      )
      .map((entry) => entry.id);

    if (ineligibleEntryIds.length > 0) {
      await tx.showEntry.updateMany({
        where: { id: { in: ineligibleEntryIds } },
        data: { entryStatus: "INELIGIBLE" },
      });
    }

    const uniqueKennelsInCompetition = new Set(
      eligibleEntries.map((entry) => entry.kennelId)
    ).size;
    const engineJudge = toEngineJudge(block.judge);
    const judgedBlock = judgeBreedBlock({
      judge: engineJudge,
      entries: eligibleEntries.map((entry) => ({
        showEntryId: entry.id,
        dog: toEngineDog(entry),
        isChampion: isChampionEntry(entry),
      })),
    });
    const resultIdByShowEntryId = new Map<string, string>();
    const judgedEntryIds: string[] = [];
    const pointsByShowEntryId = new Map<string, number>();

    for (const award of judgedBlock.awards) {
      if (!award.showEntryId || award.pointsAwarded <= 0) {
        continue;
      }

      pointsByShowEntryId.set(
        award.showEntryId,
        Math.max(
          pointsByShowEntryId.get(award.showEntryId) ?? 0,
          award.pointsAwarded
        )
      );
    }

    for (const result of judgedBlock.results) {
      if (!result.showEntryId) {
        continue;
      }

      judgedEntryIds.push(result.showEntryId);
      const pointsAwarded = pointsByShowEntryId.get(result.showEntryId) ?? 0;
      const createdResult = await tx.showResult.create({
        data: {
          showEntryId: result.showEntryId,
          showDayId: block.showDayId,
          judgingBlockId,
          dogId: result.dogId,
          breedCode2: block.breedCode2,
          judgeId: block.judgeId,
          finalRank: result.finalRank,
          placementCode: result.placementCode,
          baseScore: result.baseScore,
          finalScore: result.finalScore,
          pointsAwarded,
          isMajor: pointsAwarded >= 3,
          uniqueKennelsInCompetition,
          publishedAtEpoch: currentEpoch,
          scoringVersion: JUDGING_SCORING_VERSION,
        },
        select: { id: true },
      });

      resultIdByShowEntryId.set(result.showEntryId, createdResult.id);
    }

    const awardsToCreate: Prisma.ShowAwardCreateManyInput[] = [];

    for (const award of judgedBlock.awards) {
      if (!award.showEntryId) {
        continue;
      }

      awardsToCreate.push({
        showResultId: resultIdByShowEntryId.get(award.showEntryId),
        showEntryId: award.showEntryId,
        showDayId: block.showDayId,
        judgingBlockId,
        dogId: award.dogId,
        breedCode2: block.breedCode2,
        judgeId: block.judgeId,
        awardCode: award.awardCode,
        awardGroup: award.awardGroup,
        sex: award.sex,
        rank: award.rank,
        pointsAwarded: award.pointsAwarded,
        isMajor: award.isMajor,
        dogsInCompetition: award.dogsInCompetition,
        uniqueKennelsInCompetition,
        publishedAtEpoch: currentEpoch,
      });
    }

    if (awardsToCreate.length > 0) {
      await tx.showAward.createMany({ data: awardsToCreate });

      await recalculateDogTitleProgressForDogs({
        tx,
        dogIds: awardsToCreate
          .filter((award) => (award.pointsAwarded ?? 0) > 0)
          .map((award) => award.dogId),
      });
    }

    if (judgedEntryIds.length > 0) {
      await tx.showEntry.updateMany({
        where: { id: { in: judgedEntryIds } },
        data: { entryStatus: "JUDGED" },
      });
    }

    await tx.showJudgingBlock.update({
      where: { id: judgingBlockId },
      data: {
        status: "RESULTS_PUBLISHED",
        publishedAtEpoch: currentEpoch,
      },
    });

    await maybePublishShowDay({
      tx,
      showDayId: block.showDayId,
      currentEpoch,
    });

    return {
      judgingBlockId,
      showDayId: block.showDayId,
      status: ShowJudgingBlockStatus.RESULTS_PUBLISHED,
      alreadyPublished: false,
      eligibleEntryCount: eligibleEntries.length,
      ineligibleEntryCount: ineligibleEntryIds.length,
      results: await listPersistedBlockResults(tx, judgingBlockId),
    };
  });
}

export async function judgeShowDay(args: {
  showDayId: string;
  currentEpoch: number;
}): Promise<JudgeShowDayDto> {
  const { showDayId, currentEpoch } = args;

  const showDay = await db.showDay.findUnique({
    where: { id: showDayId },
    select: {
      id: true,
      status: true,
      judgingBlocks: {
        orderBy: [
          { startEpoch: "asc" },
          { ringNumber: "asc" },
          { blockOrder: "asc" },
        ],
        select: { id: true },
      },
    },
  });

  if (!showDay) {
    throw new Error("Show day not found.");
  }

  if (showDay.judgingBlocks.length === 0) {
    throw new Error("Show day has no judging blocks.");
  }

  const blocks: JudgeShowBlockDto[] = [];

  for (const block of showDay.judgingBlocks) {
    blocks.push(
      await judgeShowBlock({
        judgingBlockId: block.id,
        currentEpoch,
      })
    );
  }

  const updatedShowDay = await db.showDay.findUnique({
    where: { id: showDayId },
    select: { status: true },
  });

  return {
    showDayId,
    status: updatedShowDay?.status ?? showDay.status,
    blocks,
  };
}

async function ensureShowDayBreedBlock(args: {
  showDayId: string;
  breedCode2: string;
  currentEpoch: number;
}): Promise<string> {
  const { showDayId, breedCode2, currentEpoch } = args;

  return db.$transaction(async (tx) => {
    const existingBlock = await tx.showJudgingBlock.findFirst({
      where: {
        showDayId,
        breedCode2,
      },
      select: { id: true },
    });

    if (existingBlock) {
      await tx.showEntry.updateMany({
        where: {
          showDayId,
          breedCode2,
          judgingBlockId: null,
        },
        data: { judgingBlockId: existingBlock.id },
      });

      return existingBlock.id;
    }

    const showDay = await tx.showDay.findUnique({
      where: { id: showDayId },
      include: { cluster: true },
    });

    if (!showDay) {
      throw new Error("Show day not found.");
    }

    const entryCount = await tx.showEntry.count({
      where: {
        showDayId,
        breedCode2,
      },
    });

    if (entryCount === 0) {
      throw new Error("No entries exist for this breed on this show day.");
    }

    const lastBlock = await tx.showJudgingBlock.findFirst({
      where: { showDayId },
      orderBy: [{ blockOrder: "desc" }],
      select: { blockOrder: true },
    });
    const status =
      showDay.status === "JUDGING" || showDay.status === "ENTRY_LOCKED"
        ? showDay.status
        : currentEpoch >= showDay.scheduledEpoch
          ? "ENTRY_OPEN"
          : "SCHEDULED";
    const createdBlock = await tx.showJudgingBlock.create({
      data: {
        showDayId,
        judgeId: showDay.judgeId,
        breedCode2,
        ringNumber: 1,
        ringName: "Breed Judging",
        startEpoch: showDay.scheduledEpoch,
        classType: "REGULAR",
        blockOrder: (lastBlock?.blockOrder ?? 0) + 1,
        entryCountHint: entryCount,
        status,
      },
      select: { id: true },
    });

    await tx.showEntry.updateMany({
      where: {
        showDayId,
        breedCode2,
        judgingBlockId: null,
      },
      data: { judgingBlockId: createdBlock.id },
    });

    return createdBlock.id;
  });
}

export async function judgeShowDayBreed(args: {
  showDayId: string;
  breedCode2: string;
  currentEpoch: number;
}): Promise<JudgeShowBlockDto> {
  const judgingBlockId = await ensureShowDayBreedBlock({
    showDayId: args.showDayId,
    breedCode2: args.breedCode2.trim().toUpperCase(),
    currentEpoch: args.currentEpoch,
  });

  return judgeShowBlock({
    judgingBlockId,
    currentEpoch: args.currentEpoch,
  });
}

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other Breeds";
}

async function createGroupAwardsForShowDay(args: {
  showDayId: string;
  judgeId: string;
  judge: EngineJudge;
  currentEpoch: number;
}): Promise<number> {
  return db.$transaction(async (tx) => {
    const existingGroupAwards = await tx.showAward.count({
      where: {
        showDayId: args.showDayId,
        awardGroup: "GROUP",
      },
    });

    if (existingGroupAwards > 0) {
      return 0;
    }

    const bobAwards = await tx.showAward.findMany({
      where: {
        showDayId: args.showDayId,
        awardGroup: "BREED",
        awardCode: "BOB",
      },
      select: {
        showEntryId: true,
        showResultId: true,
        dogId: true,
        breedCode2: true,
        showEntry: {
          select: {
            kennelId: true,
          },
        },
        dog: {
          select: {
            id: true,
            regNumber: true,
            breedCode2: true,
            birthEpoch: true,
            sex: true,
            litterId: true,
            litterOrder: true,
            sireId: true,
            damId: true,
            traitHead: true,
            traitForequarters: true,
            traitHindquarters: true,
            traitGait: true,
            traitCoat: true,
            traitSize: true,
            traitTemperament: true,
            traitShowShine: true,
            traitFeet: true,
            traitTopline: true,
            breed: {
              select: {
                groupName: true,
              },
            },
          },
        },
      },
    });
    const awardsByGroup = new Map<string, typeof bobAwards>();

    for (const award of bobAwards) {
      const groupName = normalizeGroupName(award.dog.breed.groupName);
      const groupAwards = awardsByGroup.get(groupName) ?? [];
      groupAwards.push(award);
      awardsByGroup.set(groupName, groupAwards);
    }

    const awardsToCreate: Prisma.ShowAwardCreateManyInput[] = [];

    for (const groupAwards of awardsByGroup.values()) {
      const awardByEntryId = new Map(
        groupAwards.map((award) => [award.showEntryId, award])
      );
      const uniqueKennelsInCompetition = new Set(
        groupAwards.map((award) => award.showEntry.kennelId)
      ).size;
      const judgedGroupAwards = judgeGroup({
        judge: args.judge,
        entries: groupAwards.map((award) => ({
          showEntryId: award.showEntryId,
          dog: toEngineDogRecord(award.dog),
        })),
      });

      for (const judgedAward of judgedGroupAwards) {
        if (!judgedAward.showEntryId) {
          continue;
        }

        const sourceAward = awardByEntryId.get(judgedAward.showEntryId);

        if (!sourceAward) {
          continue;
        }

        awardsToCreate.push({
          showResultId: sourceAward.showResultId,
          showEntryId: sourceAward.showEntryId,
          showDayId: args.showDayId,
          judgingBlockId: null,
          dogId: sourceAward.dogId,
          breedCode2: sourceAward.breedCode2,
          judgeId: args.judgeId,
          awardCode: judgedAward.awardCode,
          awardGroup: judgedAward.awardGroup,
          sex: judgedAward.sex,
          rank: judgedAward.rank,
          pointsAwarded: 0,
          isMajor: false,
          dogsInCompetition: judgedAward.dogsInCompetition,
          uniqueKennelsInCompetition,
          publishedAtEpoch: args.currentEpoch,
        });
      }
    }

    if (awardsToCreate.length === 0) {
      return 0;
    }

    const created = await tx.showAward.createMany({
      data: awardsToCreate,
    });

    return created.count;
  });
}

async function createBestInShowAwardsForShowDay(args: {
  showDayId: string;
  judgeId: string;
  judge: EngineJudge;
  currentEpoch: number;
}): Promise<number> {
  return db.$transaction(async (tx) => {
    const existingBestInShowAwards = await tx.showAward.count({
      where: {
        showDayId: args.showDayId,
        awardGroup: "BEST_IN_SHOW",
      },
    });

    if (existingBestInShowAwards > 0) {
      return 0;
    }

    const groupOneAwards = await tx.showAward.findMany({
      where: {
        showDayId: args.showDayId,
        awardGroup: "GROUP",
        awardCode: "G1",
      },
      select: {
        showEntryId: true,
        showResultId: true,
        dogId: true,
        breedCode2: true,
        showEntry: {
          select: {
            kennelId: true,
          },
        },
        dog: {
          select: {
            id: true,
            regNumber: true,
            breedCode2: true,
            birthEpoch: true,
            sex: true,
            litterId: true,
            litterOrder: true,
            sireId: true,
            damId: true,
            traitHead: true,
            traitForequarters: true,
            traitHindquarters: true,
            traitGait: true,
            traitCoat: true,
            traitSize: true,
            traitTemperament: true,
            traitShowShine: true,
            traitFeet: true,
            traitTopline: true,
          },
        },
      },
    });

    if (groupOneAwards.length === 0) {
      return 0;
    }

    const awardByEntryId = new Map(
      groupOneAwards.map((award) => [award.showEntryId, award])
    );
    const uniqueKennelsInCompetition = new Set(
      groupOneAwards.map((award) => award.showEntry.kennelId)
    ).size;
    const judgedBestInShowAwards = judgeBestInShow({
      judge: args.judge,
      entries: groupOneAwards.map((award) => ({
        showEntryId: award.showEntryId,
        dog: toEngineDogRecord(award.dog),
      })),
    });
    const awardsToCreate: Prisma.ShowAwardCreateManyInput[] = [];

    for (const judgedAward of judgedBestInShowAwards) {
      if (!judgedAward.showEntryId) {
        continue;
      }

      const sourceAward = awardByEntryId.get(judgedAward.showEntryId);

      if (!sourceAward) {
        continue;
      }

      awardsToCreate.push({
        showResultId: sourceAward.showResultId,
        showEntryId: sourceAward.showEntryId,
        showDayId: args.showDayId,
        judgingBlockId: null,
        dogId: sourceAward.dogId,
        breedCode2: sourceAward.breedCode2,
        judgeId: args.judgeId,
        awardCode: judgedAward.awardCode,
        awardGroup: judgedAward.awardGroup,
        sex: judgedAward.sex,
        rank: judgedAward.rank,
        pointsAwarded: 0,
        isMajor: false,
        dogsInCompetition: judgedAward.dogsInCompetition,
        uniqueKennelsInCompetition,
        publishedAtEpoch: args.currentEpoch,
      });
    }

    if (awardsToCreate.length === 0) {
      return 0;
    }

    const created = await tx.showAward.createMany({
      data: awardsToCreate,
    });

    return created.count;
  });
}

export async function publishReadyShowDayResults(args: {
  showDayId: string;
  currentEpoch: number;
}): Promise<{
  showDayId: string;
  breedBlocksJudged: number;
  eligibleEntryCount: number;
  groupAwardsCreated: number;
  bestInShowAwardsCreated: number;
}> {
  const showDay = await db.showDay.findUnique({
    where: { id: args.showDayId },
    include: {
      cluster: true,
      judge: true,
      judgingBlocks: {
        orderBy: [
          { startEpoch: "asc" },
          { ringNumber: "asc" },
          { blockOrder: "asc" },
        ],
        select: {
          id: true,
          status: true,
          _count: {
            select: {
              showEntries: true,
            },
          },
        },
      },
    },
  });

  if (!showDay) {
    throw new Error("Show day not found.");
  }

  if (
    showDay.status === "CANCELLED" ||
    showDay.cluster.status === "CANCELLED" ||
    args.currentEpoch < showDay.scheduledEpoch
  ) {
    return {
      showDayId: args.showDayId,
      breedBlocksJudged: 0,
      eligibleEntryCount: 0,
      groupAwardsCreated: 0,
      bestInShowAwardsCreated: 0,
    };
  }

  let breedBlocksJudged = 0;
  let eligibleEntryCount = 0;

  for (const block of showDay.judgingBlocks) {
    if (block._count.showEntries === 0 || block.status === "CANCELLED") {
      continue;
    }

    const result = await judgeShowBlock({
      judgingBlockId: block.id,
      currentEpoch: args.currentEpoch,
    });

    breedBlocksJudged += result.alreadyPublished ? 0 : 1;
    eligibleEntryCount += result.eligibleEntryCount;
  }

  const finalized = await finalizeReadyShowDayResults({
    showDayId: args.showDayId,
    currentEpoch: args.currentEpoch,
  });

  return {
    showDayId: args.showDayId,
    breedBlocksJudged,
    eligibleEntryCount,
    groupAwardsCreated: finalized.groupAwardsCreated,
    bestInShowAwardsCreated: finalized.bestInShowAwardsCreated,
  };
}

export async function finalizeReadyShowDayResults(args: {
  showDayId: string;
  currentEpoch: number;
}): Promise<{
  showDayId: string;
  readyToFinalize: boolean;
  groupAwardsCreated: number;
  bestInShowAwardsCreated: number;
}> {
  const showDay = await db.showDay.findUnique({
    where: { id: args.showDayId },
    include: {
      cluster: true,
      judge: true,
    },
  });

  if (!showDay) {
    throw new Error("Show day not found.");
  }

  if (
    showDay.status === "CANCELLED" ||
    showDay.cluster.status === "CANCELLED" ||
    args.currentEpoch < showDay.scheduledEpoch
  ) {
    return {
      showDayId: args.showDayId,
      readyToFinalize: false,
      groupAwardsCreated: 0,
      bestInShowAwardsCreated: 0,
    };
  }

  const remainingEntryBlocks = await db.showJudgingBlock.count({
    where: {
      showDayId: args.showDayId,
      status: {
        notIn: ["RESULTS_PUBLISHED", "CANCELLED"],
      },
      showEntries: {
        some: {},
      },
    },
  });

  if (remainingEntryBlocks > 0) {
    return {
      showDayId: args.showDayId,
      readyToFinalize: false,
      groupAwardsCreated: 0,
      bestInShowAwardsCreated: 0,
    };
  }

  const engineJudge = toEngineJudge(showDay.judge);
  const groupAwardsCreated = await createGroupAwardsForShowDay({
    showDayId: args.showDayId,
    judgeId: showDay.judgeId,
    judge: engineJudge,
    currentEpoch: args.currentEpoch,
  });
  const bestInShowAwardsCreated = await createBestInShowAwardsForShowDay({
    showDayId: args.showDayId,
    judgeId: showDay.judgeId,
    judge: engineJudge,
    currentEpoch: args.currentEpoch,
  });

  await db.$transaction(async (tx) => {
    await tx.showDay.update({
      where: { id: args.showDayId },
      data: {
        status: "RESULTS_PUBLISHED",
        publishedAtEpoch: args.currentEpoch,
      },
    });

    await maybeCompleteCluster(tx, showDay.clusterId);
  });

  return {
    showDayId: args.showDayId,
    readyToFinalize: true,
    groupAwardsCreated,
    bestInShowAwardsCreated,
  };
}

export async function publishReadyShowResultsForCluster(args: {
  showId: string;
  currentEpoch: number;
}): Promise<{
  showDaysVisited: number;
  breedBlocksJudged: number;
  eligibleEntryCount: number;
  groupAwardsCreated: number;
  bestInShowAwardsCreated: number;
}> {
  const showDays = await db.showDay.findMany({
    where: {
      clusterId: args.showId,
      scheduledEpoch: { lte: args.currentEpoch },
      status: { not: "CANCELLED" },
      showEntries: {
        some: {},
      },
    },
    orderBy: [{ dayIndex: "asc" }],
    select: { id: true },
  });
  const summary = {
    showDaysVisited: 0,
    breedBlocksJudged: 0,
    eligibleEntryCount: 0,
    groupAwardsCreated: 0,
    bestInShowAwardsCreated: 0,
  };

  for (const showDay of showDays) {
    const result = await publishReadyShowDayResults({
      showDayId: showDay.id,
      currentEpoch: args.currentEpoch,
    });

    summary.showDaysVisited += 1;
    summary.breedBlocksJudged += result.breedBlocksJudged;
    summary.eligibleEntryCount += result.eligibleEntryCount;
    summary.groupAwardsCreated += result.groupAwardsCreated;
    summary.bestInShowAwardsCreated += result.bestInShowAwardsCreated;
  }

  return summary;
}

export async function publishReadyBreedResultsForCluster(args: {
  showId: string;
  breedCode2: string;
  currentEpoch: number;
}): Promise<{
  showDayCount: number;
  judgedBlockCount: number;
  eligibleEntryCount: number;
}> {
  const breedCode2 = args.breedCode2.trim().toUpperCase();
  const showDays = await db.showDay.findMany({
    where: {
      clusterId: args.showId,
      scheduledEpoch: { lte: args.currentEpoch },
      status: { not: "CANCELLED" },
      showEntries: {
        some: {
          breedCode2,
          entryStatus: "ENTERED",
        },
      },
    },
    orderBy: [{ dayIndex: "asc" }],
    select: { id: true },
  });

  let judgedBlockCount = 0;
  let eligibleEntryCount = 0;

  for (const showDay of showDays) {
    const result = await judgeShowDayBreed({
      showDayId: showDay.id,
      breedCode2,
      currentEpoch: args.currentEpoch,
    });

    judgedBlockCount += result.alreadyPublished ? 0 : 1;
    eligibleEntryCount += result.eligibleEntryCount;
  }

  return {
    showDayCount: showDays.length,
    judgedBlockCount,
    eligibleEntryCount,
  };
}
