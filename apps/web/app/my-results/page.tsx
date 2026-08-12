import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { formatShowAwardLabels } from "@/lib/showAwards";
import { formatShowEntryAbsenceReason } from "@/lib/showEntryAbsence";
import {
  buildTitlePointsDisplay,
  formatTitlePointsDisplay,
  type TitlePointsDisplay,
} from "@/lib/titlePoints";
import type { ShowEntryAbsenceReason } from "@prisma/client";
import {
  getShowDistrictRegionName,
  resolveBreedGroupNameToCanonicalShowGroupCode,
} from "@showring/rules";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatJudgeProfileUrl(judgeCode: string | null | undefined): string | null {
  return judgeCode ? `/judges/${judgeCode}` : null;
}

function renderJudgeName(args: {
  judgeName: string | null;
  judgeCode?: string | null;
}) {
  if (!args.judgeName) {
    return <span>Judge unavailable</span>;
  }

  const href = formatJudgeProfileUrl(args.judgeCode);

  if (!href) {
    return <span>{args.judgeName}</span>;
  }

  return (
    <Link
      href={href}
      className="underline-offset-4 hover:underline"
    >
      {args.judgeName}
    </Link>
  );
}

type MyShowResultEntry = {
  entryStatus: string;
  absenceReason: ShowEntryAbsenceReason | null;
  showResult: {
    pointsAwarded: number;
    isMajor: boolean;
    showAwards: Array<{
      awardCode: string;
      pointsAwarded: number;
      isMajor: boolean;
      grandChampionCredit: {
        pointsAwarded: number;
        isMajor: boolean;
      } | null;
    }>;
  } | null;
};

type MyResultsEntryRecord = MyShowResultEntry & {
  id: string;
  dog: {
    id: string;
    callName: string | null;
    registeredName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
  };
  breed: {
    name: string;
    code2: string;
    groupName: string | null;
  };
  showDay: {
    dayIndex: number | null;
    scheduledEpoch: number;
    judge: {
      name: string;
      judgeCode: string;
    } | null;
    groupJudgeAssignments: Array<{
      groupCode: string;
      judgeId: string;
      judge: {
        name: string;
        judgeCode: string;
      };
    }>;
    cluster: {
      id: string;
      name: string;
      district: number | null;
    };
  };
};

type MyResultsBreedSection = {
  breedCode2: string;
  breedName: string;
  scheduledEpoch: number;
  dayIndex: number | null;
  groupJudgeName: string | null;
  groupJudgeCode: string | null;
  bisJudgeName: string | null;
  bisJudgeCode: string | null;
  rows: MyResultsEntryRecord[];
};

function getAbsenceReasonMessage(entry: MyShowResultEntry): string | null {
  if (entry.entryStatus !== "ABSENT") {
    return null;
  }

  return formatShowEntryAbsenceReason(entry.absenceReason);
}

function formatResult(entry: MyShowResultEntry): string {
  if (!entry.showResult) {
    if (entry.entryStatus === "ABSENT") return "Absent";
    if (entry.entryStatus === "INELIGIBLE") return "Ineligible";
    if (entry.entryStatus === "JUDGED") return "DNP";
    return "Pending";
  }

  const awards = entry.showResult.showAwards.length > 0
    ? entry.showResult.showAwards
    : [];

  if (awards.length === 0) {
    return "DNP";
  }

  return formatShowAwardLabels(awards.map((award) => award.awardCode));
}

function getTitlePointsDisplay(entry: MyShowResultEntry): TitlePointsDisplay {
  if (!entry.showResult) {
    return buildTitlePointsDisplay({
      championshipPointsAwarded: 0,
      isChampionshipMajor: false,
      grandChampionCredits: [],
    });
  }

  return buildTitlePointsDisplay({
    championshipPointsAwarded: entry.showResult.pointsAwarded,
    isChampionshipMajor: entry.showResult.isMajor,
    grandChampionCredits: entry.showResult.showAwards.flatMap((award) =>
      award.grandChampionCredit ? [award.grandChampionCredit] : []
    ),
  });
}

