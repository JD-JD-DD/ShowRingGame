import { Prisma } from "@prisma/client";
import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "@showring/rules";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import {
  getGrandChampionMilestoneTitle,
  isGrandChampionComplete,
} from "@/server/services/titleProgress.service";

const CHAMPIONSHIP_POINTS_REQUIRED = 15;
const CHAMPIONSHIP_MAJORS_REQUIRED = 2;
const GRAND_CHAMPION_POINTS_REQUIRED = 25;
const GRAND_CHAMPION_MAJORS_REQUIRED = 3;
const GRAND_CHAMPION_DEFEAT_SHOWS_REQUIRED = 3;

const DISPLAY_AWARD_CODES = [
  "BIS",
  "RBIS",
  "G1",
  "G2",
  "G3",
  "G4",
  "BOB",
  "BOS",
  "SELECT_DOG",
  "SELECT_BITCH",
] as const;

const RIBBON_AWARDS = [
  "BIS",
  "RBIS",
  "G1",
  "G2",
  "G3",
  "G4",
  "BOB",
  "BOS",
  "SELECT",
] as const;

const INVITATIONAL_AWARD_STATUS_PRIORITY = [
  "BIS",
  "RBIS",
  "G1",
  "G2",
  "G3",
  "G4",
  "BOB",
  "BOS",
  "SELECT",
] as const;

export type RibbonRoomAwardCode = (typeof RIBBON_AWARDS)[number];

export type RibbonRoomDogDto = {
  id: string;
  regNumber: string;
  registeredName: string | null;
  callName: string | null;
  breed: {
    code2: string;
    name: string;
    groupName: string | null;
  };
  sex: "M" | "F";
  photo: null;
  dogPageUrl: string;
};

export type RibbonRoomChampionDto = {
  points: number;
  majors: number;
  judges: number;
  completed: boolean;
  title: string | null;
};

export type RibbonRoomGrandChampionDto = {
  points: number;
  majors: number;
  judges: number;
  completed: boolean;
  level: string | null;
};

export type RibbonRoomPrestigeStatsDto = {
  breedDogsBeaten: number;
  groupDogsBeaten: number;
  allBreedDogsBeaten: number;
  breedRank: number | null;
  groupRank: number | null;
  allBreedRank: number | null;
};

export type RibbonRoomRibbonOccurrenceDto = {
  show: {
    id: string;
    name: string;
  };
  judge: {
    id: string;
    name: string;
  };
  year: number;
  week: number;
  dogsDefeated: number;
  pointsEarned: number;
  award: RibbonRoomAwardCode;
  originalAwardCode: string;
  awardGroup: string;
};

export type RibbonRoomRibbonTotalDto = {
  award: RibbonRoomAwardCode;
  count: number;
  history: RibbonRoomRibbonOccurrenceDto[];
};

export type RibbonRoomInvitationalStatus =
  | "INVITED"
  | "BEST_IN_SHOW"
  | "RESERVE_BEST_IN_SHOW"
  | "GROUP_FIRST"
  | "GROUP_SECOND"
  | "GROUP_THIRD"
  | "GROUP_FOURTH"
  | "BEST_OF_BREED"
  | "BEST_OF_OPPOSITE_SEX"
  | "SELECT";

export type RibbonRoomInvitationalDto = {
  year: number;
  week: number;
  status: RibbonRoomInvitationalStatus;
};

export type RibbonRoomMilestoneType =
  | "FIRST_ENTRY"
  | "FIRST_RIBBON"
  | "FIRST_BOB"
  | "FIRST_BOS"
  | "FIRST_SELECT"
  | "FIRST_GROUP"
  | "FIRST_G1"
  | "FIRST_RBIS"
  | "FIRST_BIS"
  | "CHAMPION"
  | "GRAND_CHAMPION"
  | "FIRST_INVITATIONAL_QUALIFICATION"
  | "FIRST_INVITATIONAL_PLACEMENT";

export type RibbonRoomMilestoneDto = {
  type: RibbonRoomMilestoneType;
  year: number;
  week: number;
};

export type DogRibbonRoomDto = {
  dog: RibbonRoomDogDto;
  champion: RibbonRoomChampionDto;
  grandChampion: RibbonRoomGrandChampionDto;
  lifetime: RibbonRoomPrestigeStatsDto;
  currentYear: RibbonRoomPrestigeStatsDto;
  ribbons: RibbonRoomRibbonTotalDto[];
  invitational: RibbonRoomInvitationalDto[];
  milestones: RibbonRoomMilestoneDto[];
};

