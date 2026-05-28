import { Prisma } from "@prisma/client";

import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const CHAMPION_TITLE_CODE = "CH";

type TransactionClient = Prisma.TransactionClient;

type PointAward = {
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
  awardCode: string;
  showDay: {
    scheduledEpoch: number;
  };
};

function summarizeChampionshipAwards(awards: PointAward[]) {
  const awardsByShowDay = new Map<string, PointAward[]>();

  for (const award of awards) {
    const dayAwards = awardsByShowDay.get(award.showDayId) ?? [];
    dayAwards.push(award);
    awardsByShowDay.set(award.showDayId, dayAwards);
  }

  let championshipPoints = 0;
  let majorCount = 0;
  const pointWins: Array<{
    showDayId: string;
    awardCode: string;
    pointsAwarded: number;
    isMajor: boolean;
  }> = [];

  for (const [showDayId, dayAwards] of awardsByShowDay.entries()) {
    const bestAward = dayAwards.sort(
      (a, b) => b.pointsAwarded - a.pointsAwarded
    )[0];

    if (!bestAward) {
      continue;
    }

    championshipPoints += bestAward.pointsAwarded;

    if (bestAward.isMajor || bestAward.pointsAwarded >= 3) {
      majorCount += 1;
    }

    pointWins.push({
      showDayId,
      awardCode: bestAward.awardCode,
      pointsAwarded: bestAward.pointsAwarded,
      isMajor: bestAward.isMajor || bestAward.pointsAwarded >= 3,
    });
  }

  return {
    championshipPoints,
    majorCount,
    currentTitleCode:
      championshipPoints >= CHAMPIONSHIP_POINTS_REQUIRED &&
      majorCount >= CHAMPIONSHIP_MAJORS_REQUIRED
        ? CHAMPION_TITLE_CODE
        : null,
    winsByTypeJson: {
      championshipPointWins: pointWins,
    },
  };
}

export async function recalculateDogTitleProgress(args: {
  tx: TransactionClient;
  dogId: string;
}) {
  const { tx, dogId } = args;
  const [dog, previousProgress] = await Promise.all([
    tx.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        ownerKennelId: true,
        registeredName: true,
        callName: true,
        regNumber: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
      },
    }),
    tx.dogTitleProgress.findUnique({
      where: { dogId },
      select: { currentTitleCode: true },
    }),
  ]);

  const awards = await tx.showAward.findMany({
    where: {
      dogId,
      pointsAwarded: {
        gt: 0,
      },
    },
    select: {
      showDayId: true,
      pointsAwarded: true,
      isMajor: true,
      awardCode: true,
      showDay: {
        select: {
          scheduledEpoch: true,
        },
      },
    },
  });
  const summary = summarizeChampionshipAwards(awards);

  await tx.dogTitleProgress.upsert({
    where: { dogId },
    update: {
      championshipPoints: summary.championshipPoints,
      majorCount: summary.majorCount,
      currentTitleCode: summary.currentTitleCode,
      winsByTypeJson: summary.winsByTypeJson,
    },
    create: {
      dogId,
      championshipPoints: summary.championshipPoints,
      majorCount: summary.majorCount,
      currentTitleCode: summary.currentTitleCode,
      winsByTypeJson: summary.winsByTypeJson,
    },
  });

  if (summary.currentTitleCode === CHAMPION_TITLE_CODE) {
    await tx.dog.update({
      where: { id: dogId },
      data: {
        visibleTitlePrefix: CHAMPION_TITLE_CODE,
      },
    });

    if (
      dog?.ownerKennelId &&
      previousProgress?.currentTitleCode !== CHAMPION_TITLE_CODE
    ) {
      await createKennelNotice({
        client: tx,
        kennelId: dog.ownerKennelId,
        type: "NEW_CHAMPION",
        title: "New champion",
        body: `${formatDogDisplayName({
          ...dog,
          visibleTitlePrefix: CHAMPION_TITLE_CODE,
        })} has finished their championship.`,
        currentEpoch: Math.max(
          ...awards.map((award) => award.showDay.scheduledEpoch),
          0
        ),
        linkedDogId: dog.id,
      });
    }
  }

  return summary;
}

export async function recalculateDogTitleProgressForDogs(args: {
  tx: TransactionClient;
  dogIds: string[];
}) {
  const uniqueDogIds = [...new Set(args.dogIds)];

  for (const dogId of uniqueDogIds) {
    await recalculateDogTitleProgress({
      tx: args.tx,
      dogId,
    });
  }
}
