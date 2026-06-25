import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { hasAllGreenPhenotypeHealthTests } from "@/lib/dogHealth";
import { CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES } from "@/lib/dogTitles";
import { SHOW_YEAR_HOURS } from "@showring/rules";

const CHAMPION_TITLE_CODE = "CH";
const CHAMPION_OF_RECORD_TITLE_CODES = [
  ...CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES,
];
const GRAND_CHAMPION_TITLE_CODES = CHAMPION_OF_RECORD_TITLE_CODES.filter(
  (titleCode) => titleCode !== CHAMPION_TITLE_CODE
);
const GRAND_CHAMPION_TITLE_CODE_SET = new Set<string>(
  GRAND_CHAMPION_TITLE_CODES
);
const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const GRAND_CHAMPIONSHIP_POINTS_REQUIRED = 25;
const GRAND_CHAMPIONSHIP_MAJORS_REQUIRED = 3;
const GRAND_CHAMPIONSHIP_DEFEAT_SHOWS_REQUIRED = 3;
const GRAND_CHAMPION_OWNER_HANDLED_PRESTIGE = 45;
const GRAND_CHAMPION_HANDLER_PRESTIGE = 30;
const GRAND_CHAMPION_UNKNOWN_HANDLING_PRESTIGE = 30;
const GRAND_CHAMPION_MILESTONE_PRESTIGE = [
  { titleCode: "GCHB", pointsRequired: 100, prestige: 20 },
  { titleCode: "GCHS", pointsRequired: 200, prestige: 30 },
  { titleCode: "GCHG", pointsRequired: 400, prestige: 40 },
  { titleCode: "GCHP", pointsRequired: 800, prestige: 50 },
  { titleCode: "GCHP2", pointsRequired: 1600, prestige: 25 },
  { titleCode: "GCHP3", pointsRequired: 2400, prestige: 25 },
  { titleCode: "GCHP4", pointsRequired: 3200, prestige: 25 },
  { titleCode: "GCHP5", pointsRequired: 4000, prestige: 25 },
] as const;

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

type KennelMeta = {
  id: string;
  name: string;
  slug: string;
};

