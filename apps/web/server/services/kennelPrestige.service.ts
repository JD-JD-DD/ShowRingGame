import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { hasAllGreenPhenotypeHealthTests } from "@/lib/dogHealth";
import { SHOW_YEAR_HOURS } from "@showring/rules";

const CHAMPION_TITLE_CODE = "CH";
const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;

const GROUP_AWARD_CODES = ["G1", "G2", "G3", "G4"] as const;
const BIS_AWARD_CODES = ["BIS", "RBIS"] as const;

type PrestigeTier = {
  label: string;
  nextLabel: string | null;
  nextScore: number | null;
};

type PointAwardRow = {
  dogId: string;
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
  showDay: {
    scheduledEpoch: number;
  };
  showEntry: {
    kennelId: string;
    handlerUsed: boolean;
  };
};

export type KennelPrestigeSummary = {
  score: number;
  tier: PrestigeTier;
  currentYear: number;
  categories: {
    breeding: number;
    show: number;
    legacy: number;
    care: number;
  };
  metrics: {
    championsBred: number;
    championProducingLitters: number;
    championsFinishedOwnerHandled: number;
    championsFinishedWithHandler: number;
    allGreenChampionsBred: number;
    currentBreedTopTenOwned: number;
    currentBreedTopTenBred: number;
    currentAllBreedTopTenOwned: number;
    currentAllBreedTopTenBred: number;
    currentBreedNumberOnes: number;
    currentAllBreedNumberOnes: number;
    bestInShowWins: number;
    reserveBestInShowWins: number;
    groupOneWins: number;
    groupPlacements: number;
  };
};

export type KennelPrestigeLeaderboardRow = {
  rank: number;
  kennel: {
    id: string;
    name: string;
    slug: string;
  };
  prestige: KennelPrestigeSummary;
};

type KennelPrestigeOptions = {
  breedCode2?: string | null;
};

function getPrestigeTier(score: number): PrestigeTier {
  const tiers = [
    { min: 0, label: "New Kennel" },
    { min: 100, label: "Rising Kennel" },
    { min: 300, label: "Established Kennel" },
    { min: 750, label: "Respected Kennel" },
    { min: 1500, label: "Premier Kennel" },
    { min: 3000, label: "Elite Kennel" },
    { min: 6000, label: "Hallmark Kennel" },
  ];
  const currentIndex = tiers.findLastIndex((tier) => score >= tier.min);
  const current = tiers[Math.max(0, currentIndex)];
  const next = tiers[currentIndex + 1] ?? null;

  return {
    label: current.label,
    nextLabel: next?.label ?? null,
    nextScore: next?.min ?? null,
  };
}

function countAward(
  awards: Array<{ awardCode: string; _count: { awardCode: number } }>,
  awardCode: string
): number {
  return (
    awards.find((award) => award.awardCode === awardCode)?._count.awardCode ??
    0
  );
}

