import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";
import type {
  BreedingAttemptStatus,
  DogLifecycleState,
  Prisma,
} from "@prisma/client";
import {
  canEnterShows,
  CURRENT_BREED_RELEASE,
  generateAnnualShowClusterTemplates,
  SHOW_DAY_SAT,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
} from "@showring/rules";

const INVITATIONAL_WEEK_IN_YEAR = 52;
const INVITATIONAL_TOP_DOGS_PER_BREED = 10;
const INVITATIONAL_HOST_DISTRICT = 1;
const INVITATIONAL_DAY_INDEX = 1;
const INVITATIONAL_TRANSACTION_TIMEOUT_MS = 30_000;

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other";
}

function groupSortKey(groupName: string): string {
  const match = groupName.match(/\d+/);

  return match ? match[0].padStart(3, "0") : groupName;
}

function getRingName(groupName: string): string {
  return groupName.toLowerCase().includes("ring")
    ? groupName
    : `${groupName} Ring`;
}

function getConditioningSnapshot(dog: {
  ringObedience: number;
  muscleTone: number;
  coatCondition: number;
}): number {
  return Math.round((dog.ringObedience + dog.muscleTone + dog.coatCondition) / 3);
}

function canInviteDogToInvitational(
  dog: {
    birthEpoch: number;
    lifecycleState: DogLifecycleState;
    breedingAttemptsAsDam: Array<{
      status: BreedingAttemptStatus;
      whelpedEpoch: number | null;
    }>;
  },
  invitationalStartEpoch: number
): boolean {
  const latestWhelp = dog.breedingAttemptsAsDam.find(
    (attempt) => attempt.status === "WHELPED" && attempt.whelpedEpoch !== null
  );

  return canEnterShows(
    invitationalStartEpoch,
    dog.birthEpoch,
    dog.lifecycleState,
    {
      isPregnant: dog.breedingAttemptsAsDam.some(
        (attempt) => attempt.status === "PREGNANT"
      ),
      lastWhelpedEpoch: latestWhelp?.whelpedEpoch ?? null,
    }
  );
}

export function getInvitationalClusterId(year: number): string {
  return `invitational-year-${year}`;
}

function getInvitationalStartEpoch(year: number): number {
  const yearStartEpoch = (year - 1) * SHOW_YEAR_HOURS;

  return yearStartEpoch + (INVITATIONAL_WEEK_IN_YEAR - 1) * SHOW_WEEK_HOURS + SHOW_DAY_SAT;
}

function getInvitationalWeekStartEpoch(year: number): number {
  const yearStartEpoch = (year - 1) * SHOW_YEAR_HOURS;

  return yearStartEpoch + (INVITATIONAL_WEEK_IN_YEAR - 1) * SHOW_WEEK_HOURS;
}

function getInvitationalYearForEpoch(currentEpoch: number): number {
  const calendarYear = Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1;
  const previousYear = calendarYear - 1;

  // Keep a short rollover window so a delayed publisher run can still create
  // the just-finished year's invitational after the calendar year advances.
  if (
    previousYear > 0 &&
    currentEpoch <= getInvitationalStartEpoch(previousYear) + SHOW_WEEK_HOURS
  ) {
    return previousYear;
  }

  return calendarYear;
}

function getWeek51ClusterIds(year: number): string[] {
  return generateAnnualShowClusterTemplates()
    .filter((template) => template.weekInYear === INVITATIONAL_WEEK_IN_YEAR - 1)
    .map((template) => `generated-year-${year}-${template.templateId}`);
}

export type EnsureAnnualInvitationalResult = {
  year: number;
  clusterId: string;
  ready: boolean;
  created: boolean;
  invitationCount: number;
};

