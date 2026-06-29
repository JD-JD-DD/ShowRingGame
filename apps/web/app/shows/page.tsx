import Link from "next/link";

import { ShowCountdownText } from "@/components/shows/ShowCountdownText";
import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { buildShowCountdowns } from "@/lib/showCountdowns";
import { getSessionUserId } from "@/lib/session";
import {
  getShowClusterDisplayStatus,
  type ShowDisplayStatus,
} from "@/server/services/showAvailability.service";
import { getClubStewardingClaimedClusterIds } from "@/server/services/kennelService.service";
import {
  generateAnnualShowClusterTemplates,
  getShowDistrictRegionName,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
} from "@showring/rules";
import { JumpToCurrentWeekButton } from "./JumpToCurrentWeekButton";

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

function statusTone(status: ShowDisplayStatus): string {
  switch (status) {
    case "JUDGED":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "PAUSED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "SCHEDULED":
      return "theme-neutral-badge";
    case "AWAITING JUDGING":
    case "JUDGING":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "CLOSED":
      return "theme-neutral-badge opacity-75";
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
      return "theme-neutral-badge";
  }
}

type EntryActivityLevel = "NONE" | "LOW" | "MODERATE" | "HEAVY";

type EntryActivity = {
  level: EntryActivityLevel;
};

function getEntryActivity(entryCount: number): EntryActivity {
  if (entryCount <= 0) {
    return { level: "NONE" };
  }

  if (entryCount <= 100) {
    return { level: "LOW" };
  }

  if (entryCount <= 999) {
    return { level: "MODERATE" };
  }

  return { level: "HEAVY" };
}

