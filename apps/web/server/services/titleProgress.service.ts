import { Prisma } from "@prisma/client";

import { formatDogDisplayName } from "@/lib/dogNames";
import { isChampionOfRecordTitleCode } from "@/lib/dogTitles";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { recalculateProducerMeritForDogs } from "@/server/services/producerMerit.service";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const CHAMPION_TITLE_CODE = "CH";
const GRAND_CHAMPION_POINTS_REQUIRED = 25;
const GRAND_CHAMPION_MAJORS_REQUIRED = 3;
const GRAND_CHAMPION_DEFEAT_SHOWS_REQUIRED = 3;

const GRAND_CHAMPION_MILESTONE_TITLES = [
  { titleCode: "GCHP5", pointsRequired: 4000 },
  { titleCode: "GCHP4", pointsRequired: 3200 },
  { titleCode: "GCHP3", pointsRequired: 2400 },
  { titleCode: "GCHP2", pointsRequired: 1600 },
  { titleCode: "GCHP", pointsRequired: 800 },
  { titleCode: "GCHG", pointsRequired: 400 },
  { titleCode: "GCHS", pointsRequired: 200 },
  { titleCode: "GCHB", pointsRequired: 100 },
  { titleCode: "GCH", pointsRequired: GRAND_CHAMPION_POINTS_REQUIRED },
] as const;

type TransactionClient = Prisma.TransactionClient;

export type ConformationTitleProgress = {
  championshipPoints: number;
  majorCount: number;
  grandPoints: number;
  grandMajorCount: number;
  grandChampionDefeatShowCount: number;
  currentTitleCode: string | null;
};

export type GrandChampionCompletionSnapshot = {
  currentTitleCode: string | null;
  grandPoints: number;
  grandMajorCount: number;
  grandChampionDefeatShowCount: number;
  grandCompletedAtShowDayId: string | null;
  grandCompletedAtEpoch: number | null;
};

type PointAward = {
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
  awardCode: string;
  showDay: {
    scheduledEpoch: number;
  };
};

type TitleNoticeDog = {
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
};

export function isGrandChampionTitleCode(titleCode: string | null): boolean {
  const normalizedTitleCode = titleCode?.trim().toUpperCase();

  return (
    Boolean(normalizedTitleCode) &&
    normalizedTitleCode !== CHAMPION_TITLE_CODE &&
    isChampionOfRecordTitleCode(normalizedTitleCode)
  );
}

export function isGrandChampionComplete(
  progress: Pick<
    ConformationTitleProgress,
    | "currentTitleCode"
    | "grandPoints"
    | "grandMajorCount"
    | "grandChampionDefeatShowCount"
  >
): boolean {
  return (
    isChampionOfRecordTitleCode(progress.currentTitleCode) &&
    progress.grandPoints >= GRAND_CHAMPION_POINTS_REQUIRED &&
    progress.grandMajorCount >= GRAND_CHAMPION_MAJORS_REQUIRED &&
    progress.grandChampionDefeatShowCount >=
      GRAND_CHAMPION_DEFEAT_SHOWS_REQUIRED
  );
}

export function getGrandChampionMilestoneTitle(
  grandPoints: number
): string | null {
  return (
    GRAND_CHAMPION_MILESTONE_TITLES.find(
      (milestone) => grandPoints >= milestone.pointsRequired
    )?.titleCode ?? null
  );
}

export function getHighestConformationTitle(
  progress: ConformationTitleProgress
): string | null {
  if (isGrandChampionComplete(progress)) {
    return getGrandChampionMilestoneTitle(progress.grandPoints);
  }

  if (
    progress.currentTitleCode === CHAMPION_TITLE_CODE ||
    (progress.championshipPoints >= CHAMPIONSHIP_POINTS_REQUIRED &&
      progress.majorCount >= CHAMPIONSHIP_MAJORS_REQUIRED)
  ) {
    return CHAMPION_TITLE_CODE;
  }

  return null;
}

export function getGrandChampionNoticeText(args: {
  dog: TitleNoticeDog;
  titleCode: string;
}): { title: string; body: string } {
  const dogName = formatDogDisplayName({
    ...args.dog,
    visibleTitlePrefix: args.titleCode,
  });

  if (args.titleCode === "GCH") {
    return {
      title: "New Grand Champion",
      body: `${dogName} has earned their Grand Champion title.`,
    };
  }

  return {
    title: `New ${args.titleCode} title`,
    body: `${dogName} has advanced to ${args.titleCode}.`,
  };
}

