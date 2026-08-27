import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getShowDistrictRegionName, getCanonicalShowGroupLabel, resolveBreedGroupNameToCanonicalShowGroupCode, CANONICAL_SHOW_GROUP_CODES, type CanonicalShowGroupCode } from "@showring/rules";

import type {
  MyResultsDogResult,
  MyResultsGroupCode,
  MyResultsHierarchy,
  MyResultsJudge,
  MyResultsJudgeAttribution,
} from "./myResults.contract";

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export type MyResultsQueryEntry = {
  id: string;
  entryStatus: "ENTERED" | "WITHDRAWN" | "INELIGIBLE" | "ABSENT" | "JUDGED";
  absenceReason: MyResultsDogResult["absenceReason"];
  dog: {
    id: string;
    callName: string | null;
    registeredName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
  };
  breed: { code2: string; name: string; groupName: string | null };
  judgingBlock: { judge: MyResultsJudge } | null;
  showDay: {
    id: string;
    dayIndex: number | null;
    scheduledEpoch: number;
    judge: MyResultsJudge | null;
    cluster: { id: string; name: string; district: number | null };
    groupJudgeAssignments: Array<{ groupCode: CanonicalShowGroupCode; judge: MyResultsJudge }>;
  };
  showResult: {
    pointsAwarded: number;
    isMajor: boolean;
    judge: MyResultsJudge;
    showAwards: Array<{
      awardCode: string;
      grandChampionCredit: { pointsAwarded: number; isMajor: boolean } | null;
    }>;
  } | null;
};

function nonEmpty<T>(items: T[]): NonEmptyReadonlyArray<T> {
  if (items.length === 0) throw new Error("My Results hierarchy cannot emit an empty branch.");
  return items as unknown as NonEmptyReadonlyArray<T>;
}

