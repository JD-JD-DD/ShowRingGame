import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import {
  getShowClusterDisplayStatus,
  type ShowDisplayStatus,
} from "@/server/services/showAvailability.service";
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
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "SCHEDULED":
      return "border-purple-300/20 bg-black/20 text-purple-100/70";
    case "AWAITING JUDGING":
    case "JUDGING":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "CLOSED":
      return "border-purple-300/20 bg-black/20 text-purple-100/65";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
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
                  showEntries: {
                    where: {
                      entryStatus: {
                        in: ["ENTERED", "JUDGED"],
                      },
                    },
                  },
                  showResults: true,
                },
              },
            },
          },
        },
      })
    : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Historical Show Results
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Review completed generated show years without loading older
              seasons into the active show planning calendar.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              All Shows
            </Link>
            <Link
              href="/shows/top-ten"
              className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
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
                    ? "rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-4 py-2 text-sm font-semibold text-fuchsia-100"
                    : "rounded-full border border-purple-300/20 bg-black/20 px-4 py-2 text-sm font-semibold text-purple-100/70 transition hover:bg-white/10 hover:text-white"
                }
              >
                Year {year}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        {selectedYear ? (
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-purple-200/70">
                Year {selectedYear}
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Generated Show Records
              </h2>
            </div>
            <div className="text-sm text-purple-100/65">
              {clusters.length} show cluster{clusters.length === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}

        {historicalYears.length === 0 ? (
          <div className="rounded-2xl border border-purple-300/20 bg-black/20 px-5 py-4 text-sm text-purple-100/70">
            No historical show records are available yet.
          </div>
        ) : clusters.length === 0 ? (
          <div className="rounded-2xl border border-purple-300/20 bg-black/20 px-5 py-4 text-sm text-purple-100/70">
            No generated show records were found for Year {selectedYear}.
          </div>
        ) : (
          <div className="grid gap-3">
            {clusters.map((cluster) => {
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
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-sky-300/30 hover:bg-white/10"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-purple-200/70">
                        <span>Week {getClusterWeekInYear(cluster)}</span>
                        <span>{getShowDistrictRegionName(cluster.district)}</span>
                        <span>{formatShowDate(cluster.startEpoch)}</span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {cluster.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                      >
                        {playerStatus}
                      </span>
                      <span className="rounded-full border border-purple-300/20 bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-purple-100/70">
                        {entryCount} entr{entryCount === 1 ? "y" : "ies"}
                      </span>
                      <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-100">
                        {resultCount} result{resultCount === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full border border-purple-300/20 bg-black/20 px-2 py-0.5 text-[11px] font-semibold text-purple-100/70">
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
