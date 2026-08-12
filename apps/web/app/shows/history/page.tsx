import Link from "next/link";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import {
  getShowClusterDisplayStatus,
  type ShowDisplayStatus,
} from "@/server/services/showAvailability.service";
import { isArchivedYear13LegacyRepairCluster } from "@/server/services/annualShowSchedule.service";
import {
  getShowDistrictRegionName,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
} from "@showring/rules";

export const dynamic = "force-dynamic";

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getCurrentCalendarYear(currentEpoch: number): number {
  return Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1;
}

function getInvitationalClusterId(year: number): string {
  return `invitational-year-${year}`;
}

function isInvitationalCluster(clusterId: string): boolean {
  return clusterId.startsWith("invitational-year-");
}

function isSeasonComplete(cluster: {
  status: string;
  showDays: Array<{
    status: string;
    _count: {
      showResults: number;
    };
  }>;
}): boolean {
  return (
    cluster.status === "COMPLETE" ||
    cluster.showDays.some(
      (day) =>
        day.status === "RESULTS_PUBLISHED" && day._count.showResults > 0
    )
  );
}

function getClusterWeekInYear(cluster: {
  year: number;
  startEpoch: number;
}): number {
  const yearStartEpoch = (cluster.year - 1) * SHOW_YEAR_HOURS;
  const hourInYear = Math.max(0, cluster.startEpoch - yearStartEpoch);

  return Math.floor(hourInYear / SHOW_WEEK_HOURS) + 1;
}

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function statusTone(status: ShowDisplayStatus): string {
  switch (status) {
    case "JUDGED":
      return "theme-status-info";
    case "OPEN":
      return "theme-status-success";
    case "PAUSED":
      return "theme-status-warning";
    case "SCHEDULED":
      return "theme-status-neutral";
    case "AWAITING JUDGING":
    case "JUDGING":
      return "theme-status-warning";
    case "CLOSED":
      return "theme-status-neutral";
    case "CANCELLED":
      return "theme-status-danger";
  }
}

function clusterResultCount(cluster: {
  showDays: Array<{
    _count: {
      showResults: number;
    };
  }>;
}): number {
  return cluster.showDays.reduce(
    (total, day) => total + day._count.showResults,
    0
  );
}

function clusterEntryCount(cluster: {
  showDays: Array<{
    _count: {
      showEntries: number;
    };
  }>;
}): number {
  return cluster.showDays.reduce(
    (total, day) => total + day._count.showEntries,
    0
  );
}

function bestInShowWinner(cluster: {
  showDays: Array<{
    showAwards: Array<{
      awardGroup: string;
      rank: number | null;
      dog: {
        id: string;
        registeredName: string | null;
        callName: string | null;
        regNumber: string;
        visibleTitlePrefix: string | null;
        visibleTitleSuffix: string | null;
      };
      breed: {
        name: string;
        code2: string;
      };
      showEntry: {
        enteredKennelName: string | null;
        kennel: {
          name: string;
          slug: string;
          moderationStatus: "ACTIVE" | "CLOSED";
        };
      };
    }>;
  }>;
}) {
  return cluster.showDays
    .flatMap((day) => day.showAwards)
    .find(
      (award) =>
        award.awardGroup === "BEST_IN_SHOW" &&
        (award.rank === 1 || award.rank === null)
    );
}