function rankTopTen<T>(
  rows: T[],
  compare: (a: T, b: T) => number
): Array<T & { rank: number }> {
  return [...rows]
    .sort(compare)
    .slice(0, 10)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function compareAllBreedPrestige(
  a: {
    allBreedDogsBeaten: number;
    bestInShowWinCount: number;
    groupWinCount: number;
    breedDogsBeaten: number;
  },
  b: {
    allBreedDogsBeaten: number;
    bestInShowWinCount: number;
    groupWinCount: number;
    breedDogsBeaten: number;
  }
) {
  return (
    b.allBreedDogsBeaten - a.allBreedDogsBeaten ||
    b.bestInShowWinCount - a.bestInShowWinCount ||
    b.groupWinCount - a.groupWinCount ||
    b.breedDogsBeaten - a.breedDogsBeaten
  );
}

function compareBreedPrestige(
  a: {
    breedDogsBeaten: number;
    breedWinCount: number;
    allBreedDogsBeaten: number;
  },
  b: {
    breedDogsBeaten: number;
    breedWinCount: number;
    allBreedDogsBeaten: number;
  }
) {
  return (
    b.breedDogsBeaten - a.breedDogsBeaten ||
    b.breedWinCount - a.breedWinCount ||
    b.allBreedDogsBeaten - a.allBreedDogsBeaten
  );
}

function findFinishingAwards(pointAwards: PointAwardRow[]) {
  const awardsByDog = new Map<string, PointAwardRow[]>();

  for (const award of pointAwards) {
    const awards = awardsByDog.get(award.dogId) ?? [];
    awards.push(award);
    awardsByDog.set(award.dogId, awards);
  }

  const finishingAwards: PointAwardRow[] = [];

  for (const awards of awardsByDog.values()) {
    const bestAwardByShowDay = new Map<string, PointAwardRow>();

    for (const award of awards) {
      const existing = bestAwardByShowDay.get(award.showDayId);

      if (!existing || award.pointsAwarded > existing.pointsAwarded) {
        bestAwardByShowDay.set(award.showDayId, award);
      }
    }

    let points = 0;
    let majors = 0;
    const sortedAwards = [...bestAwardByShowDay.values()].sort(
      (a, b) => a.showDay.scheduledEpoch - b.showDay.scheduledEpoch
    );

    for (const award of sortedAwards) {
      points += award.pointsAwarded;

      if (award.isMajor || award.pointsAwarded >= 3) {
        majors += 1;
      }

      if (
        points >= CHAMPIONSHIP_POINTS_REQUIRED &&
        majors >= CHAMPIONSHIP_MAJORS_REQUIRED
      ) {
        finishingAwards.push(award);
        break;
      }
    }
  }

  return finishingAwards;
}

export async function getKennelPrestigeSummary(
  kennelId: string,
  options: KennelPrestigeOptions = {}
): Promise<KennelPrestigeSummary> {
  const currentYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const breedCode2 = options.breedCode2?.trim().toUpperCase() || null;

  const [
    championDogs,
    pointAwards,
    awardCounts,
    currentYearStats,
  ] = await Promise.all([
    db.dog.findMany({
      where: {
        ...(breedCode2 ? { breedCode2 } : {}),
        OR: [
          { visibleTitlePrefix: CHAMPION_TITLE_CODE },
          {
            titleProgress: {
              is: {
                currentTitleCode: CHAMPION_TITLE_CODE,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        breederKennelId: true,
        litterId: true,
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
    }),
    db.showAward.findMany({
      where: {
        ...(breedCode2 ? { breedCode2 } : {}),
        pointsAwarded: {
          gt: 0,
        },
        dog: {
          OR: [
            { visibleTitlePrefix: CHAMPION_TITLE_CODE },
            {
              titleProgress: {
                is: {
                  currentTitleCode: CHAMPION_TITLE_CODE,
                },
              },
            },
          ],
        },
      },
      select: {
        dogId: true,
        showDayId: true,
        pointsAwarded: true,
        isMajor: true,
        showDay: {
          select: {
            scheduledEpoch: true,
          },
        },
        showEntry: {
          select: {
            kennelId: true,
            handlerUsed: true,
          },
        },
      },
    }),
    db.showAward.groupBy({
      by: ["awardCode"],
      where: {
        ...(breedCode2 ? { breedCode2 } : {}),
        awardCode: {
          in: [...BIS_AWARD_CODES, ...GROUP_AWARD_CODES],
        },
        showEntry: {
          kennelId,
        },
      },
      _count: {
        awardCode: true,
      },
    }),
    db.dogYearlyPrestigeStat.findMany({
      where: {
        gameYear: currentYear,
        ...(breedCode2 ? { breedCode2 } : {}),
        OR: [
          {
            breedDogsBeaten: {
              gt: 0,
            },
          },
          {
            allBreedDogsBeaten: {
              gt: 0,
            },
          },
        ],
      },
      select: {
        dogId: true,
        breedCode2: true,
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
        breedWinCount: true,
        groupWinCount: true,
        bestInShowWinCount: true,
        dog: {
          select: {
            ownerKennelId: true,
            breederKennelId: true,
          },
        },
      },
    }),
  ]);

  const championsBred = championDogs.filter(
    (dog) => dog.breederKennelId === kennelId
  );
  const championProducingLitters = new Set(
    championsBred.map((dog) => dog.litterId).filter(Boolean)
  ).size;
  const allGreenChampionsBred = championsBred.filter((dog) =>
    hasAllGreenPhenotypeHealthTests(dog.healthTests)
  ).length;

  const finishingAwards = findFinishingAwards(pointAwards).filter(
    (award) => award.showEntry.kennelId === kennelId
  );
  const championsFinishedOwnerHandled = finishingAwards.filter(
    (award) => !award.showEntry.handlerUsed
  ).length;
  const championsFinishedWithHandler = finishingAwards.filter(
    (award) => award.showEntry.handlerUsed
  ).length;

  const allBreedTopTen = rankTopTen(
    currentYearStats.filter((stat) => stat.allBreedDogsBeaten > 0),
    compareAllBreedPrestige
  );
  const breedStatsByBreed = new Map<string, typeof currentYearStats>();

  for (const stat of currentYearStats.filter(
    (row) => row.breedDogsBeaten > 0
  )) {
    const stats = breedStatsByBreed.get(stat.breedCode2) ?? [];
    stats.push(stat);
    breedStatsByBreed.set(stat.breedCode2, stats);
  }

  const breedTopTen = [...breedStatsByBreed.values()].flatMap((stats) =>
    rankTopTen(stats, compareBreedPrestige)
  );
  const currentBreedTopTenOwned = breedTopTen.filter(
    (stat) => stat.dog.ownerKennelId === kennelId
  ).length;
  const currentBreedTopTenBred = breedTopTen.filter(
    (stat) => stat.dog.breederKennelId === kennelId
  ).length;
  const currentAllBreedTopTenOwned = allBreedTopTen.filter(
    (stat) => stat.dog.ownerKennelId === kennelId
  ).length;
  const currentAllBreedTopTenBred = allBreedTopTen.filter(
    (stat) => stat.dog.breederKennelId === kennelId
  ).length;
  const currentBreedNumberOnes = breedTopTen.filter(
    (stat) =>
      stat.rank === 1 &&
      (stat.dog.ownerKennelId === kennelId ||
        stat.dog.breederKennelId === kennelId)
  ).length;
  const currentAllBreedNumberOnes = allBreedTopTen.filter(
    (stat) =>
      stat.rank === 1 &&
      (stat.dog.ownerKennelId === kennelId ||
        stat.dog.breederKennelId === kennelId)
  ).length;
  const bestInShowWins = countAward(awardCounts, "BIS");
  const reserveBestInShowWins = countAward(awardCounts, "RBIS");
  const groupOneWins = countAward(awardCounts, "G1");
  const groupPlacements = GROUP_AWARD_CODES.reduce(
    (total, awardCode) => total + countAward(awardCounts, awardCode),
    0
  );

  const breeding =
    championsBred.length * 120 + championProducingLitters * 35;
  const show =
    championsFinishedOwnerHandled * 90 +
    championsFinishedWithHandler * 65 +
    bestInShowWins * 90 +
    reserveBestInShowWins * 60 +
    groupOneWins * 35 +
    (groupPlacements - groupOneWins) * 12;
  const legacy =
    currentBreedTopTenOwned * 25 +
    currentBreedTopTenBred * 35 +
    currentAllBreedTopTenOwned * 60 +
    currentAllBreedTopTenBred * 75 +
    currentBreedNumberOnes * 50 +
    currentAllBreedNumberOnes * 100;
  const care = allGreenChampionsBred * 30;
  const score = breeding + show + legacy + care;

  return {
    score,
    tier: getPrestigeTier(score),
    currentYear,
    categories: {
      breeding,
      show,
      legacy,
      care,
    },
    metrics: {
      championsBred: championsBred.length,
      championProducingLitters,
      championsFinishedOwnerHandled,
      championsFinishedWithHandler,
      allGreenChampionsBred,
      currentBreedTopTenOwned,
      currentBreedTopTenBred,
      currentAllBreedTopTenOwned,
      currentAllBreedTopTenBred,
      currentBreedNumberOnes,
      currentAllBreedNumberOnes,
      bestInShowWins,
      reserveBestInShowWins,
      groupOneWins,
      groupPlacements,
    },
  };
}

export async function getKennelPrestigeLeaderboard(args: {
  breedCode2?: string | null;
  take?: number;
} = {}): Promise<KennelPrestigeLeaderboardRow[]> {
  const take = args.take ?? 10;
  const kennels = await db.kennel.findMany({
    where: {
      isNpc: false,
      userId: {
        not: null,
      },
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
  const rows = await Promise.all(
    kennels.map(async (kennel) => ({
      kennel,
      prestige: await getKennelPrestigeSummary(kennel.id, {
        breedCode2: args.breedCode2,
      }),
    }))
  );

  return rows
    .sort(
      (a, b) =>
        b.prestige.score - a.prestige.score ||
        b.prestige.categories.breeding - a.prestige.categories.breeding ||
        b.prestige.categories.show - a.prestige.categories.show ||
        a.kennel.name.localeCompare(b.kennel.name)
    )
    .slice(0, take)
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}