type TitleProgressInput = {
  championshipPoints: number;
  majorCount: number;
  grandPoints: number;
  grandMajorCount: number;
  grandChampionDefeatShowCount: number;
  currentTitleCode: string | null;
};

export function normalizeRibbonAwardCode(
  awardCode: string
): RibbonRoomAwardCode | null {
  if (awardCode === "SELECT_DOG" || awardCode === "SELECT_BITCH") {
    return "SELECT";
  }

  return RIBBON_AWARDS.includes(awardCode as RibbonRoomAwardCode)
    ? (awardCode as RibbonRoomAwardCode)
    : null;
}

function getWeekForEpoch(scheduledEpoch: number): number {
  const hourInYear = Math.min(
    ((scheduledEpoch % SHOW_YEAR_HOURS) + SHOW_YEAR_HOURS) % SHOW_YEAR_HOURS,
    SHOW_YEAR_HOURS - 2
  );

  return Math.floor(hourInYear / SHOW_WEEK_HOURS) + 1;
}

export function summarizeChampionProgress(args: {
  titleProgress: TitleProgressInput | null;
  judgeIds: string[];
}): RibbonRoomChampionDto {
  const points = args.titleProgress?.championshipPoints ?? 0;
  const majors = args.titleProgress?.majorCount ?? 0;
  const completed =
    points >= CHAMPIONSHIP_POINTS_REQUIRED &&
    majors >= CHAMPIONSHIP_MAJORS_REQUIRED;

  return {
    points,
    majors,
    judges: new Set(args.judgeIds).size,
    completed,
    title: completed ? "CH" : null,
  };
}

export function summarizeGrandChampionProgress(args: {
  titleProgress: TitleProgressInput | null;
  judgeIds: string[];
}): RibbonRoomGrandChampionDto {
  const points = args.titleProgress?.grandPoints ?? 0;
  const majors = args.titleProgress?.grandMajorCount ?? 0;
  const completed = args.titleProgress
    ? isGrandChampionComplete(args.titleProgress)
    : false;

  return {
    points,
    majors,
    judges: new Set(args.judgeIds).size,
    completed,
    level: completed ? getGrandChampionMilestoneTitle(points) : null,
  };
}

type RibbonAwardInput = {
  awardCode: string;
  awardGroup: string;
  pointsAwarded: number;
  dogPrestigeCredit?: {
    breedDogsBeaten: number;
    allBreedDogsBeaten: number;
  } | null;
  grandChampionCredit?: {
    pointsAwarded: number;
  } | null;
  showDay: {
    scheduledEpoch: number;
    cluster: {
      id: string;
      name: string;
      year: number;
    };
  };
  judge: {
    id: string;
    name: string;
  };
};

function getDogsDefeatedForAward(
  award: RibbonRoomAwardCode,
  credit: RibbonAwardInput["dogPrestigeCredit"]
): number {
  if (!credit) {
    return 0;
  }

  return award === "BOB" || award === "BOS" || award === "SELECT"
    ? credit.breedDogsBeaten
    : credit.allBreedDogsBeaten;
}

export function buildRibbonTotals(
  awards: RibbonAwardInput[]
): RibbonRoomRibbonTotalDto[] {
  const totals = new Map<RibbonRoomAwardCode, RibbonRoomRibbonOccurrenceDto[]>();

  for (const award of awards) {
    const normalizedAward = normalizeRibbonAwardCode(award.awardCode);

    if (!normalizedAward) {
      continue;
    }

    const history = totals.get(normalizedAward) ?? [];
    history.push({
      show: {
        id: award.showDay.cluster.id,
        name: award.showDay.cluster.name,
      },
      judge: award.judge,
      year: award.showDay.cluster.year,
      week: getWeekForEpoch(award.showDay.scheduledEpoch),
      dogsDefeated: getDogsDefeatedForAward(
        normalizedAward,
        award.dogPrestigeCredit
      ),
      pointsEarned:
        award.grandChampionCredit?.pointsAwarded ?? award.pointsAwarded,
      award: normalizedAward,
      originalAwardCode: award.awardCode,
      awardGroup: award.awardGroup,
    });
    totals.set(normalizedAward, history);
  }

  return RIBBON_AWARDS.flatMap((award) => {
    const history = (totals.get(award) ?? []).sort(
      (a, b) => a.year - b.year || a.week - b.week
    );

    return history.length > 0
      ? [
          {
            award,
            count: history.length,
            history,
          },
        ]
      : [];
  });
}