export default async function HistoricalShowResultsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    year?: string | string[];
  }>;
}) {
  const currentEpoch = getCurrentEpoch();
  const currentYear = getCurrentCalendarYear(currentEpoch);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedYear = Number(firstQueryValue(resolvedSearchParams.year));

  const previousYears = await db.showCluster.groupBy({
    by: ["year"],
    where: {
      year: {
        lt: currentYear,
      },
    },
    orderBy: {
      year: "desc",
    },
  });
  const currentYearInvitational = await db.showCluster.findUnique({
    where: {
      id: getInvitationalClusterId(currentYear),
    },
    select: {
      status: true,
      showDays: {
        select: {
          status: true,
          _count: {
            select: {
              showResults: true,
            },
          },
        },
      },
    },
  });
  const historicalYearSet = new Set(
    previousYears.map((yearGroup) => yearGroup.year)
  );

  if (
    currentYearInvitational &&
    isSeasonComplete(currentYearInvitational)
  ) {
    historicalYearSet.add(currentYear);
  }

  const historicalYears = [...historicalYearSet].sort((a, b) => b - a);
  const defaultYear = historicalYearSet.has(currentYear)
    ? currentYear
    : currentYear - 1;
  const selectedYear =
    Number.isInteger(requestedYear) && historicalYears.includes(requestedYear)
      ? requestedYear
      : historicalYears.includes(defaultYear)
        ? defaultYear
        : historicalYears[0];

  const clusters = selectedYear
    ? await db.showCluster.findMany({
        where: {
          year: selectedYear,
        },
        orderBy: [{ startEpoch: "asc" }, { name: "asc" }],
        include: {
          showDays: {
            orderBy: [{ dayIndex: "asc" }],
            include: {
              _count: {
                select: {
                  showEntries: true,
                  showResults: true,
                },
              },
              showAwards: {
                where: {
                  awardGroup: "BEST_IN_SHOW",
                },
                orderBy: [{ rank: "asc" }],
                include: {
                  dog: {
                    select: {
                      id: true,
                      registeredName: true,
                      callName: true,
                      regNumber: true,
                      visibleTitlePrefix: true,
                      visibleTitleSuffix: true,
                    },
                  },
                  breed: {
                    select: {
                      name: true,
                      code2: true,
                    },
                  },
                  showEntry: {
                    include: {
                      kennel: {
                        select: {
                          name: true,
                          slug: true,
                          moderationStatus: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : [];
  const invitationalClusters = clusters.filter((cluster) =>
    isInvitationalCluster(cluster.id)
  );
  const regularClusters = clusters.filter(
    (cluster) =>
      !isInvitationalCluster(cluster.id) &&
      !isArchivedYear13LegacyRepairCluster(cluster)
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              Historical Show Results
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Review completed generated show years without loading older
              seasons into the active show planning calendar.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              All Shows
            </Link>
            <Link
              href="/shows/invitationals"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Invitationals
            </Link>
            <Link
              href="/shows/top-ten"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Top Ten
            </Link>
          </div>
        </div>

        {historicalYears.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {historicalYears.map((year) => (
              <Link
                key={year}
                href={`/shows/history?year=${year}`}
                className={
                  year === selectedYear
                    ? "theme-primary-button rounded-full px-4 py-2 text-sm font-semibold"
                    : "theme-secondary-button rounded-full px-4 py-2 text-sm font-semibold"
                }
              >
                Year {year}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {selectedYear ? (
        <section className="theme-panel mb-6 py-6">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.2em]">
                  Year {selectedYear} Finale
                </div>
                <h2 className="theme-heading mt-1 text-2xl font-semibold">
                  Invitational Showcase
                </h2>
              </div>
              <div className="theme-copy text-sm">
                Week 52 Top Ten event
              </div>
            </div>

            {invitationalClusters.length === 0 ? (
              <div className="theme-card theme-copy mt-5 rounded-2xl px-5 py-4 text-sm">
                No invitational record was found for Year {selectedYear}.
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {invitationalClusters.map((cluster) => {
                  const resultCount = clusterResultCount(cluster);
                  const entryCount = clusterEntryCount(cluster);
                  const winner = bestInShowWinner(cluster);
                  const hasJudgingActivity =
                    resultCount > 0 ||
                    cluster.showDays.some(
                      (day) =>
                        day.status === "JUDGING" ||
                        day.status === "RESULTS_PUBLISHED"
                    );
                  const playerStatus = getShowClusterDisplayStatus({
                    cluster,
                    hasJudgingActivity,
                    currentEpoch,
                    entryCount,
                    resultCount,
                  });
                  const kennelName = winner
                    ? winner.showEntry.kennel.moderationStatus === "CLOSED"
                      ? winner.showEntry.kennel.name
                      : winner.showEntry.enteredKennelName?.trim() || winner.showEntry.kennel.name
                    : null;

                  return (
                    <Link
                      key={cluster.id}
                      href={`/shows/${cluster.id}/results`}
                      className="theme-card-interactive block rounded-2xl p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="theme-label flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
                            <span>Week {getClusterWeekInYear(cluster)}</span>
                            <span>{formatShowDate(cluster.startEpoch)}</span>
                          </div>
                          <h3 className="theme-heading mt-1 text-xl font-semibold">
                            {cluster.name}
                          </h3>
                          {winner ? (
                            <div className="theme-copy mt-3 text-sm">
                              <span className="font-semibold">
                                Best in Show:
                              </span>{" "}
                              {formatDogDisplayName(winner.dog)}
                              <span>
                                {" "}
                                - {winner.breed.name} ({winner.breed.code2})
                                {kennelName ? ` - ${kennelName}` : ""}
                              </span>
                            </div>
                          ) : (
                            <div className="theme-copy mt-3 text-sm">
                              Invitational results are not published yet.
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                          >
                            {playerStatus}
                          </span>
                          <span className="theme-neutral-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            {entryCount} invitation
                            {entryCount === 1 ? "" : "s"}
                          </span>
                          <span className="theme-status-info rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            {resultCount} result
                            {resultCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="theme-panel rounded-[28px] p-6">
        {selectedYear ? (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="theme-label text-xs uppercase tracking-[0.18em]">
                Year {selectedYear}
              </div>
              <h2 className="theme-heading mt-1 text-2xl font-semibold">
                Generated Show Records
              </h2>
            </div>
            <div className="theme-copy text-sm">
              {regularClusters.length} show cluster
              {regularClusters.length === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}

        {historicalYears.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl px-5 py-4 text-sm">
            No historical show records are available yet.
          </div>
        ) : regularClusters.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl px-5 py-4 text-sm">
            No generated show records were found for Year {selectedYear}.
          </div>
        ) : (
          <div className="grid gap-3">
            {regularClusters.map((cluster) => {
              const resultCount = clusterResultCount(cluster);
              const entryCount = clusterEntryCount(cluster);
              const hasJudgingActivity =
                resultCount > 0 ||
                cluster.showDays.some(
                  (day) =>
                    day.status === "JUDGING" ||
                    day.status === "RESULTS_PUBLISHED"
                );
              const playerStatus = getShowClusterDisplayStatus({
                cluster,
                hasJudgingActivity,
                currentEpoch,
                entryCount,
                resultCount,
              });

              return (
                <Link
                  key={cluster.id}
                  href={`/shows/${cluster.id}/results`}
                  className="theme-card-interactive rounded-2xl p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="theme-label flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
                        <span>Week {getClusterWeekInYear(cluster)}</span>
                        <span>{getShowDistrictRegionName(cluster.district)}</span>
                        <span>{formatShowDate(cluster.startEpoch)}</span>
                      </div>
                      <h3 className="theme-heading mt-1 text-lg font-semibold">
                        {cluster.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                      >
                        {playerStatus}
                      </span>
                      <span className="theme-neutral-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {entryCount} entr{entryCount === 1 ? "y" : "ies"}
                      </span>
                      <span className="theme-status-info rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {resultCount} result{resultCount === 1 ? "" : "s"}
                      </span>
                      <span className="theme-neutral-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {cluster.showDays.length} day
                        {cluster.showDays.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
