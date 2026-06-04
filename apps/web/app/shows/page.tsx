import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getShowEntryAvailability } from "@/server/services/showAvailability.service";
import {
  generateAnnualShowClusterTemplates,
  getShowDistrictRegionName,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
} from "@showring/rules";

export const dynamic = "force-dynamic";

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type PlayerClusterStatus =
  | "SCHEDULED"
  | "OPEN"
  | "CLOSED"
  | "AWAITING JUDGING"
  | "JUDGING"
  | "JUDGED"
  | "CANCELLED";

function statusTone(status: PlayerClusterStatus): string {
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

function derivedStatusTone(
  status: "CURRENT_WEEK" | "JUDGING_OPENS"
): string {
  switch (status) {
    case "CURRENT_WEEK":
      return "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100";
    case "JUDGING_OPENS":
      return "border-purple-300/20 bg-black/20 text-purple-100/70";
  }
}

function getPlayerClusterStatus(args: {
  clusterStatus: string;
  hasJudgingActivity: boolean;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  currentEpoch: number;
}): PlayerClusterStatus {
  const availability = getShowEntryAvailability({
    cluster: {
      status: args.clusterStatus,
      entryOpenEpoch: args.entryOpenEpoch,
      entryCloseEpoch: args.entryCloseEpoch,
    },
    currentEpoch: args.currentEpoch,
    hasJudgingActivity: args.hasJudgingActivity,
  });

  switch (availability.entryStatus) {
    case "CANCELLED":
      return "CANCELLED";
    case "RESULTS_PUBLISHED":
      return "JUDGED";
    case "JUDGING":
      return "JUDGING";
    case "OPEN":
      return "OPEN";
    case "CLOSED":
      return "AWAITING JUDGING";
    case "NOT_OPEN":
      return "SCHEDULED";
  }
}

function getGeneratedTemplateId(clusterId: string): string | null {
  const match = clusterId.match(/^generated-year-\d+-(week-\d+-slot-\d+)$/);

  return match?.[1] ?? null;
}

function formatShowDayNames(dayNames: string[]): string {
  const displayOrder = ["Friday", "Saturday", "Sunday", "Monday"];

  return [...dayNames]
    .sort((a, b) => displayOrder.indexOf(a) - displayOrder.indexOf(b))
    .join(", ");
}

function getCurrentCalendarPosition(currentEpoch: number): {
  year: number;
  weekInYear: number;
} {
  const hourInYear = currentEpoch % SHOW_YEAR_HOURS;
  const showCalendarHourInYear = Math.min(hourInYear, SHOW_YEAR_HOURS - 2);

  return {
    year: Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1,
    weekInYear: Math.floor(showCalendarHourInYear / SHOW_WEEK_HOURS) + 1,
  };
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

export default async function ShowsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    dogIds?: string | string[];
    generated?: string | string[];
    generateError?: string | string[];
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedDogIdsQuery = firstQueryValue(resolvedSearchParams.dogIds) ?? "";
  const generated = firstQueryValue(resolvedSearchParams.generated);
  const generateError = firstQueryValue(resolvedSearchParams.generateError);
  const showDetailQuery = selectedDogIdsQuery
    ? `?dogIds=${encodeURIComponent(selectedDogIdsQuery)}`
    : "";
  const currentEpoch = getCurrentEpoch();
  const currentCalendarPosition = getCurrentCalendarPosition(currentEpoch);
  const templates = generateAnnualShowClusterTemplates();
  const userId = await getSessionUserId();
  const currentKennel = userId
    ? await db.kennel.findUnique({
        where: { userId },
        select: { id: true },
      })
    : null;

  const [clusters, enteredClusters] = await Promise.all([
    db.showCluster.findMany({
      orderBy: [{ year: "desc" }, { startEpoch: "desc" }],
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
    }),
    currentKennel
      ? db.showCluster.findMany({
          where: {
            showDays: {
              some: {
                showEntries: {
                  some: {
                    kennelId: currentKennel.id,
                    entryStatus: {
                      in: ["ENTERED", "JUDGED"],
                    },
                  },
                },
              },
            },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);
  const enteredClusterIds = new Set(enteredClusters.map((cluster) => cluster.id));
  const clustersByTemplate = new Map<string, typeof clusters>();
  const invitationalClusters = clusters.filter((cluster) =>
    cluster.id.startsWith("invitational-year-")
  );
  const currentWeekTemplateIndex = templates.findIndex(
    (template) =>
      template.weekInYear === currentCalendarPosition.weekInYear
  );

  for (const cluster of clusters) {
    const templateId = getGeneratedTemplateId(cluster.id);

    if (!templateId) {
      continue;
    }

    const templateClusters = clustersByTemplate.get(templateId) ?? [];
    templateClusters.push(cluster);
    clustersByTemplate.set(templateId, templateClusters);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Annual Show Calendar
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Browse the annual district show calendar, open upcoming clusters,
              and review results from generated years. Week 52 is reserved for
              the invitational show.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="#current-week"
              className="rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              Jump to Current Week
            </Link>
            <Link
              href="/shows/top-ten"
              className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              Top Ten
            </Link>
            <Link
              href="/travel-map"
              className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              District Map
            </Link>

            {/*
            remove refresh button

            <form action="/api/shows" method="post">
              <input type="hidden" name="redirectTo" value="/shows" />
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Refresh Shows
              </button>
            </form>
            */}

            <Link
              href="/kennel"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              My Kennel
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              Home
            </Link>
          </div>
        </div>

        {selectedDogIdsQuery ? (
          <div className="mt-3 rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100/80">
            Carrying selected kennel dogs into show entry planning.
          </div>
        ) : null}

        {generated ? (
          <div className="mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Shows refreshed.
          </div>
        ) : null}

        {generateError ? (
          <div className="mt-3 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {generateError}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <div className="grid gap-3">
          {templates.map((template, templateIndex) => {
            const templateId = `week-${template.weekInYear}-slot-${
              template.slotIndex + 1
            }`;
            const templateClusters = clustersByTemplate.get(templateId) ?? [];
            const isCurrentWeek =
              template.weekInYear === currentCalendarPosition.weekInYear;
            const isCurrentWeekAnchor =
              templateIndex === currentWeekTemplateIndex;

            return (
              <div
                key={templateId}
                id={isCurrentWeekAnchor ? "current-week" : undefined}
                className={
                  isCurrentWeek
                    ? "scroll-mt-6 rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 p-4 shadow-[0_0_0_1px_rgba(240,171,252,0.08)]"
                    : "scroll-mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
                }
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-purple-200/70">
                      <span>
                        Week {template.weekInYear} - Slot{" "}
                        {template.slotIndex + 1}
                      </span>
                      {isCurrentWeek ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] ${derivedStatusTone("CURRENT_WEEK")}`}
                        >
                          Current Week
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {template.name}
                    </h2>
                    <div className="mt-2 text-sm text-purple-100/65">
                      {formatShowDayNames(template.showDayNames)} -{" "}
                      {getShowDistrictRegionName(template.district)}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 lg:justify-end">
                    {templateClusters.length === 0 ? (
                      <span className="rounded-full border border-purple-300/20 bg-black/20 px-3 py-1 text-xs text-purple-100/60">
                        No generated years yet
                      </span>
                    ) : (
                      templateClusters.map((cluster) => {
                        const resultCount = clusterResultCount(cluster);
                        const entryCount = clusterEntryCount(cluster);
                        const hasJudgingActivity =
                          resultCount > 0 ||
                          cluster.showDays.some(
                            (day) =>
                              day.status === "JUDGING" ||
                              day.status === "RESULTS_PUBLISHED"
                          );
                        const playerStatus = getPlayerClusterStatus({
                          clusterStatus: cluster.status,
                          hasJudgingActivity,
                          entryOpenEpoch: cluster.entryOpenEpoch,
                          entryCloseEpoch: cluster.entryCloseEpoch,
                          currentEpoch,
                        });
                        const judgingOpens =
                          !hasJudgingActivity && cluster.startEpoch > currentEpoch
                            ? cluster.startEpoch
                            : null;
                        const canEnterShow = playerStatus === "OPEN";
                        const clusterHref =
                          playerStatus === "OPEN"
                            ? `/shows/${cluster.id}${showDetailQuery}`
                            : `/shows/${cluster.id}/results`;

                        return (
                          <div
                            key={cluster.id}
                            className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-purple-300/25 bg-black/20 px-3 py-2 text-sm text-purple-100"
                          >
                            <Link
                              href={clusterHref}
                              className="transition hover:text-sky-100"
                            >
                              <span className="font-semibold text-white">
                                Year {cluster.year}
                              </span>

                              {/*}
                              **no need for the date twice
                              <span className="ml-2 text-purple-100/60">
                                {formatShowDate(cluster.startEpoch)}
                              </span>
                              */}

                              <span
                                className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                              >
                                {playerStatus}
                              </span>
                              {enteredClusterIds.has(cluster.id) ? (
                                <span className="ml-2 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                                  REPRESENTED
                                </span>
                              ) : null}
                              {resultCount > 0 ? (
                                <span className="ml-2 text-sky-100">
                                  {resultCount} result
                                  {resultCount === 1 ? "" : "s"}
                                </span>
                              ) : hasJudgingActivity ? (
                                <span className="ml-2 text-sky-100">
                                  Judging underway
                                </span>
                              ) : entryCount > 0 ? (
                                <span className="ml-2 text-purple-100/70">
                                  {entryCount} entr
                                  {entryCount === 1 ? "y" : "ies"}
                                </span>
                              ) : null}
                              {judgingOpens ? (
                                <span
                                  className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] ${derivedStatusTone("JUDGING_OPENS")}`}
                                >
                                  Judging {formatShowDate(judgingOpens)}
                                </span>
                              ) : null}
                            </Link>

                            {canEnterShow ? (
                              <Link
                                href={`/shows/${cluster.id}${showDetailQuery}`}
                                className="rounded-lg border border-purple-300/25 bg-white/5 px-2.5 py-1 text-xs font-semibold text-purple-100 transition hover:bg-white/10"
                              >
                                Enter
                              </Link>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div
            id={
              currentCalendarPosition.weekInYear === 52
                ? "current-week"
                : undefined
            }
            className={
              currentCalendarPosition.weekInYear === 52
                ? "scroll-mt-6 rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 p-4 shadow-[0_0_0_1px_rgba(240,171,252,0.08)]"
                : "scroll-mt-6 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4"
            }
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-100/80">
                  <span>Week 52</span>
                  {currentCalendarPosition.weekInYear === 52 ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.12em] ${derivedStatusTone("CURRENT_WEEK")}`}
                    >
                      Current Week
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Invitational Show
                </h2>
                <div className="mt-2 text-sm text-amber-100/75">
                  The Top Ten dogs in every breed are invited after Week 51
                  judging. No regular district shows are scheduled this week.
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 lg:justify-end">
                {invitationalClusters.length === 0 ? (
                  <span className="rounded-full border border-amber-300/20 bg-black/20 px-3 py-1 text-xs text-amber-100/70">
                    Invitations pending
                  </span>
                ) : (
                  invitationalClusters.map((cluster) => {
                    const resultCount = clusterResultCount(cluster);
                    const entryCount = clusterEntryCount(cluster);
                    const hasJudgingActivity =
                      resultCount > 0 ||
                      cluster.showDays.some(
                        (day) =>
                          day.status === "JUDGING" ||
                          day.status === "RESULTS_PUBLISHED"
                      );
                    const playerStatus = getPlayerClusterStatus({
                      clusterStatus: cluster.status,
                      hasJudgingActivity,
                      entryOpenEpoch: cluster.entryOpenEpoch,
                      entryCloseEpoch: cluster.entryCloseEpoch,
                      currentEpoch,
                    });

                    return (
                      <Link
                        key={cluster.id}
                        href={`/shows/${cluster.id}/results`}
                        className="rounded-xl border border-amber-300/25 bg-black/20 px-3 py-2 text-sm text-amber-100 transition hover:text-white"
                      >
                        <span className="font-semibold text-white">
                          Year {cluster.year}
                        </span>
                        <span className="ml-2 text-amber-100/70">
                          {formatShowDate(cluster.startEpoch)}
                        </span>
                        <span
                          className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                        >
                          {playerStatus}
                        </span>
                        {enteredClusterIds.has(cluster.id) ? (
                          <span className="ml-2 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                            REPRESENTED
                          </span>
                        ) : null}
                        <span className="ml-2 text-amber-100/80">
                          {entryCount} invitation
                          {entryCount === 1 ? "" : "s"}
                        </span>
                        {resultCount > 0 ? (
                          <span className="ml-2 text-sky-100">
                            {resultCount} result
                            {resultCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