type InvitationalRecordInput = {
  year: number;
  awardCode?: string | null;
};

function getInvitationalStatusForAward(
  award: RibbonRoomAwardCode
): RibbonRoomInvitationalStatus {
  switch (award) {
    case "BIS":
      return "BEST_IN_SHOW";
    case "RBIS":
      return "RESERVE_BEST_IN_SHOW";
    case "G1":
      return "GROUP_FIRST";
    case "G2":
      return "GROUP_SECOND";
    case "G3":
      return "GROUP_THIRD";
    case "G4":
      return "GROUP_FOURTH";
    case "BOB":
      return "BEST_OF_BREED";
    case "BOS":
      return "BEST_OF_OPPOSITE_SEX";
    case "SELECT":
      return "SELECT";
  }
}

export function buildInvitationalHistory(
  records: InvitationalRecordInput[]
): RibbonRoomInvitationalDto[] {
  const bestAwardByYear = new Map<number, RibbonRoomAwardCode | null>();

  for (const record of records) {
    const award = record.awardCode
      ? normalizeRibbonAwardCode(record.awardCode)
      : null;
    const previousAward = bestAwardByYear.get(record.year);

    if (!previousAward || !award) {
      bestAwardByYear.set(record.year, previousAward ?? award);
      continue;
    }

    const previousIndex = INVITATIONAL_AWARD_STATUS_PRIORITY.indexOf(previousAward);
    const nextIndex = INVITATIONAL_AWARD_STATUS_PRIORITY.indexOf(award);

    bestAwardByYear.set(
      record.year,
      nextIndex >= 0 && nextIndex < previousIndex ? award : previousAward
    );
  }

  return [...bestAwardByYear.entries()]
    .sort(([yearA], [yearB]) => yearA - yearB)
    .map(([year, award]) => ({
      year,
      week: 52,
      status: award ? getInvitationalStatusForAward(award) : "INVITED",
    }));
}

type ChronologicalEventInput = {
  year: number;
  week: number;
  scheduledEpoch: number;
};

type MilestoneAwardInput = ChronologicalEventInput & {
  awardCode: string;
};

type ChampionPointAwardInput = ChronologicalEventInput & {
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
};

type GrandChampionCreditInput = ChronologicalEventInput & {
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
  countsAsChampionDefeat: boolean;
};

type MilestoneInputs = {
  entries: ChronologicalEventInput[];
  awards: MilestoneAwardInput[];
  pointAwards: ChampionPointAwardInput[];
  grandChampionCredits: GrandChampionCreditInput[];
  invitationalQualifications: ChronologicalEventInput[];
  invitationalPlacements: MilestoneAwardInput[];
};

function earliest<T extends ChronologicalEventInput>(events: T[]): T | null {
  return [...events].sort(
    (a, b) => a.scheduledEpoch - b.scheduledEpoch || a.year - b.year || a.week - b.week
  )[0] ?? null;
}

function toMilestone(
  type: RibbonRoomMilestoneType,
  event: ChronologicalEventInput | null
): RibbonRoomMilestoneDto | null {
  return event ? { type, year: event.year, week: event.week } : null;
}

export function findChampionMilestone(
  pointAwards: ChampionPointAwardInput[]
): RibbonRoomMilestoneDto | null {
  const bestAwardsByShowDay = new Map<string, ChampionPointAwardInput>();

  for (const award of pointAwards) {
    const previous = bestAwardsByShowDay.get(award.showDayId);

    if (!previous || award.pointsAwarded > previous.pointsAwarded) {
      bestAwardsByShowDay.set(award.showDayId, award);
    }
  }

  let points = 0;
  let majors = 0;

  for (const award of [...bestAwardsByShowDay.values()].sort(
    (a, b) => a.scheduledEpoch - b.scheduledEpoch
  )) {
    points += award.pointsAwarded;

    if (award.isMajor || award.pointsAwarded >= 3) {
      majors += 1;
    }

    if (
      points >= CHAMPIONSHIP_POINTS_REQUIRED &&
      majors >= CHAMPIONSHIP_MAJORS_REQUIRED
    ) {
      return { type: "CHAMPION", year: award.year, week: award.week };
    }
  }

  return null;
}