function firstValue<T>(values: Iterable<T>): T {
  const next = values[Symbol.iterator]().next();
  if (next.done) throw new Error("My Results hierarchy cannot read an empty branch.");
  return next.value;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function resolveGroup(entry: MyResultsQueryEntry): { code: MyResultsGroupCode; name: string } {
  try {
    const code = resolveBreedGroupNameToCanonicalShowGroupCode(entry.breed.groupName);
    return { code, name: getCanonicalShowGroupLabel(code) };
  } catch {
    return {
      code: "UNMAPPED",
      name: `Unmapped group (${entry.breed.groupName?.trim() || "unknown"})`,
    };
  }
}

function judgeAttribution(entry: MyResultsQueryEntry, groupCode: MyResultsGroupCode): MyResultsJudgeAttribution | null {
  if (entry.showResult?.judge) return { judge: entry.showResult.judge, source: "SHOW_RESULT" };
  if (entry.judgingBlock?.judge) return { judge: entry.judgingBlock.judge, source: "SHOW_JUDGING_BLOCK" };
  const scheduledJudge = groupCode === "UNMAPPED"
    ? null
    : entry.showDay.groupJudgeAssignments.find((assignment) => assignment.groupCode === groupCode)?.judge;
  return scheduledJudge ? { judge: scheduledJudge, source: "SCHEDULED_GROUP_ASSIGNMENT" } : null;
}

function judgePriority(attribution: MyResultsJudgeAttribution | null): number {
  if (!attribution) return 3;
  if (attribution.source === "SHOW_RESULT") return 0;
  if (attribution.source === "SHOW_JUDGING_BLOCK") return 1;
  return 2;
}

function groupOrder(code: MyResultsGroupCode): number {
  if (code === "UNMAPPED") return CANONICAL_SHOW_GROUP_CODES.length;
  return CANONICAL_SHOW_GROUP_CODES.indexOf(code);
}

/** Pure server-side transformation for the persisted kennel-scoped entry rows. */
export function buildMyResultsHierarchy(entries: readonly MyResultsQueryEntry[]): MyResultsHierarchy {
  const clusters = new Map<string, Map<string, Map<MyResultsGroupCode, Map<string, MyResultsQueryEntry[]>>>>();

  for (const entry of entries) {
    const group = resolveGroup(entry);
    const days = clusters.get(entry.showDay.cluster.id) ?? new Map();
    const groups = days.get(entry.showDay.id) ?? new Map();
    const breeds = groups.get(group.code) ?? new Map();
    const breedEntries = breeds.get(entry.breed.code2) ?? [];
    breedEntries.push(entry);
    breeds.set(entry.breed.code2, breedEntries);
    groups.set(group.code, breeds);
    days.set(entry.showDay.id, groups);
    clusters.set(entry.showDay.cluster.id, days);
  }

  return [...clusters.values()]
    .map((days) => {
      const representativeGroups = firstValue(days.values());
      const representativeBreeds = firstValue(representativeGroups.values());
      const representativeEntries = firstValue(representativeBreeds.values());
      const representative = firstValue(representativeEntries);
      const showDays = [...days.entries()]
        .map(([showDayId, groups]) => {
          const dayEntry = firstValue(firstValue(firstValue(groups.values()).values()));
          const transformedGroups = [...groups.entries()]
            .map(([groupCode, breeds]) => {
              const groupEntries = [...breeds.values()].flat();
              const group = resolveGroup(groupEntries[0]);
              const judge = groupEntries
                .map((entry) => judgeAttribution(entry, groupCode))
                .sort((left, right) =>
                  judgePriority(left) - judgePriority(right) ||
                  compareText(left?.judge.name ?? "", right?.judge.name ?? "") ||
                  compareText(left?.judge.judgeCode ?? "", right?.judge.judgeCode ?? "")
                )[0] ?? null;
              const transformedBreeds = [...breeds.values()]
                .map((breedEntries) => {
                  const breed = breedEntries[0].breed;
                  const dogResults = breedEntries
                    .map((entry): MyResultsDogResult => ({
                      showEntryId: entry.id,
                      dogId: entry.dog.id,
                      dogDisplayName: formatDogDisplayName(entry.dog),
                      registrationNumber: entry.dog.regNumber,
                      entryStatus: entry.entryStatus,
                      absenceReason: entry.absenceReason,
                      result: entry.showResult
                        ? {
                            awardCodes: entry.showResult.showAwards.map((award) => award.awardCode),
                            championshipPointsAwarded: entry.showResult.pointsAwarded,
                            isChampionshipMajor: entry.showResult.isMajor,
                            grandChampionCredits: entry.showResult.showAwards.flatMap((award) =>
                              award.grandChampionCredit ? [award.grandChampionCredit] : []
                            ),
                          }
                        : null,
                      breedJudge: judgeAttribution(entry, groupCode),
                    }))
                    .sort((left, right) =>
                      compareText(left.dogDisplayName, right.dogDisplayName) ||
                      compareText(left.registrationNumber, right.registrationNumber) ||
                      compareText(left.showEntryId, right.showEntryId)
                    );
                  return { code2: breed.code2, name: breed.name, dogResults: nonEmpty(dogResults) };
                })
                .sort((left, right) => compareText(left.name, right.name));
              return { code: group.code, name: group.name, judge, breeds: nonEmpty(transformedBreeds) };
            })
            .sort((left, right) => groupOrder(left.code) - groupOrder(right.code) || compareText(left.name, right.name));
          return {
            id: showDayId,
            dayIndex: dayEntry.showDay.dayIndex,
            scheduledEpoch: dayEntry.showDay.scheduledEpoch,
            bisJudge: dayEntry.showDay.judge,
            groups: nonEmpty(transformedGroups),
          };
        })
        .sort((left, right) => left.scheduledEpoch - right.scheduledEpoch);
      const mostRecentShowDayEpoch = Math.max(...showDays.map((day) => day.scheduledEpoch));
      return {
        id: representative.showDay.cluster.id,
        name: representative.showDay.cluster.name,
        district: representative.showDay.cluster.district,
        districtRegionName: representative.showDay.cluster.district == null
          ? "District unavailable"
          : getShowDistrictRegionName(representative.showDay.cluster.district),
        mostRecentShowDayEpoch,
        showDays: nonEmpty(showDays),
      };
    })
    .sort((left, right) => right.mostRecentShowDayEpoch - left.mostRecentShowDayEpoch);
}

export async function loadMyResultsHierarchy(args: { kennelId: string; currentEpoch: number }): Promise<MyResultsHierarchy> {
  const entries = await db.showEntry.findMany({
    where: {
      kennelId: args.kennelId,
      OR: [
        { showResult: { isNot: null } },
        { entryStatus: "ABSENT", showDay: { scheduledEpoch: { lte: args.currentEpoch } } },
      ],
    },
    select: {
      id: true,
      entryStatus: true,
      absenceReason: true,
      dog: { select: { id: true, callName: true, registeredName: true, regNumber: true, visibleTitlePrefix: true, visibleTitleSuffix: true } },
      breed: { select: { code2: true, name: true, groupName: true } },
      judgingBlock: { select: { judge: { select: { name: true, judgeCode: true } } } },
      showDay: {
        select: {
          id: true,
          dayIndex: true,
          scheduledEpoch: true,
          judge: { select: { name: true, judgeCode: true } },
          cluster: { select: { id: true, name: true, district: true } },
          groupJudgeAssignments: { select: { groupCode: true, judge: { select: { name: true, judgeCode: true } } } },
        },
      },
      showResult: {
        select: {
          pointsAwarded: true,
          isMajor: true,
          judge: { select: { name: true, judgeCode: true } },
          showAwards: {
            orderBy: [{ awardGroup: "asc" }, { rank: "asc" }],
            select: { awardCode: true, grandChampionCredit: { select: { pointsAwarded: true, isMajor: true } } },
          },
        },
      },
    },
  });

  return buildMyResultsHierarchy(entries);
}