export async function ensureAnnualInvitationalShow(args: {
  currentEpoch: number;
}): Promise<EnsureAnnualInvitationalResult> {
  const year = getInvitationalYearForEpoch(args.currentEpoch);
  const clusterId = getInvitationalClusterId(year);
  const existingCluster = await db.showCluster.findUnique({
    where: { id: clusterId },
    select: {
      showDays: {
        select: {
          _count: {
            select: { showEntries: true },
          },
        },
      },
    },
  });

  if (existingCluster) {
    return {
      year,
      clusterId,
      ready: true,
      created: false,
      invitationCount: existingCluster.showDays.reduce(
        (total, showDay) => total + showDay._count.showEntries,
        0
      ),
    };
  }

  const week51ClusterIds = getWeek51ClusterIds(year);
  const pendingWeek51ShowDayCount = await db.showDay.count({
    where: {
      clusterId: { in: week51ClusterIds },
      showEntries: { some: {} },
      status: { notIn: ["RESULTS_PUBLISHED", "CANCELLED"] },
    },
  });

  if (
    args.currentEpoch < getInvitationalWeekStartEpoch(year) ||
    pendingWeek51ShowDayCount > 0
  ) {
    return {
      year,
      clusterId,
      ready: false,
      created: false,
      invitationCount: 0,
    };
  }

  await seedJudgePanelFromCsv();

  const [breeds, judges, prestigeStats] = await Promise.all([
    db.breed.findMany({
      where: {
        isActive: true,
        releaseVersion: { lte: CURRENT_BREED_RELEASE },
      },
      orderBy: [{ groupName: "asc" }, { name: "asc" }],
      select: { code2: true, groupName: true },
    }),
    db.judge.findMany({
      where: { isActive: true },
      orderBy: [{ judgeCode: "asc" }, { name: "asc" }],
      select: { id: true },
    }),
    db.dogYearlyPrestigeStat.findMany({
      where: {
        gameYear: year,
        breedDogsBeaten: { gt: 0 },
      },
      orderBy: [
        { breedCode2: "asc" },
        { breedDogsBeaten: "desc" },
        { breedWinCount: "desc" },
        { allBreedDogsBeaten: "desc" },
      ],
      include: {
        dog: {
          include: {
            ownerKennel: {
              select: { id: true, name: true, slug: true },
            },
            breedingAttemptsAsDam: {
              where: {
                OR: [
                  { status: "PREGNANT" },
                  { status: "WHELPED", whelpedEpoch: { not: null } },
                ],
              },
              orderBy: { whelpedEpoch: "desc" },
              select: { status: true, whelpedEpoch: true },
            },
          },
        },
      },
    }),
  ]);

  if (breeds.length === 0) {
    throw new Error("No released active breeds are available for the invitational.");
  }

  if (judges.length === 0) {
    throw new Error("No active judges are available for the invitational.");
  }

  const releasedBreedCodes = new Set(breeds.map((breed) => breed.code2));
  const topTenByBreed = new Map<string, typeof prestigeStats>();

  for (const stat of prestigeStats) {
    if (!releasedBreedCodes.has(stat.breedCode2)) {
      continue;
    }

    const breedTopTen = topTenByBreed.get(stat.breedCode2) ?? [];

    if (breedTopTen.length >= INVITATIONAL_TOP_DOGS_PER_BREED) {
      continue;
    }

    breedTopTen.push(stat);
    topTenByBreed.set(stat.breedCode2, breedTopTen);
  }

  const groupNames = [
    ...new Set(breeds.map((breed) => normalizeGroupName(breed.groupName))),
  ].sort(
    (a, b) => groupSortKey(a).localeCompare(groupSortKey(b)) || a.localeCompare(b)
  );
  const ringNumberByGroup = new Map(
    groupNames.map((groupName, index) => [groupName, index + 1])
  );
  const blockOrderByRing = new Map<number, number>();
  const invitationalStartEpoch = getInvitationalStartEpoch(year);
  let invitationCount = 0;

  await db.$transaction(async (tx) => {
    await tx.showCluster.create({
      data: {
        id: clusterId,
        name: `Year ${year} Invitational Show`,
        year,
        district: INVITATIONAL_HOST_DISTRICT,
        startEpoch: invitationalStartEpoch,
        endEpoch: invitationalStartEpoch,
        entryOpenEpoch: invitationalStartEpoch - 1,
        entryCloseEpoch: invitationalStartEpoch - 1,
        status: "CLOSED",
      },
    });

    const showDay = await tx.showDay.create({
      data: {
        clusterId,
        scheduledEpoch: invitationalStartEpoch,
        dayIndex: INVITATIONAL_DAY_INDEX,
        judgeId: judges[year % judges.length].id,
        status: "ENTRY_LOCKED",
      },
      select: { id: true },
    });
    const judgingBlockIdByBreed = new Map<string, string>();
    const invitationEntries: Prisma.ShowEntryCreateManyInput[] = [];
    const invitationNotices: Prisma.KennelNoticeCreateManyInput[] = [];

    for (const breed of breeds) {
      const groupName = normalizeGroupName(breed.groupName);
      const ringNumber = ringNumberByGroup.get(groupName) ?? groupNames.length + 1;
      const blockOrder = (blockOrderByRing.get(ringNumber) ?? 0) + 1;
      blockOrderByRing.set(ringNumber, blockOrder);
      const judge = judges[(year + ringNumber + blockOrder) % judges.length];
      const judgingBlock = await tx.showJudgingBlock.create({
        data: {
          showDayId: showDay.id,
          judgeId: judge.id,
          breedCode2: breed.code2,
          ringNumber,
          ringName: getRingName(groupName),
          startEpoch: invitationalStartEpoch,
          classType: "INVITATIONAL",
          blockOrder,
          entryCountHint: topTenByBreed.get(breed.code2)?.length ?? 0,
          status: "ENTRY_LOCKED",
        },
        select: { id: true },
      });

      judgingBlockIdByBreed.set(breed.code2, judgingBlock.id);
    }

    for (const [breedCode2, rankedDogs] of topTenByBreed) {
      const judgingBlockId = judgingBlockIdByBreed.get(breedCode2);

      if (!judgingBlockId) {
        continue;
      }

      for (const [rankIndex, stat] of rankedDogs.entries()) {
        const ownerKennel = stat.dog.ownerKennel;

        // Rank first and eligibility second: an ineligible Top Ten dog is
        // never replaced by a lower-ranked dog.
        if (
          !ownerKennel ||
          !canInviteDogToInvitational(stat.dog, invitationalStartEpoch)
        ) {
          continue;
        }

        invitationEntries.push({
          showDayId: showDay.id,
          judgingBlockId,
          dogId: stat.dog.id,
          kennelId: ownerKennel.id,
          enteredKennelId: ownerKennel.id,
          enteredKennelName: ownerKennel.name,
          enteredKennelSlug: ownerKennel.slug,
          breedCode2,
          entryStatus: "ENTERED",
          enteredAtEpoch: args.currentEpoch,
          feeCharged: 0,
          handlerUsed: false,
          conditioningSnapshot: getConditioningSnapshot(stat.dog),
          fatigueSnapshot: stat.dog.fatiguePoints,
        });

        invitationNotices.push({
          kennelId: ownerKennel.id,
          type: "INVITATIONAL_INVITE",
          title: "Invitational show invitation",
          body: `Your dog ${formatDogDisplayName(stat.dog)} has been invited to Year ${year}'s invitational show. Congratulations.`,
          createdAtEpoch: args.currentEpoch,
          linkedDogId: stat.dog.id,
          linkedShowId: clusterId,
          metadataJson: {
            gameYear: year,
            breedCode2,
            rank: rankIndex + 1,
          },
        });
      }
    }

    if (invitationEntries.length > 0) {
      await tx.showEntry.createMany({ data: invitationEntries });
      await tx.kennelNotice.createMany({ data: invitationNotices });
    }

    invitationCount = invitationEntries.length;
  }, {
    timeout: INVITATIONAL_TRANSACTION_TIMEOUT_MS,
  });

  return {
    year,
    clusterId,
    ready: true,
    created: true,
    invitationCount,
  };
}