export function findGrandChampionMilestone(
  credits: GrandChampionCreditInput[]
): RibbonRoomMilestoneDto | null {
  let points = 0;
  let majors = 0;
  const defeatShowDayIds = new Set<string>();

  for (const credit of [...credits].sort(
    (a, b) => a.scheduledEpoch - b.scheduledEpoch
  )) {
    points += credit.pointsAwarded;

    if (credit.isMajor) {
      majors += 1;
    }

    if (credit.countsAsChampionDefeat) {
      defeatShowDayIds.add(credit.showDayId);
    }

    if (
      points >= GRAND_CHAMPION_POINTS_REQUIRED &&
      majors >= GRAND_CHAMPION_MAJORS_REQUIRED &&
      defeatShowDayIds.size >= GRAND_CHAMPION_DEFEAT_SHOWS_REQUIRED
    ) {
      return { type: "GRAND_CHAMPION", year: credit.year, week: credit.week };
    }
  }

  return null;
}

export function buildRibbonRoomMilestones(
  inputs: MilestoneInputs
): RibbonRoomMilestoneDto[] {
  const milestones = [
    toMilestone("FIRST_ENTRY", earliest(inputs.entries)),
    toMilestone("FIRST_RIBBON", earliest(inputs.awards)),
    toMilestone(
      "FIRST_BOB",
      earliest(inputs.awards.filter((award) => award.awardCode === "BOB"))
    ),
    toMilestone(
      "FIRST_BOS",
      earliest(inputs.awards.filter((award) => award.awardCode === "BOS"))
    ),
    toMilestone(
      "FIRST_SELECT",
      earliest(
        inputs.awards.filter(
          (award) =>
            award.awardCode === "SELECT_DOG" ||
            award.awardCode === "SELECT_BITCH"
        )
      )
    ),
    toMilestone(
      "FIRST_GROUP",
      earliest(
        inputs.awards.filter((award) =>
          ["G1", "G2", "G3", "G4"].includes(award.awardCode)
        )
      )
    ),
    toMilestone(
      "FIRST_G1",
      earliest(inputs.awards.filter((award) => award.awardCode === "G1"))
    ),
    toMilestone(
      "FIRST_RBIS",
      earliest(inputs.awards.filter((award) => award.awardCode === "RBIS"))
    ),
    toMilestone(
      "FIRST_BIS",
      earliest(inputs.awards.filter((award) => award.awardCode === "BIS"))
    ),
    findChampionMilestone(inputs.pointAwards),
    findGrandChampionMilestone(inputs.grandChampionCredits),
    toMilestone(
      "FIRST_INVITATIONAL_QUALIFICATION",
      earliest(inputs.invitationalQualifications)
    ),
    toMilestone(
      "FIRST_INVITATIONAL_PLACEMENT",
      earliest(inputs.invitationalPlacements)
    ),
  ].filter((milestone): milestone is RibbonRoomMilestoneDto =>
    Boolean(milestone)
  );

  return milestones.sort((a, b) => a.year - b.year || a.week - b.week);
}

type CurrentYearRankRow = {
  dogId: string;
  breedCode2: string;
  breedDogsBeaten: number;
  allBreedDogsBeaten: number;
  breedWinCount: number;
  groupWinCount: number;
  bestInShowWinCount: number;
};

type LifetimeRankRow = CurrentYearRankRow & {
  reserveBisCount: number;
};

export type GroupPlacementAggregationInput = {
  id: string;
  dogId: string;
  year: number;
  placement: number | null;
  dogsInCompetition: number | null;
};

export type GroupRankRow = {
  dogId: string;
  groupDogsBeaten: number;
  allBreedDogsBeaten: number;
  groupWinCount: number;
  bestInShowWinCount: number;
};

export function getGroupDogsBeatenForPlacement(args: {
  placement: number | null;
  dogsInCompetition: number | null;
}): number | null {
  if (args.placement == null || args.dogsInCompetition == null) {
    return null;
  }

  return Math.max(0, args.dogsInCompetition - args.placement);
}

export function aggregateGroupDogsBeaten(
  placements: GroupPlacementAggregationInput[]
): { lifetimeByDogId: Map<string, number>; byYearAndDogId: Map<string, number> } {
  const seenAwardIds = new Set<string>();
  const lifetimeByDogId = new Map<string, number>();
  const byYearAndDogId = new Map<string, number>();

  for (const placement of placements) {
    if (seenAwardIds.has(placement.id)) {
      continue;
    }

    seenAwardIds.add(placement.id);

    const dogsBeaten = getGroupDogsBeatenForPlacement({
      placement: placement.placement,
      dogsInCompetition: placement.dogsInCompetition,
    });

    if (dogsBeaten == null) {
      continue;
    }

    lifetimeByDogId.set(
      placement.dogId,
      (lifetimeByDogId.get(placement.dogId) ?? 0) + dogsBeaten
    );

    const yearKey = `${placement.year}:${placement.dogId}`;
    byYearAndDogId.set(yearKey, (byYearAndDogId.get(yearKey) ?? 0) + dogsBeaten);
  }

  return { lifetimeByDogId, byYearAndDogId };
}