type KennelPrestigeAccumulator = {
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
    grandChampionsCompletedOwnerHandled: number;
    grandChampionsCompletedWithHandler: number;
    grandChampionsCompletedHandlingUnknown: number;
    grandChampionMilestoneTitles: number;
    grandChampionMilestonePrestige: number;
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

export type KennelPrestigeSummary = {
  score: number;
  tier: PrestigeTier;
  currentYear: number;
  categories: KennelPrestigeAccumulator["categories"];
  metrics: KennelPrestigeAccumulator["metrics"];
};

export type KennelPrestigeLeaderboardRow = {
  rank: number;
  kennel: KennelMeta;
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

function isGrandChampionTitleCode(titleCode: string | null | undefined): boolean {
  return GRAND_CHAMPION_TITLE_CODE_SET.has(
    titleCode?.trim().toUpperCase() ?? ""
  );
}

export function isGrandChampionPrestigeComplete(progress: {
  currentTitleCode: string | null;
  grandPoints: number;
  grandMajorCount: number;
  grandChampionDefeatShowCount: number;
}): boolean {
  return (
    isGrandChampionTitleCode(progress.currentTitleCode) &&
    progress.grandPoints >= GRAND_CHAMPIONSHIP_POINTS_REQUIRED &&
    progress.grandMajorCount >= GRAND_CHAMPIONSHIP_MAJORS_REQUIRED &&
    progress.grandChampionDefeatShowCount >=
      GRAND_CHAMPIONSHIP_DEFEAT_SHOWS_REQUIRED
  );
}

export function getGrandChampionCompletionPrestigeForHandling(
  handlerUsed: boolean | null | undefined
): number {
  if (handlerUsed === false) {
    return GRAND_CHAMPION_OWNER_HANDLED_PRESTIGE;
  }

  if (handlerUsed === true) {
    return GRAND_CHAMPION_HANDLER_PRESTIGE;
  }

  return GRAND_CHAMPION_UNKNOWN_HANDLING_PRESTIGE;
}

export function getGrandChampionMilestonePrestige(grandPoints: number): {
  milestoneCount: number;
  prestige: number;
} {
  const achievedMilestones = GRAND_CHAMPION_MILESTONE_PRESTIGE.filter(
    (milestone) => grandPoints >= milestone.pointsRequired
  );

  return {
    milestoneCount: achievedMilestones.length,
    prestige: achievedMilestones.reduce(
      (total, milestone) => total + milestone.prestige,
      0
    ),
  };
}

function createEmptyAccumulator(): KennelPrestigeAccumulator {
  return {
    categories: {
      breeding: 0,
      show: 0,
      legacy: 0,
      care: 0,
    },
    metrics: {
      championsBred: 0,
      championProducingLitters: 0,
      championsFinishedOwnerHandled: 0,
      championsFinishedWithHandler: 0,
      grandChampionsCompletedOwnerHandled: 0,
      grandChampionsCompletedWithHandler: 0,
      grandChampionsCompletedHandlingUnknown: 0,
      grandChampionMilestoneTitles: 0,
      grandChampionMilestonePrestige: 0,
      allGreenChampionsBred: 0,
      currentBreedTopTenOwned: 0,
      currentBreedTopTenBred: 0,
      currentAllBreedTopTenOwned: 0,
      currentAllBreedTopTenBred: 0,
      currentBreedNumberOnes: 0,
      currentAllBreedNumberOnes: 0,
      bestInShowWins: 0,
      reserveBestInShowWins: 0,
      groupOneWins: 0,
      groupPlacements: 0,
    },
  };
}

function finalizeSummary(
  accumulator: KennelPrestigeAccumulator,
  currentYear: number
): KennelPrestigeSummary {
  accumulator.categories.breeding =
    accumulator.metrics.championsBred * 120 +
    accumulator.metrics.championProducingLitters * 35;
  accumulator.categories.show =
    accumulator.metrics.championsFinishedOwnerHandled * 90 +
    accumulator.metrics.championsFinishedWithHandler * 65 +
    accumulator.metrics.grandChampionsCompletedOwnerHandled *
      GRAND_CHAMPION_OWNER_HANDLED_PRESTIGE +
    accumulator.metrics.grandChampionsCompletedWithHandler *
      GRAND_CHAMPION_HANDLER_PRESTIGE +
    accumulator.metrics.grandChampionsCompletedHandlingUnknown *
      GRAND_CHAMPION_UNKNOWN_HANDLING_PRESTIGE +
    accumulator.metrics.grandChampionMilestonePrestige +
    accumulator.metrics.bestInShowWins * 90 +
    accumulator.metrics.reserveBestInShowWins * 60 +
    accumulator.metrics.groupOneWins * 35 +
    (accumulator.metrics.groupPlacements - accumulator.metrics.groupOneWins) *
      12;
  accumulator.categories.legacy =
    accumulator.metrics.currentBreedTopTenOwned * 25 +
    accumulator.metrics.currentBreedTopTenBred * 35 +
    accumulator.metrics.currentAllBreedTopTenOwned * 60 +
    accumulator.metrics.currentAllBreedTopTenBred * 75 +
    accumulator.metrics.currentBreedNumberOnes * 50 +
    accumulator.metrics.currentAllBreedNumberOnes * 100;
  accumulator.categories.care =
    accumulator.metrics.allGreenChampionsBred * 30;

  const score =
    accumulator.categories.breeding +
    accumulator.categories.show +
    accumulator.categories.legacy +
    accumulator.categories.care;

  return {
    score,
    tier: getPrestigeTier(score),
    currentYear,
    categories: accumulator.categories,
    metrics: accumulator.metrics,
  };
}

async function buildKennelPrestigeSummaries(
  options: KennelPrestigeOptions = {},
  kennelIds?: string[]
) {
  const currentYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const breedCode2 = options.breedCode2?.trim().toUpperCase() || null;
  const kennelFilter = kennelIds?.length ? { id: { in: kennelIds } } : {};
  const kennels = await db.kennel.findMany({
    where: {
      isNpc: false,
      userId: {
        not: null,
      },
      ...kennelFilter,
    },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  const kennelMetaById = new Map(kennels.map((kennel) => [kennel.id, kennel]));
  const playerKennelIds = kennels.map((kennel) => kennel.id);
  const summariesByKennelId = new Map<string, KennelPrestigeAccumulator>();
  const championLittersByKennelId = new Map<string, Set<string>>();

  for (const kennel of kennels) {
    summariesByKennelId.set(kennel.id, createEmptyAccumulator());
    championLittersByKennelId.set(kennel.id, new Set<string>());
  }

  if (playerKennelIds.length === 0) {
    return { currentYear, kennelMetaById, summariesByKennelId };
  }

  const [
    championDogs,
    pointAwards,
    majorAwards,
    currentYearStats,
    grandChampionDogs,
  ] =
    await Promise.all([
      db.dog.findMany({
        where: {
          ...(breedCode2 ? { breedCode2 } : {}),
          breederKennelId: {
            in: playerKennelIds,
          },
          OR: [
            { visibleTitlePrefix: { in: CHAMPION_OF_RECORD_TITLE_CODES } },
            {
              titleProgress: {
                is: {
                  currentTitleCode: { in: CHAMPION_OF_RECORD_TITLE_CODES },
                },
              },
            },
          ],
        },
        select: {
          breedCode2: true,
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
          showEntry: {
            kennelId: {
              in: playerKennelIds,
            },
          },
          dog: {
            OR: [
              { visibleTitlePrefix: { in: CHAMPION_OF_RECORD_TITLE_CODES } },
              {
                titleProgress: {
                  is: {
                    currentTitleCode: { in: CHAMPION_OF_RECORD_TITLE_CODES },
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
      db.showAward.findMany({
        where: {
          ...(breedCode2 ? { breedCode2 } : {}),
          awardCode: {
            in: [...BIS_AWARD_CODES, ...GROUP_AWARD_CODES],
          },
          showEntry: {
            kennelId: {
              in: playerKennelIds,
            },
          },
        },
        select: {
          awardCode: true,
          showEntry: {
            select: {
              kennelId: true,
            },
          },
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
      db.dog.findMany({
        where: {
          ...(breedCode2 ? { breedCode2 } : {}),
          ownerKennelId: {
            in: playerKennelIds,
          },
          titleProgress: {
            is: {
              currentTitleCode: { in: GRAND_CHAMPION_TITLE_CODES },
            },
          },
        },
        select: {
          id: true,
          ownerKennelId: true,
          titleProgress: {
            select: {
              currentTitleCode: true,
              grandPoints: true,
              grandMajorCount: true,
              grandChampionDefeatShowCount: true,
              grandCompletedAtShowDayId: true,
            },
          },
        },
      }),
    ]);
  const grandChampionCompletionShowDayIds = [
    ...new Set(
      grandChampionDogs
        .map((dog) => dog.titleProgress?.grandCompletedAtShowDayId)
        .filter((showDayId): showDayId is string => Boolean(showDayId))
    ),
  ];
  const grandChampionCompletionEntries =
    grandChampionCompletionShowDayIds.length > 0
      ? await db.showEntry.findMany({
          where: {
            dogId: {
              in: grandChampionDogs.map((dog) => dog.id),
            },
            showDayId: {
              in: grandChampionCompletionShowDayIds,
            },
          },
          select: {
            dogId: true,
            showDayId: true,
            handlerUsed: true,
          },
        })
      : [];
  const grandChampionCompletionEntryByDogAndShowDay = new Map(
    grandChampionCompletionEntries.map((entry) => [
      `${entry.dogId}:${entry.showDayId}`,
      entry,
    ])
  );

  for (const dog of championDogs) {
    if (!dog.breederKennelId) {
      continue;
    }

    const accumulator = summariesByKennelId.get(dog.breederKennelId);
    const litterIds = championLittersByKennelId.get(dog.breederKennelId);

    if (!accumulator || !litterIds) {
      continue;
    }

    accumulator.metrics.championsBred += 1;

    if (dog.litterId) {
      litterIds.add(dog.litterId);
    }

    if (hasAllGreenPhenotypeHealthTests(dog.healthTests, dog.breedCode2)) {
      accumulator.metrics.allGreenChampionsBred += 1;
    }
  }

  for (const [kennelId, litterIds] of championLittersByKennelId.entries()) {
    const accumulator = summariesByKennelId.get(kennelId);

    if (accumulator) {
      accumulator.metrics.championProducingLitters = litterIds.size;
    }
  }

  for (const award of findFinishingAwards(pointAwards)) {
    const accumulator = summariesByKennelId.get(award.showEntry.kennelId);

    if (!accumulator) {
      continue;
    }

    if (award.showEntry.handlerUsed) {
      accumulator.metrics.championsFinishedWithHandler += 1;
    } else {
      accumulator.metrics.championsFinishedOwnerHandled += 1;
    }
  }

  for (const dog of grandChampionDogs) {
    if (!dog.ownerKennelId || !dog.titleProgress) {
      continue;
    }

    const accumulator = summariesByKennelId.get(dog.ownerKennelId);

    if (!accumulator || !isGrandChampionPrestigeComplete(dog.titleProgress)) {
      continue;
    }

    const completionShowDayId = dog.titleProgress.grandCompletedAtShowDayId;
    const completionEntry = completionShowDayId
      ? grandChampionCompletionEntryByDogAndShowDay.get(
          `${dog.id}:${completionShowDayId}`
        )
      : null;

    if (!completionEntry) {
      accumulator.metrics.grandChampionsCompletedHandlingUnknown += 1;
    } else if (completionEntry.handlerUsed) {
      accumulator.metrics.grandChampionsCompletedWithHandler += 1;
    } else {
      accumulator.metrics.grandChampionsCompletedOwnerHandled += 1;
    }

    const milestonePrestige = getGrandChampionMilestonePrestige(
      dog.titleProgress.grandPoints
    );
    accumulator.metrics.grandChampionMilestoneTitles +=
      milestonePrestige.milestoneCount;
    accumulator.metrics.grandChampionMilestonePrestige +=
      milestonePrestige.prestige;
  }

  for (const award of majorAwards) {
    const accumulator = summariesByKennelId.get(award.showEntry.kennelId);

    if (!accumulator) {
      continue;
    }

    if (award.awardCode === "BIS") {
      accumulator.metrics.bestInShowWins += 1;
    } else if (award.awardCode === "RBIS") {
      accumulator.metrics.reserveBestInShowWins += 1;
    } else if (award.awardCode === "G1") {
      accumulator.metrics.groupOneWins += 1;
      accumulator.metrics.groupPlacements += 1;
    } else if (GROUP_AWARD_CODES.includes(award.awardCode as (typeof GROUP_AWARD_CODES)[number])) {
      accumulator.metrics.groupPlacements += 1;
    }
  }

  const allBreedTopTen = rankTopTen(
    currentYearStats.filter((stat) => stat.allBreedDogsBeaten > 0),
    compareAllBreedPrestige
  );
  const breedStatsByBreed = new Map<string, typeof currentYearStats>();

  for (const stat of currentYearStats) {
    if (stat.breedDogsBeaten <= 0) {
      continue;
    }

    const stats = breedStatsByBreed.get(stat.breedCode2) ?? [];
    stats.push(stat);
    breedStatsByBreed.set(stat.breedCode2, stats);
  }

  const breedTopTen = [...breedStatsByBreed.values()].flatMap((stats) =>
    rankTopTen(stats, compareBreedPrestige)
  );

  for (const stat of allBreedTopTen) {
    const ownerAccumulator = stat.dog.ownerKennelId
      ? summariesByKennelId.get(stat.dog.ownerKennelId)
      : null;
    const breederAccumulator = stat.dog.breederKennelId
      ? summariesByKennelId.get(stat.dog.breederKennelId)
      : null;

    if (ownerAccumulator) {
      ownerAccumulator.metrics.currentAllBreedTopTenOwned += 1;
    }

    if (breederAccumulator) {
      breederAccumulator.metrics.currentAllBreedTopTenBred += 1;
    }

    if (stat.rank === 1) {
      const numberOneKennelIds = new Set(
        [stat.dog.ownerKennelId, stat.dog.breederKennelId].filter(
          (value): value is string => Boolean(value)
        )
      );

      for (const kennelId of numberOneKennelIds) {
        const accumulator = summariesByKennelId.get(kennelId);

        if (accumulator) {
          accumulator.metrics.currentAllBreedNumberOnes += 1;
        }
      }
    }
  }

  for (const stat of breedTopTen) {
    const ownerAccumulator = stat.dog.ownerKennelId
      ? summariesByKennelId.get(stat.dog.ownerKennelId)
      : null;
    const breederAccumulator = stat.dog.breederKennelId
      ? summariesByKennelId.get(stat.dog.breederKennelId)
      : null;

    if (ownerAccumulator) {
      ownerAccumulator.metrics.currentBreedTopTenOwned += 1;
    }

    if (breederAccumulator) {
      breederAccumulator.metrics.currentBreedTopTenBred += 1;
    }

    if (stat.rank === 1) {
      const numberOneKennelIds = new Set(
        [stat.dog.ownerKennelId, stat.dog.breederKennelId].filter(
          (value): value is string => Boolean(value)
        )
      );

      for (const kennelId of numberOneKennelIds) {
        const accumulator = summariesByKennelId.get(kennelId);

        if (accumulator) {
          accumulator.metrics.currentBreedNumberOnes += 1;
        }
      }
    }
  }

  return { currentYear, kennelMetaById, summariesByKennelId };
}

export async function getKennelPrestigeSummary(
  kennelId: string,
  options: KennelPrestigeOptions = {}
): Promise<KennelPrestigeSummary> {
  const { currentYear, summariesByKennelId } =
    await buildKennelPrestigeSummaries(options, [kennelId]);
  const accumulator =
    summariesByKennelId.get(kennelId) ?? createEmptyAccumulator();

  return finalizeSummary(accumulator, currentYear);
}

export async function getKennelPrestigeLeaderboard(args: {
  breedCode2?: string | null;
  take?: number;
} = {}): Promise<KennelPrestigeLeaderboardRow[]> {
  const take = args.take ?? 10;
  const { currentYear, kennelMetaById, summariesByKennelId } =
    await buildKennelPrestigeSummaries({
      breedCode2: args.breedCode2,
    });
  const rows = [...summariesByKennelId.entries()]
    .map(([kennelId, accumulator]) => {
      const kennel = kennelMetaById.get(kennelId);

      if (!kennel) {
        return null;
      }

      return {
        kennel,
        prestige: finalizeSummary(accumulator, currentYear),
      };
    })
    .filter(
      (
        row
      ): row is {
        kennel: KennelMeta;
        prestige: KennelPrestigeSummary;
      } => Boolean(row)
    )
    .filter((row) => row.prestige.score >= 1);

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