export default async function MyShowResultsPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const entries: MyResultsEntryRecord[] = await db.showEntry.findMany({
    where: {
      kennelId: kennel.id,
      OR: [
        {
          showResult: {
            isNot: null,
          },
        },
        {
          entryStatus: "ABSENT",
          showDay: {
            scheduledEpoch: {
              lte: getCurrentEpoch(),
            },
          },
        },
      ],
    },
    orderBy: [
      { showDay: { scheduledEpoch: "desc" } },
      { dog: { registeredName: "asc" } },
      { dog: { regNumber: "asc" } },
    ],
    take: 100,
    select: {
      id: true,
      entryStatus: true,
      absenceReason: true,
      dog: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      },
      breed: { select: { name: true, code2: true, groupName: true } },
      showDay: {
        select: {
          dayIndex: true,
          scheduledEpoch: true,
          judge: {
            select: {
              name: true,
              judgeCode: true,
            },
          },
          groupJudgeAssignments: {
            select: {
              groupCode: true,
              judgeId: true,
              judge: {
                select: {
                  name: true,
                  judgeCode: true,
                },
              },
            },
          },
          cluster: {
            select: {
              id: true,
              name: true,
              district: true,
            },
          },
        },
      },
      showResult: {
        select: {
          pointsAwarded: true,
          isMajor: true,
          showAwards: {
            orderBy: [{ awardGroup: "asc" }, { rank: "asc" }],
            select: {
              awardCode: true,
              pointsAwarded: true,
              isMajor: true,
              grandChampionCredit: {
                select: {
                  pointsAwarded: true,
                  isMajor: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const showGroups = new Map<
    string,
    {
      clusterId: string;
      showName: string;
      district: number | null;
      breedSections: MyResultsBreedSection[];
      breedEntriesByCode: Map<string, MyResultsBreedSection>;
    }
  >();

  for (const entry of entries) {
    const showKey = entry.showDay.cluster.id;
    const existingShowGroup = showGroups.get(showKey);
    const showGroup =
      existingShowGroup ??
      {
        clusterId: entry.showDay.cluster.id,
        showName: entry.showDay.cluster.name,
        district: entry.showDay.cluster.district,
        breedSections: [] as MyResultsBreedSection[],
        breedEntriesByCode: new Map(),
      };

    let groupJudgeName: string | null = null;
    let groupJudgeCode: string | null = null;

    try {
      const groupCode = resolveBreedGroupNameToCanonicalShowGroupCode(
        entry.breed.groupName
      );
      const assignment = entry.showDay.groupJudgeAssignments.find(
        (candidate) => candidate.groupCode === groupCode
      );
      groupJudgeName = assignment?.judge.name ?? null;
      groupJudgeCode = assignment?.judge.judgeCode ?? null;
    } catch {
      groupJudgeName = null;
      groupJudgeCode = null;
    }

    const existingBreedSection = showGroup.breedEntriesByCode.get(
      entry.breed.code2
    );
    const breedSection =
      existingBreedSection ??
      {
        breedCode2: entry.breed.code2,
        breedName: entry.breed.name,
        scheduledEpoch: entry.showDay.scheduledEpoch,
        dayIndex: entry.showDay.dayIndex,
        groupJudgeName,
        groupJudgeCode,
        bisJudgeName: entry.showDay.judge?.name ?? null,
        bisJudgeCode: entry.showDay.judge?.judgeCode ?? null,
        rows: [] as MyResultsEntryRecord[],
      };

    breedSection.rows.push(entry);

    if (!existingBreedSection) {
      showGroup.breedEntriesByCode.set(entry.breed.code2, breedSection);
      showGroup.breedSections.push(breedSection);
    }

    if (!existingShowGroup) {
      showGroups.set(showKey, showGroup);
    }
  }

  const groupedShows = [...showGroups.values()].map((showGroup) => ({
    ...showGroup,
    breedSections: [...showGroup.breedSections].sort((a, b) =>
      a.breedName.localeCompare(b.breedName)
    ),
  }));

  return (
    <main className="results-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              My Show Results
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              The latest 100 judged show results and absences for dogs in{" "}
              {kennel.name}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Show Calendar
            </Link>
            <Link
              href="/kennel"
              className="theme-primary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              My Kennel
            </Link>
          </div>
        </div>
      </section>

      <section className="theme-panel rounded-[28px] p-6">
        {entries.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl p-4 text-sm">
            No judged show results yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="theme-label text-left text-xs uppercase tracking-[0.16em]">
                  <th className="px-3 py-2">Dog</th>
                  <th className="px-3 py-2">Show</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Breed</th>
                  <th className="px-3 py-2">Result</th>
                  <th className="px-3 py-2">Title Points</th>
                </tr>
              </thead>
              <tbody>
                {groupedShows.map((showGroup, showIndex) => (
                  <Fragment key={showGroup.clusterId}>
                    <tr>
                      <td
                        colSpan={6}
                        className={`px-0 ${showIndex === 0 ? "pt-0" : "pt-4"}`}
                      >
                        <div
                          className={`border-t border-[var(--color-border)] ${
                            showIndex === 0 ? "pt-0" : "pt-3"
                          }`}
                        >
                          <h2 className="theme-heading text-sm font-semibold sm:text-base">
                            {showGroup.showName}
                          </h2>
                          <p className="theme-copy mt-1 text-xs sm:text-sm">
                            {showGroup.district != null
                              ? getShowDistrictRegionName(showGroup.district)
                              : "District unavailable"}
                          </p>
                        </div>
                      </td>
                    </tr>
                    {showGroup.breedSections.map((breedSection) => (
                      <Fragment
                        key={`${showGroup.clusterId}-${breedSection.breedCode2}`}
                      >
                        <tr>
                          <td colSpan={6} className="px-0 pt-3">
                            <div className="theme-card mx-1 rounded-xl px-3 py-2">
                              <div className="theme-heading text-sm font-semibold">
                                {breedSection.breedName} ({breedSection.breedCode2})
                              </div>
                              <p className="theme-copy mt-1 text-xs sm:text-sm">
                                {[
                                  `Date ${formatShowDate(
                                    breedSection.scheduledEpoch
                                  )}`,
                                  breedSection.dayIndex != null
                                    ? `Day ${breedSection.dayIndex}`
                                    : null,
                                  "Group Judge:",
                                  null,
                                ]
                                  .filter(Boolean)
                                  .join(" | ")}
                                {" "}
                                {renderJudgeName({
                                  judgeName: breedSection.groupJudgeName,
                                  judgeCode: breedSection.groupJudgeCode,
                                })}
                                {" | "}BIS Judge:{" "}
                                {renderJudgeName({
                                  judgeName: breedSection.bisJudgeName,
                                  judgeCode: breedSection.bisJudgeCode,
                                })}
                              </p>
                            </div>
                          </td>
                        </tr>
                        {breedSection.rows.map((entry) => {
                          const titlePointsAwarded = formatTitlePointsDisplay(
                            getTitlePointsDisplay(entry)
                          );
                          const absenceReasonMessage =
                            getAbsenceReasonMessage(entry);

                          return (
                            <tr key={entry.id} className="theme-card">
                              <td className="rounded-l-2xl px-3 py-3">
                                <Link
                                  href={`/dogs/${entry.dog.id}`}
                                  className="theme-heading font-semibold underline-offset-4 hover:underline"
                                >
                                  {formatDogDisplayName(entry.dog)}
                                </Link>
                                <div className="theme-copy text-xs">
                                  {entry.dog.regNumber}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <Link
                                  href={`/shows/${entry.showDay.cluster.id}/results`}
                                  className="theme-heading font-semibold underline-offset-4 hover:underline"
                                >
                                  {entry.showDay.cluster.name}
                                </Link>
                                <div className="theme-copy text-xs">
                                  {entry.showDay.cluster.district != null
                                    ? getShowDistrictRegionName(
                                        entry.showDay.cluster.district
                                      )
                                    : "District unavailable"}
                                </div>
                              </td>
                              <td className="theme-copy px-3 py-3">
                                {formatShowDate(entry.showDay.scheduledEpoch)}
                                <div className="theme-copy text-xs">
                                  {entry.showDay.dayIndex != null
                                    ? `Day ${entry.showDay.dayIndex}`
                                    : "Day unavailable"}
                                </div>
                              </td>
                              <td className="theme-copy px-3 py-3">
                                {entry.breed.name} ({entry.breed.code2})
                              </td>
                              <td className="theme-heading px-3 py-3 font-semibold">
                                {formatResult(entry)}
                                {absenceReasonMessage ? (
                                  <div className="theme-copy mt-1 text-xs font-normal">
                                    {absenceReasonMessage}
                                  </div>
                                ) : null}
                              </td>
                              <td className="theme-heading rounded-r-2xl px-3 py-3 font-semibold">
                                {titlePointsAwarded ?? (
                                  <span className="theme-copy opacity-50">
                                    &mdash;
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