export function rankGroupDogsBeaten(
  rows: GroupRankRow[],
  dogId: string
): number | null {
  return (
    rows
      .filter((row) => row.groupDogsBeaten > 0)
      .sort(
        (a, b) =>
          b.groupDogsBeaten - a.groupDogsBeaten ||
          b.bestInShowWinCount - a.bestInShowWinCount ||
          b.groupWinCount - a.groupWinCount ||
          b.allBreedDogsBeaten - a.allBreedDogsBeaten
      )
      .findIndex((row) => row.dogId === dogId) + 1 || null
  );
}

function rankCurrentYearAllBreed(
  rows: CurrentYearRankRow[],
  dogId: string
): number | null {
  return (
    rows
      .filter((row) => row.allBreedDogsBeaten > 0)
      .sort(
        (a, b) =>
          b.allBreedDogsBeaten - a.allBreedDogsBeaten ||
          b.bestInShowWinCount - a.bestInShowWinCount ||
          b.groupWinCount - a.groupWinCount ||
          b.breedDogsBeaten - a.breedDogsBeaten
      )
      .findIndex((row) => row.dogId === dogId) + 1 || null
  );
}

function rankCurrentYearBreed(
  rows: CurrentYearRankRow[],
  dogId: string,
  breedCode2: string
): number | null {
  return (
    rows
      .filter((row) => row.breedCode2 === breedCode2 && row.breedDogsBeaten > 0)
      .sort(
        (a, b) =>
          b.breedDogsBeaten - a.breedDogsBeaten ||
          b.breedWinCount - a.breedWinCount ||
          b.allBreedDogsBeaten - a.allBreedDogsBeaten
      )
      .findIndex((row) => row.dogId === dogId) + 1 || null
  );
}

function rankLifetimeAllBreed(
  rows: LifetimeRankRow[],
  dogId: string
): number | null {
  return (
    rows
      .filter((row) => row.allBreedDogsBeaten > 0)
      .sort(
        (a, b) =>
          b.allBreedDogsBeaten - a.allBreedDogsBeaten ||
          b.bestInShowWinCount - a.bestInShowWinCount ||
          b.groupWinCount - a.groupWinCount ||
          b.breedDogsBeaten - a.breedDogsBeaten
      )
      .findIndex((row) => row.dogId === dogId) + 1 || null
  );
}

function rankLifetimeBreed(
  rows: LifetimeRankRow[],
  dogId: string,
  breedCode2: string
): number | null {
  return (
    rows
      .filter((row) => row.breedCode2 === breedCode2 && row.breedDogsBeaten > 0)
      .sort(
        (a, b) =>
          b.breedDogsBeaten - a.breedDogsBeaten ||
          b.breedWinCount - a.breedWinCount ||
          b.allBreedDogsBeaten - a.allBreedDogsBeaten
      )
      .findIndex((row) => row.dogId === dogId) + 1 || null
  );
}

function metadataYear(metadataJson: Prisma.JsonValue): number | null {
  if (
    metadataJson &&
    typeof metadataJson === "object" &&
    !Array.isArray(metadataJson) &&
    typeof metadataJson.gameYear === "number"
  ) {
    return metadataJson.gameYear;
  }

  return null;
}

