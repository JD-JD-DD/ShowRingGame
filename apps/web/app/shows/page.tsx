import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import {
  generateAnnualShowClusterTemplates,
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

function statusTone(status: string): string {
  switch (status) {
    case "COMPLETE":
    case "RESULTS_PUBLISHED":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "OPEN":
    case "ENTRY_OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "CLOSED":
    case "ENTRY_LOCKED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-purple-300/20 bg-white/5 text-purple-100";
  }
}

function derivedStatusTone(
  status:
    | "CURRENT_WEEK"
    | "JUDGED"
    | "NO_ENTRIES"
    | "NOT_YET_JUDGED"
    | "JUDGING_OPENS"
): string {
  switch (status) {
    case "CURRENT_WEEK":
      return "border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100";
    case "JUDGED":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "NO_ENTRIES":
      return "border-purple-300/20 bg-black/20 text-purple-100/65";
    case "NOT_YET_JUDGED":
      return "border-amber-300/30 bg-amber-500/10 text-amber-100";
    case "JUDGING_OPENS":
      return "border-purple-300/20 bg-black/20 text-purple-100/70";
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

  const clusters = await db.showCluster.findMany({
    orderBy: [{ year: "desc" }, { startEpoch: "desc" }],
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          _count: { select: { showEntries: true, showResults: true } },
        },
      },
    },
  });
  const clustersByTemplate = new Map<string, typeof clusters>();

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
              Browse the full 52-week show calendar, open upcoming clusters, and
              review results from generated years.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <form action="/api/shows" method="post">
              <input type="hidden" name="redirectTo" value="/shows" />
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Refresh Shows
              </button>
            </form>
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
          {templates.map((template) => {
            const templateId = `week-${template.weekInYear}-slot-${
              template.slotIndex + 1
            }`;
            const templateClusters = clustersByTemplate.get(templateId) ?? [];
            const isCurrentWeek =
              template.weekInYear === currentCalendarPosition.weekInYear;

            return (
              <div
                key={templateId}
                className={
                  isCurrentWeek
                    ? "rounded-2xl border border-fuchsia-300/35 bg-fuchsia-500/10 p-4 shadow-[0_0_0_1px_rgba(240,171,252,0.08)]"
                    : "rounded-2xl border border-white/10 bg-white/5 p-4"
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
                      {formatShowDayNames(template.showDayNames)} - District{" "}
                      {template.district}
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
                        const hasResults = resultCount > 0;
                        const readyUnjudgedDay = cluster.showDays.some(
                          (day) =>
                            day.scheduledEpoch <= currentEpoch &&
                            day._count.showEntries > 0 &&
                            day._count.showResults === 0
                        );
                        const closedWithoutEntries =
                          !hasResults &&
                          entryCount === 0 &&
                          cluster.entryCloseEpoch <= currentEpoch;
                        const judgingPending =
                          !hasResults &&
                          entryCount > 0 &&
                          (readyUnjudgedDay ||
                            cluster.entryCloseEpoch <= currentEpoch);
                        const judgingOpens =
                          !hasResults && cluster.startEpoch > currentEpoch
                            ? cluster.startEpoch
                            : null;
                        const canOpenShow =
                          cluster.status === "OPEN" || cluster.status === "CLOSED";

                        return (
                          <div
                            key={cluster.id}
                            className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-purple-300/25 bg-black/20 px-3 py-2 text-sm text-purple-100"
                          >
                            <Link
                              href={`/shows/${cluster.id}/results`}
                              className="transition hover:text-sky-100"
                            >
                              <span className="font-semibold text-white">
                                Year {cluster.year}
                              </span>
                              <span className="ml-2 text-purple-100/60">
                                {formatShowDate(cluster.startEpoch)}
                              </span>
                              <span
                                className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(cluster.status)}`}
                              >
                                {cluster.status}
                              </span>
                              {cluster.status !== "COMPLETE" && hasResults ? (
                                <span
                                  className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${derivedStatusTone("JUDGED")}`}
                                >
                                  JUDGED
                                </span>
                              ) : null}
                              {judgingPending ? (
                                <span
                                  className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${derivedStatusTone("NOT_YET_JUDGED")}`}
                                >
                                  NOT YET JUDGED
                                </span>
                              ) : null}
                              {closedWithoutEntries ? (
                                <span
                                  className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${derivedStatusTone("NO_ENTRIES")}`}
                                >
                                  NO ENTRIES
                                </span>
                              ) : null}
                              {hasResults ? (
                                <span className="ml-2 text-sky-100">
                                  {resultCount} result
                                  {resultCount === 1 ? "" : "s"}
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

                            {canOpenShow ? (
                              <Link
                                href={`/shows/${cluster.id}${showDetailQuery}`}
                                className="rounded-lg border border-purple-300/25 bg-white/5 px-2.5 py-1 text-xs font-semibold text-purple-100 transition hover:bg-white/10"
                              >
                                Open
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
        </div>
      </section>
    </main>
  );
}