export function getGrandChampionCompletionFields(args: {
  progress: GrandChampionCompletionSnapshot;
  showDayId: string;
  currentEpoch: number;
}): {
  grandCompletedAtShowDayId?: string;
  grandCompletedAtEpoch?: number;
} {
  if (
    !isGrandChampionComplete(args.progress) ||
    isGrandChampionTitleCode(args.progress.currentTitleCode)
  ) {
    return {};
  }

  return {
    grandCompletedAtShowDayId:
      args.progress.grandCompletedAtShowDayId ?? args.showDayId,
    grandCompletedAtEpoch:
      args.progress.grandCompletedAtEpoch ?? args.currentEpoch,
  };
}

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
        sireId: true,
        damId: true,
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
      },
    }),
    tx.dogTitleProgress.findUnique({
      where: { dogId },
      select: {
        championshipPoints: true,
        majorCount: true,
        grandPoints: true,
        grandMajorCount: true,
        grandChampionDefeatShowCount: true,
        currentTitleCode: true,
      },
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
  const nextCurrentTitleCode = getHighestConformationTitle({
    championshipPoints: summary.championshipPoints,
    majorCount: summary.majorCount,
    grandPoints: previousProgress?.grandPoints ?? 0,
    grandMajorCount: previousProgress?.grandMajorCount ?? 0,
    grandChampionDefeatShowCount:
      previousProgress?.grandChampionDefeatShowCount ?? 0,
    currentTitleCode:
      previousProgress?.currentTitleCode ?? summary.currentTitleCode,
  });

  await tx.dogTitleProgress.upsert({
    where: { dogId },
    update: {
      championshipPoints: summary.championshipPoints,
      majorCount: summary.majorCount,
      currentTitleCode: nextCurrentTitleCode,
      winsByTypeJson: summary.winsByTypeJson,
    },
    create: {
      dogId,
      championshipPoints: summary.championshipPoints,
      majorCount: summary.majorCount,
      currentTitleCode: nextCurrentTitleCode,
      winsByTypeJson: summary.winsByTypeJson,
    },
  });

  const becameChampion =
    nextCurrentTitleCode === CHAMPION_TITLE_CODE &&
    !isChampionOfRecordTitleCode(previousProgress?.currentTitleCode);

  if (nextCurrentTitleCode) {
    await tx.dog.update({
      where: { id: dogId },
      data: {
        visibleTitlePrefix: nextCurrentTitleCode,
      },
    });

    if (becameChampion && dog) {
      await recalculateProducerMeritForDogs({
        tx,
        dogIds: [dog.sireId, dog.damId],
      });
    }

    if (dog?.ownerKennelId && becameChampion) {
      await createKennelNotice({
        client: tx,
        kennelId: dog.ownerKennelId,
        type: "NEW_CHAMPION",
        title: "New champion",
        body: `${formatDogDisplayName({
          ...dog,
          visibleTitlePrefix: nextCurrentTitleCode,
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

export async function promoteGrandChampionTitleForDog(args: {
  tx: TransactionClient;
  dogId: string;
  showDayId: string;
  currentEpoch: number;
}) {
  const [dog, progress] = await Promise.all([
    args.tx.dog.findUnique({
      where: { id: args.dogId },
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
    args.tx.dogTitleProgress.findUnique({
      where: { dogId: args.dogId },
      select: {
        championshipPoints: true,
        majorCount: true,
        grandPoints: true,
        grandMajorCount: true,
        grandChampionDefeatShowCount: true,
        grandCompletedAtShowDayId: true,
        grandCompletedAtEpoch: true,
        currentTitleCode: true,
      },
    }),
  ]);

  if (!dog || !progress) {
    return null;
  }

  const championStatusTitleCode =
    progress.currentTitleCode ??
    (isChampionOfRecordTitleCode(dog.visibleTitlePrefix)
      ? dog.visibleTitlePrefix
      : null);
  const promotionProgress = {
    ...progress,
    currentTitleCode: championStatusTitleCode,
  };
  const nextTitleCode = getHighestConformationTitle(promotionProgress);

  if (!nextTitleCode) {
    return null;
  }

  const completionFields = getGrandChampionCompletionFields({
    progress: promotionProgress,
    showDayId: args.showDayId,
    currentEpoch: args.currentEpoch,
  });
  const previousTitleCode = progress.currentTitleCode;
  const advancedGrandChampionTitle =
    previousTitleCode !== nextTitleCode && isGrandChampionTitleCode(nextTitleCode);

  if (
    previousTitleCode !== nextTitleCode ||
    dog.visibleTitlePrefix !== nextTitleCode ||
    Object.keys(completionFields).length > 0
  ) {
    await args.tx.dogTitleProgress.update({
      where: { dogId: args.dogId },
      data: {
        currentTitleCode: nextTitleCode,
        ...completionFields,
      },
    });

    await args.tx.dog.update({
      where: { id: args.dogId },
      data: {
        visibleTitlePrefix: nextTitleCode,
      },
    });

    if (dog.ownerKennelId && advancedGrandChampionTitle) {
      const noticeText = getGrandChampionNoticeText({
        dog,
        titleCode: nextTitleCode,
      });

      await createKennelNotice({
        client: args.tx,
        kennelId: dog.ownerKennelId,
        type: "NEW_GRAND_CHAMPION",
        title: noticeText.title,
        body: noticeText.body,
        currentEpoch: args.currentEpoch,
        linkedDogId: dog.id,
        metadataJson: {
          titleCode: nextTitleCode,
          previousTitleCode,
          showDayId: args.showDayId,
        },
      });
    }
  }

  return {
    dogId: args.dogId,
    currentTitleCode: nextTitleCode,
    promotedToGrandChampion: isGrandChampionTitleCode(nextTitleCode),
  };
}

export async function promoteGrandChampionTitlesForDogs(args: {
  tx: TransactionClient;
  dogIds: string[];
  showDayId: string;
  currentEpoch: number;
}) {
  const uniqueDogIds = [...new Set(args.dogIds)];
  const promotions: Array<{
    dogId: string;
    currentTitleCode: string;
    promotedToGrandChampion: boolean;
  }> = [];

  for (const dogId of uniqueDogIds) {
    const promotion = await promoteGrandChampionTitleForDog({
      tx: args.tx,
      dogId,
      showDayId: args.showDayId,
      currentEpoch: args.currentEpoch,
    });

    if (promotion) {
      promotions.push(promotion);
    }
  }

  return promotions;
}