export async function getDogRibbonRoom(
  dogId: string
): Promise<DogRibbonRoomDto | null> {
  const dog = await db.dog.findFirst({
    where: { id: dogId, isPlayerVisible: true },
    select: {
      id: true,
      regNumber: true,
      registeredName: true,
      callName: true,
      breedCode2: true,
      sex: true,
      breed: {
        select: {
          code2: true,
          name: true,
          groupName: true,
        },
      },
      titleProgress: {
        select: {
          championshipPoints: true,
          majorCount: true,
          grandPoints: true,
          grandMajorCount: true,
          grandChampionDefeatShowCount: true,
          currentTitleCode: true,
        },
      },
    },
  });

  if (!dog) {
    return null;
  }

  const currentYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;

  const [
    awards,
    pointAwards,
    grandChampionCredits,
    prestigeCredits,
    groupPlacementAwardsInBreedGroup,
    currentYearStats,
    currentYearRankRows,
    lifetimeTotals,
    lifetimeRankRows,
    entries,
    milestoneAwards,
    invitationalEntries,
    invitationalAwards,
    invitationalNotices,
  ] = await Promise.all([
    db.showAward.findMany({
      where: {
        dogId,
        awardCode: { in: [...DISPLAY_AWARD_CODES] },
      },
      orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
      select: {
        id: true,
        awardCode: true,
        awardGroup: true,
        pointsAwarded: true,
        dogsInCompetition: true,
        showDayId: true,
        grandChampionCredit: {
          select: {
            pointsAwarded: true,
          },
        },
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: {
              select: {
                id: true,
                name: true,
                year: true,
              },
            },
          },
        },
        judge: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.showAward.findMany({
      where: {
        dogId,
        pointsAwarded: { gt: 0 },
      },
      orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
      select: {
        showDayId: true,
        pointsAwarded: true,
        isMajor: true,
        judgeId: true,
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: {
              select: { year: true },
            },
          },
        },
      },
    }),
    db.dogGrandChampionCredit.findMany({
      where: { dogId },
      orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
      select: {
        showDayId: true,
        pointsAwarded: true,
        isMajor: true,
        countsAsChampionDefeat: true,
        showAward: {
          select: { judgeId: true },
        },
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: {
              select: { year: true },
            },
          },
        },
      },
    }),
    db.dogShowPrestigeCredit.findMany({
      where: { dogId },
      select: {
        showDayId: true,
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
      },
    }),
    dog.breed.groupName
      ? db.showAward.findMany({
          where: {
            awardCode: { in: ["G1", "G2", "G3", "G4"] },
            breed: {
              groupName: dog.breed.groupName,
            },
          },
          select: {
            id: true,
            dogId: true,
            rank: true,
            dogsInCompetition: true,
            showDay: {
              select: {
                cluster: {
                  select: { year: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    db.dogYearlyPrestigeStat.findUnique({
      where: {
        dogId_gameYear: {
          dogId,
          gameYear: currentYear,
        },
      },
      select: {
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
      },
    }),
    db.dogYearlyPrestigeStat.findMany({
      where: { gameYear: currentYear },
      select: {
        dogId: true,
        breedCode2: true,
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
        breedWinCount: true,
        groupWinCount: true,
        bestInShowWinCount: true,
      },
    }),
    db.dogYearlyPrestigeStat.groupBy({
      by: ["dogId", "breedCode2"],
      where: { dogId },
      _sum: {
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
        breedWinCount: true,
        groupWinCount: true,
        bestInShowWinCount: true,
        reserveBisCount: true,
      },
    }),
    db.dogYearlyPrestigeStat.groupBy({
      by: ["dogId", "breedCode2"],
      _sum: {
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
        breedWinCount: true,
        groupWinCount: true,
        bestInShowWinCount: true,
        reserveBisCount: true,
      },
    }),
    db.showEntry.findMany({
      where: { dogId },
      orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
      select: {
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: { select: { year: true } },
          },
        },
      },
    }),
    db.showAward.findMany({
      where: { dogId },
      orderBy: [{ showDay: { scheduledEpoch: "asc" } }],
      select: {
        awardCode: true,
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: { select: { year: true } },
          },
        },
      },
    }),
    db.showEntry.findMany({
      where: {
        dogId,
        showDay: {
          cluster: {
            id: { startsWith: "invitational-year-" },
          },
        },
      },
      select: {
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: { select: { year: true } },
          },
        },
      },
    }),
    db.showAward.findMany({
      where: {
        dogId,
        awardCode: { in: [...DISPLAY_AWARD_CODES] },
        showDay: {
          cluster: {
            id: { startsWith: "invitational-year-" },
          },
        },
      },
      select: {
        awardCode: true,
        showDay: {
          select: {
            scheduledEpoch: true,
            cluster: { select: { year: true } },
          },
        },
      },
    }),
    db.kennelNotice.findMany({
      where: {
        linkedDogId: dogId,
        type: "INVITATIONAL_INVITE",
      },
      select: {
        createdAtEpoch: true,
        metadataJson: true,
      },
    }),
  ]);

  const prestigeCreditByShowDayId = new Map(
    prestigeCredits.map((credit) => [credit.showDayId, credit])
  );
  const ribbonTotals = buildRibbonTotals(
    awards.map((award) => ({
      ...award,
      dogPrestigeCredit: prestigeCreditByShowDayId.get(award.showDayId) ?? null,
    }))
  );
  const championJudgeIds = pointAwards.map((award) => award.judgeId);
  const grandChampionJudgeIds = grandChampionCredits
    .map((credit) => credit.showAward?.judgeId)
    .filter((judgeId): judgeId is string => Boolean(judgeId));
  const lifetimeTotal = lifetimeTotals[0];
  const normalizedLifetimeRankRows = lifetimeRankRows.map((row) => ({
    dogId: row.dogId,
    breedCode2: row.breedCode2,
    breedDogsBeaten: row._sum.breedDogsBeaten ?? 0,
    allBreedDogsBeaten: row._sum.allBreedDogsBeaten ?? 0,
    breedWinCount: row._sum.breedWinCount ?? 0,
    groupWinCount: row._sum.groupWinCount ?? 0,
    bestInShowWinCount: row._sum.bestInShowWinCount ?? 0,
    reserveBisCount: row._sum.reserveBisCount ?? 0,
  }));
  const { lifetimeByDogId: lifetimeGroupDogsBeatenByDogId, byYearAndDogId } =
    aggregateGroupDogsBeaten(
      groupPlacementAwardsInBreedGroup.map((award) => ({
        id: award.id,
        dogId: award.dogId,
        year: award.showDay.cluster.year,
        placement: award.rank,
        dogsInCompetition: award.dogsInCompetition,
      }))
    );
  const dogGroupPlacements = awards
    .filter((award) => ["G1", "G2", "G3", "G4"].includes(award.awardCode))
    .map((award) => ({
      id: award.id,
      dogId,
      year: award.showDay.cluster.year,
      placement:
        award.awardCode === "G1"
          ? 1
          : award.awardCode === "G2"
            ? 2
            : award.awardCode === "G3"
              ? 3
              : 4,
      dogsInCompetition: award.dogsInCompetition ?? null,
    }));
  const {
    lifetimeByDogId: dogLifetimeGroupDogsBeatenMap,
    byYearAndDogId: dogGroupDogsBeatenByYear,
  } = aggregateGroupDogsBeaten(dogGroupPlacements);
  const currentYearPrestigeByDogId = new Map(
    currentYearRankRows.map((row) => [row.dogId, row])
  );
  const lifetimePrestigeByDogId = new Map(
    normalizedLifetimeRankRows.map((row) => [row.dogId, row])
  );
  const currentYearGroupRankRows: GroupRankRow[] = [...byYearAndDogId.entries()]
    .filter(([key, total]) => key.startsWith(`${currentYear}:`) && total > 0)
    .map(([key, groupDogsBeaten]) => {
      const rankedDogId = key.slice(key.indexOf(":") + 1);
      const prestigeRow = currentYearPrestigeByDogId.get(rankedDogId);

      return prestigeRow
        ? {
            dogId: rankedDogId,
            groupDogsBeaten,
            allBreedDogsBeaten: prestigeRow.allBreedDogsBeaten,
            groupWinCount: prestigeRow.groupWinCount,
            bestInShowWinCount: prestigeRow.bestInShowWinCount,
          }
        : null;
    })
    .filter((row): row is GroupRankRow => Boolean(row));
  const lifetimeGroupRankRows: GroupRankRow[] = [
    ...lifetimeGroupDogsBeatenByDogId.entries(),
  ]
    .filter(([, total]) => total > 0)
    .map(([rankedDogId, groupDogsBeaten]) => {
      const prestigeRow = lifetimePrestigeByDogId.get(rankedDogId);

      return prestigeRow
        ? {
            dogId: rankedDogId,
            groupDogsBeaten,
            allBreedDogsBeaten: prestigeRow.allBreedDogsBeaten,
            groupWinCount: prestigeRow.groupWinCount,
            bestInShowWinCount: prestigeRow.bestInShowWinCount,
          }
        : null;
    })
    .filter((row): row is GroupRankRow => Boolean(row));
  const currentYearGroupDogsBeaten =
    dogGroupDogsBeatenByYear.get(`${currentYear}:${dogId}`) ?? 0;
  const lifetimeGroupDogsBeaten = dogLifetimeGroupDogsBeatenMap.get(dogId) ?? 0;
  const invitationalRecords: InvitationalRecordInput[] = [
    ...invitationalEntries.map((entry) => ({
      year: entry.showDay.cluster.year,
      awardCode: null,
    })),
    ...invitationalAwards.map((award) => ({
      year: award.showDay.cluster.year,
      awardCode: award.awardCode,
    })),
    ...invitationalNotices.flatMap((notice) => {
      const year = metadataYear(notice.metadataJson);

      return year ? [{ year, awardCode: null }] : [];
    }),
  ];
  const toEvent = (record: {
    showDay: { scheduledEpoch: number; cluster: { year: number } };
  }): ChronologicalEventInput => ({
    year: record.showDay.cluster.year,
    week: getWeekForEpoch(record.showDay.scheduledEpoch),
    scheduledEpoch: record.showDay.scheduledEpoch,
  });
  const allAwardMilestoneEvents = milestoneAwards.map((award) => ({
    ...toEvent(award),
    awardCode: award.awardCode,
  }));
  const invitationalPlacementEvents = invitationalAwards.map((award) => ({
    ...toEvent(award),
    awardCode: award.awardCode,
  }));
  const invitationalQualificationEvents = [
    ...invitationalEntries.map(toEvent),
    ...invitationalNotices.flatMap((notice) => {
      const year = metadataYear(notice.metadataJson);

      return year
        ? [
            {
              year,
              week: 52,
              scheduledEpoch: notice.createdAtEpoch,
            },
          ]
        : [];
    }),
  ];

  return {
    dog: {
      id: dog.id,
      regNumber: dog.regNumber,
      registeredName: dog.registeredName,
      callName: dog.callName,
      breed: dog.breed,
      sex: dog.sex,
      photo: null,
      dogPageUrl: `/dogs/${dog.id}`,
    },
    champion: summarizeChampionProgress({
      titleProgress: dog.titleProgress,
      judgeIds: championJudgeIds,
    }),
    grandChampion: summarizeGrandChampionProgress({
      titleProgress: dog.titleProgress,
      judgeIds: grandChampionJudgeIds,
    }),
    lifetime: {
      breedDogsBeaten: lifetimeTotal?._sum.breedDogsBeaten ?? 0,
      groupDogsBeaten: lifetimeGroupDogsBeaten,
      allBreedDogsBeaten: lifetimeTotal?._sum.allBreedDogsBeaten ?? 0,
      breedRank: rankLifetimeBreed(
        normalizedLifetimeRankRows,
        dogId,
        dog.breedCode2
      ),
      groupRank: rankGroupDogsBeaten(lifetimeGroupRankRows, dogId),
      allBreedRank: rankLifetimeAllBreed(normalizedLifetimeRankRows, dogId),
    },
    currentYear: {
      breedDogsBeaten: currentYearStats?.breedDogsBeaten ?? 0,
      groupDogsBeaten: currentYearGroupDogsBeaten,
      allBreedDogsBeaten: currentYearStats?.allBreedDogsBeaten ?? 0,
      breedRank: rankCurrentYearBreed(
        currentYearRankRows,
        dogId,
        dog.breedCode2
      ),
      groupRank: rankGroupDogsBeaten(currentYearGroupRankRows, dogId),
      allBreedRank: rankCurrentYearAllBreed(currentYearRankRows, dogId),
    },
    ribbons: ribbonTotals,
    invitational: buildInvitationalHistory(invitationalRecords),
    milestones: buildRibbonRoomMilestones({
      entries: entries.map(toEvent),
      awards: allAwardMilestoneEvents,
      pointAwards: pointAwards.map((award) => ({
        showDayId: award.showDayId,
        pointsAwarded: award.pointsAwarded,
        isMajor: award.isMajor,
        year: award.showDay.cluster.year,
        week: getWeekForEpoch(award.showDay.scheduledEpoch),
        scheduledEpoch: award.showDay.scheduledEpoch,
      })),
      grandChampionCredits: grandChampionCredits.map((credit) => ({
        showDayId: credit.showDayId,
        pointsAwarded: credit.pointsAwarded,
        isMajor: credit.isMajor,
        countsAsChampionDefeat: credit.countsAsChampionDefeat,
        year: credit.showDay.cluster.year,
        week: getWeekForEpoch(credit.showDay.scheduledEpoch),
        scheduledEpoch: credit.showDay.scheduledEpoch,
      })),
      invitationalQualifications: invitationalQualificationEvents,
      invitationalPlacements: invitationalPlacementEvents,
    }),
  };
}