function entryActivityButtonTone(level: EntryActivityLevel): string {
  switch (level) {
    case "NONE":
      return "theme-secondary-button";
    case "LOW":
      return "border-[var(--dog-border)] bg-purple-500/15 text-[var(--dog-heading)] hover:bg-purple-500/25";
    case "MODERATE":
      return "border-purple-200/50 bg-purple-500/35 text-[var(--dog-heading)] hover:bg-purple-500/45";
    case "HEAVY":
      return "border-fuchsia-200/70 bg-purple-600 text-white shadow-[var(--dog-shadow)] hover:bg-purple-500";
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
  const pageStartedAtMs = Date.now();
  const phaseDurationsMs = {
    coverageCheckMs: 0,
    repairCheckMs: 0,
    ensureScheduleMs: 0,
    clusterQueryMs: 0,
    badgeQueryMs: 0,
  };
  const runPhase = async <T,>(
    phaseName: keyof typeof phaseDurationsMs,
    action: () => Promise<T>
  ): Promise<T> => {
    const startedAtMs = Date.now();

    try {
      return await action();
    } finally {
      phaseDurationsMs[phaseName] += Date.now() - startedAtMs;
    }
  };
  const showDetailQuery = selectedDogIdsQuery
    ? `?dogIds=${encodeURIComponent(selectedDogIdsQuery)}`
    : "";
  const currentEpoch = getCurrentEpoch();
  const currentCalendarPosition = getCurrentCalendarPosition(currentEpoch);
  const calendarDisplayStartEpoch =
    (currentCalendarPosition.year - 1) * SHOW_YEAR_HOURS;
  const calendarDisplayEndEpoch =
    currentEpoch + SHOW_INSTANCE_GENERATION_HORIZON_HOURS + SHOW_WEEK_HOURS;
  const templates = generateAnnualShowClusterTemplates();

  const userId = await getSessionUserId();
  const currentKennel = userId
    ? await db.kennel.findUnique({
        where: { userId },
        select: { id: true },
      })
    : null;

  const clusters = await runPhase("clusterQueryMs", () =>
    db.showCluster.findMany({
      where: {
        startEpoch: {
          lte: calendarDisplayEndEpoch,
        },
        endEpoch: {
          gte: calendarDisplayStartEpoch,
        },
      },
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
    })
  );
  const displayedClusterIds = clusters.map((cluster) => cluster.id);
  const [enteredClusters, stewardedClusterIds] = await runPhase(
    "badgeQueryMs",
    () =>
      currentKennel
        ? Promise.all([
            displayedClusterIds.length > 0
              ? db.showCluster.findMany({
                  where: {
                    id: {
                      in: displayedClusterIds,
                    },
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
            getClubStewardingClaimedClusterIds({
              kennelId: currentKennel.id,
              showClusterIds: displayedClusterIds,
            }),
          ])
        : Promise.resolve([[], new Set<string>()])
  );
  const totalMs = Date.now() - pageStartedAtMs;

  console.info("shows page timing", {
    currentEpoch,
    displayedClusterCount: clusters.length,
    displayedShowDayCount: clusters.reduce(
      (total, cluster) => total + cluster.showDays.length,
      0
    ),
    coverageCheckMs: phaseDurationsMs.coverageCheckMs,
    repairCheckMs: phaseDurationsMs.repairCheckMs,
    ensureScheduleMs: phaseDurationsMs.ensureScheduleMs,
    clusterQueryMs: phaseDurationsMs.clusterQueryMs,
    badgeQueryMs: phaseDurationsMs.badgeQueryMs,
    totalMs,
  });
  const enteredClusterIds = new Set(enteredClusters.map((cluster) => cluster.id));
  const clusterDisplayById = new Map(
    clusters.map((cluster) => {
      const resultCount = clusterResultCount(cluster);
      const entryCount = clusterEntryCount(cluster);
      const hasJudgingActivity =
        resultCount > 0 ||
        cluster.showDays.some(
          (day) =>
            day.status === "JUDGING" || day.status === "RESULTS_PUBLISHED"
        );
      const playerStatus = getShowClusterDisplayStatus({
        cluster,
        hasJudgingActivity,
        currentEpoch,
        entryCount,
        resultCount,
      });
      const countdowns = buildShowCountdowns({
        currentEpoch,
        clusterId: cluster.id,
        clusterStatus: cluster.status,
        displayStatus: playerStatus,
        entryOpenEpoch: cluster.entryOpenEpoch,
        entryCloseEpoch: cluster.entryCloseEpoch,
        startEpoch: cluster.startEpoch,
        resultCount,
        hasJudgingActivity,
        showDays: cluster.showDays.map((day) => ({
          scheduledEpoch: day.scheduledEpoch,
          status: day.status,
          publishedAtEpoch: day.publishedAtEpoch,
          resultCount: day._count.showResults,
        })),
      });
      const entryActivity = getEntryActivity(entryCount);
      const canEnterShow = playerStatus === "OPEN";
      const clusterHref = canEnterShow
        ? `/shows/${cluster.id}${showDetailQuery}`
        : `/shows/${cluster.id}/results`;

      return [
        cluster.id,
        {
          resultCount,
          entryCount,
          hasJudgingActivity,
          playerStatus,
          countdowns,
          entryActivity,
          canEnterShow,
          clusterHref,
        },
      ] as const;
    })
  );
  const regularClusterDisplays = clusters
    .filter((cluster) => !cluster.id.startsWith("invitational-year-"))
    .flatMap((cluster) => {
      const display = clusterDisplayById.get(cluster.id);

      return display ? [{ cluster, display }] : [];
    });
  const allClusterDisplays = clusters.flatMap((cluster) => {
    const display = clusterDisplayById.get(cluster.id);

    return display ? [{ cluster, display }] : [];
  });
  const upcomingEntryClosings = regularClusterDisplays
    .filter(
      ({ cluster, display }) =>
        display.playerStatus === "OPEN" && cluster.entryCloseEpoch > currentEpoch
    )
    .sort((a, b) => a.cluster.entryCloseEpoch - b.cluster.entryCloseEpoch)
    .slice(0, 3);
  const upcomingJudging = allClusterDisplays
    .filter(
      ({ display }) =>
        display.countdowns.judging.targetEpoch !== null &&
        display.countdowns.judging.targetEpoch > currentEpoch
    )
    .sort(
      (a, b) =>
        (a.display.countdowns.judging.targetEpoch ?? 0) -
        (b.display.countdowns.judging.targetEpoch ?? 0)
    )
    .slice(0, 3);
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
    <main className="shows-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              Annual Show Calendar
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Week 52 is reserved for the invitational show.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <JumpToCurrentWeekButton />
            <Link
              href="/shows/invitationals"
              className="rounded-2xl border border-amber-300/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              Invitationals
            </Link>
            <Link
              href="/shows/history"
              className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
            >
              Historical Results
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
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
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
          <div className="mt-3 rounded-2xl border border-[var(--dog-border)] bg-purple-500/10 px-4 py-3 text-sm text-[var(--dog-copy)]">
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

        <div className="theme-card theme-copy mt-4 rounded-2xl px-4 py-3 text-xs">
          Entry activity is shown by Enter button color intensity.
        </div>
      </section>

      <section className="theme-panel mb-8 rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="theme-label text-xs uppercase tracking-[0.18em]">
              Show Clock
            </p>
            <h2 className="theme-heading mt-1 text-xl font-semibold">
              Upcoming Windows
            </h2>
          </div>

          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 lg:max-w-3xl">
            <div className="theme-card rounded-2xl px-4 py-3">
              <div className="theme-label text-[11px] uppercase tracking-[0.16em]">
                Upcoming Entry Closings
              </div>
              {upcomingEntryClosings.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {upcomingEntryClosings.map(({ cluster, display }) => (
                    <Link
                      key={cluster.id}
                      href={display.clusterHref}
                      className="block min-w-0 rounded-xl border border-[var(--dog-border)] bg-purple-500/10 px-3 py-2 transition hover:bg-purple-500/15 hover:text-sky-100"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="theme-heading truncate text-sm font-semibold">
                            {cluster.name}
                          </div>
                          <div className="theme-copy mt-0.5 truncate text-[11px]">
                            Year {cluster.year} ·{" "}
                            {getShowDistrictRegionName(cluster.district)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs font-semibold text-emerald-100">
                          <ShowCountdownText
                            targetEpoch={display.countdowns.entryClose.targetEpoch}
                            initialCurrentEpoch={currentEpoch}
                            fallbackLabel={display.countdowns.entryClose.shortValue}
                            prefix="closes in "
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="theme-copy mt-1 text-sm">No open entries.</div>
              )}
            </div>

            <div className="theme-card rounded-2xl px-4 py-3">
              <div className="theme-label text-[11px] uppercase tracking-[0.16em]">
                Upcoming Judging
              </div>
              {upcomingJudging.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {upcomingJudging.map(({ cluster, display }) => (
                    <Link
                      key={cluster.id}
                      href={display.clusterHref}
                      className="block min-w-0 rounded-xl border border-[var(--dog-border)] bg-purple-500/10 px-3 py-2 transition hover:bg-purple-500/15 hover:text-sky-100"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="theme-heading truncate text-sm font-semibold">
                            {cluster.name}
                          </div>
                          <div className="theme-copy mt-0.5 truncate text-[11px]">
                            Year {cluster.year} ·{" "}
                            {getShowDistrictRegionName(cluster.district)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs font-semibold text-amber-100">
                          <ShowCountdownText
                            targetEpoch={display.countdowns.judging.targetEpoch}
                            initialCurrentEpoch={currentEpoch}
                            fallbackLabel={display.countdowns.judging.shortValue}
                            prefix="judges in "
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="theme-copy mt-1 text-sm">
                  No upcoming judging.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="theme-panel rounded-[28px] p-6">
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
                    ? "scroll-mt-6 rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 p-4 shadow-[var(--dog-shadow)]"
                    : "theme-card scroll-mt-6 rounded-2xl p-4"
                }
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="theme-label flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em]">
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
                    <h2 className="theme-heading mt-1 text-lg font-semibold">
                      {template.name}
                    </h2>
                    <div className="theme-copy mt-2 text-sm">
                      {formatShowDayNames(template.showDayNames)} -{" "}
                      {getShowDistrictRegionName(template.district)}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 lg:justify-end">
                    {templateClusters.length === 0 ? (
                      <span className="theme-neutral-badge rounded-full px-3 py-1 text-xs opacity-70">
                        No generated years yet
                      </span>
                    ) : (
                      templateClusters.map((cluster) => {
                        const clusterDisplay = clusterDisplayById.get(
                          cluster.id
                        );

                        if (!clusterDisplay) {
                          return null;
                        }

                        const {
                          resultCount,
                          hasJudgingActivity,
                          playerStatus,
                          countdowns,
                          entryActivity,
                          canEnterShow,
                          clusterHref,
                        } = clusterDisplay;

                        return (
                          <div
                            key={cluster.id}
                            className="theme-card flex flex-wrap items-center justify-end gap-2 rounded-xl px-3 py-2 text-sm"
                          >
                            <Link
                              href={clusterHref}
                              className="transition hover:text-sky-100"
                            >
                              <span className="theme-heading font-semibold">
                                Year {cluster.year}
                              </span>

                              {/*}
                              **no need for the date twice
                              <span className="ml-2 text-[var(--dog-copy)]">
                                {formatShowDate(cluster.startEpoch)}
                              </span>
                              */}

                              <span
                                className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                              >
                                {playerStatus}
                              </span>
                              {countdowns.rowMetaLabel ? (
                                <span className="ml-2 text-[11px] text-[var(--dog-copy)]">
                                  {countdowns.rowMetaLabel}
                                </span>
                              ) : null}
                              {enteredClusterIds.has(cluster.id) ? (
                                <span className="ml-2 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                                  REPRESENTED
                                </span>
                              ) : null}
                              {stewardedClusterIds.has(cluster.id) ? (
                                <span className="ml-2 rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                                  STEWARDING
                                </span>
                              ) : null}
                              {resultCount > 0 ? (
                                <span className="ml-2 text-sky-100">
                                  {resultCount} result
                                  {resultCount === 1 ? "" : "s"}
                                </span>
                              ) : hasJudgingActivity &&
                                !countdowns.rowMetaLabel ? (
                                <span className="ml-2 text-sky-100">
                                  Judging underway
                                </span>
                              ) : null}
                            </Link>

                            {canEnterShow ? (
                              <Link
                                href={`/shows/${cluster.id}${showDetailQuery}`}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${entryActivityButtonTone(entryActivity.level)}`}
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
                ? "scroll-mt-6 rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 p-4 shadow-[var(--dog-shadow)]"
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
                <h2 className="theme-heading mt-1 text-lg font-semibold">
                  Invitational Show
                </h2>
                <div className="mt-2 text-sm text-amber-100/75">
                  The Top Ten dogs in every breed are invited after Week 51
                  judging. No regular district shows are scheduled this week.
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-2 lg:justify-end">
                {invitationalClusters.length === 0 ? (
                  <span className="theme-neutral-badge rounded-full px-3 py-1 text-xs">
                    Invitations pending
                  </span>
                ) : (
                  invitationalClusters.map((cluster) => {
                    const clusterDisplay = clusterDisplayById.get(cluster.id);

                    if (!clusterDisplay) {
                      return null;
                    }

                    const {
                      resultCount,
                      entryCount,
                      playerStatus,
                      countdowns,
                    } = clusterDisplay;

                    return (
                      <Link
                        key={cluster.id}
                        href={`/shows/${cluster.id}/results`}
                        className="theme-card-interactive rounded-xl px-3 py-2 text-sm"
                      >
                        <span className="theme-heading font-semibold">
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
                        {countdowns.rowMetaLabel ? (
                          <span className="ml-2 text-[11px] text-amber-100/70">
                            {countdowns.rowMetaLabel}
                          </span>
                        ) : null}
                        {enteredClusterIds.has(cluster.id) ? (
                          <span className="ml-2 rounded-full border border-emerald-300/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                            REPRESENTED
                          </span>
                        ) : null}
                        {stewardedClusterIds.has(cluster.id) ? (
                          <span className="ml-2 rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                            STEWARDING
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
