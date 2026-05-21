import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";

function formatEpoch(epoch: number): string {
  return `${epoch.toLocaleString()} (${epochToDate(epoch).toLocaleString()})`;
}

function statusTone(status: string): string {
  switch (status) {
    case "OPEN":
    case "ENTRY_OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "JUDGING":
    case "ENTRY_LOCKED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "RESULTS_PUBLISHED":
    case "COMPLETE":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-purple-300/20 bg-white/5 text-purple-100";
  }
}

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{
    dogIds?: string;
  }>;
}) {
  const { dogIds } = await searchParams;
  const selectedDogIdsQuery = typeof dogIds === "string" ? dogIds : "";
  const showDetailQuery = selectedDogIdsQuery
    ? `?dogIds=${encodeURIComponent(selectedDogIdsQuery)}`
    : "";
  const currentEpoch = getCurrentEpoch();
  const clusters = await db.showCluster.findMany({
    orderBy: [{ startEpoch: "asc" }, { name: "asc" }],
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          _count: { select: { showResults: true } },
          judgingBlocks: {
            orderBy: [
              { startEpoch: "asc" },
              { ringNumber: "asc" },
              { blockOrder: "asc" },
            ],
            include: {
              judge: { select: { name: true, style: true } },
              breed: { select: { name: true, code2: true, groupName: true } },
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Show Calendar
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              Upcoming Shows
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Browse seeded clusters, show days, judging blocks, assigned judges,
              and breed rings.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
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

        <div className="mt-5 inline-flex rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-2 text-sm text-purple-100/80">
          Current game epoch: {currentEpoch.toLocaleString()}
        </div>

        {selectedDogIdsQuery ? (
          <div className="mt-3 rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100/80">
            Carrying selected kennel dogs into show entry planning.
          </div>
        ) : null}

      </section>

      {clusters.length === 0 ? (
        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          <div>No upcoming shows are available yet.</div>
        </section>
      ) : (
        <div className="grid gap-6">
          {clusters.map((cluster) => {
            const blockCount = cluster.showDays.reduce(
              (total, day) => total + day.judgingBlocks.length,
              0
            );
            const resultCount = cluster.showDays.reduce(
              (total, day) => total + day._count.showResults,
              0
            );

            return (
              <section
                key={cluster.id}
                className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusTone(cluster.status)}`}
                    >
                      {cluster.status}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {cluster.name}
                    </h2>
                    <div className="mt-2 text-sm text-purple-100/70">
                      District {cluster.district} · Year {cluster.year} ·{" "}
                      {cluster.showDays.length} show day
                      {cluster.showDays.length === 1 ? "" : "s"} · {blockCount}{" "}
                      judging block{blockCount === 1 ? "" : "s"}
                    </div>
                    <div className="mt-2 text-xs text-purple-100/55">
                      Entries: {formatEpoch(cluster.entryOpenEpoch)} to{" "}
                      {formatEpoch(cluster.entryCloseEpoch)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/shows/${cluster.id}/results`}
                      className={
                        resultCount > 0
                          ? "rounded-2xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500"
                          : "rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                      }
                    >
                      Results
                    </Link>
                    <Link
                      href={`/shows/${cluster.id}${showDetailQuery}`}
                      className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      Open Show
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {cluster.showDays.map((day) => (
                    <div
                      key={day.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-white">
                          Day {day.dayIndex}
                        </div>
                        <div
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(day.status)}`}
                        >
                          {day.status}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-purple-100/70">
                        Starts {formatEpoch(day.scheduledEpoch)}
                      </div>
                      <div className="mt-4 space-y-2">
                        {day.judgingBlocks.slice(0, 4).map((block) => (
                          <div
                            key={block.id}
                            className="grid gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm sm:grid-cols-[0.8fr_1.1fr_1fr]"
                          >
                            <div className="text-purple-100">
                              Ring {block.ringNumber}
                            </div>
                            <div className="font-medium text-white">
                              {block.breed.name}
                            </div>
                            <div className="text-purple-100/65">
                              {block.judge.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
