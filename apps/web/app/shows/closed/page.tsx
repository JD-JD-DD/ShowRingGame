import Link from "next/link";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";

export const dynamic = "force-dynamic";

const UPCOMING_SHOW_WINDOW_HOURS = 42;

function formatShowDateTime(epoch: number): string {
  return epochToDate(epoch).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function statusTone(status: string): string {
  switch (status) {
    case "CLOSED":
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

export default async function ClosedShowsPage() {
  const currentEpoch = getCurrentEpoch();
  const clusters = await db.showCluster.findMany({
    where: {
      startEpoch: {
        gt: currentEpoch,
        lte: currentEpoch + UPCOMING_SHOW_WINDOW_HOURS,
      },
      status: "CLOSED",
    },
    orderBy: [{ startEpoch: "asc" }, { name: "asc" }],
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          _count: { select: { showEntries: true, showResults: true } },
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
              Closed Upcoming Shows
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Review upcoming clusters whose entry windows have closed.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Open Shows
            </Link>
            <Link
              href="/shows/archive"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Results Archive
            </Link>
            <Link
              href="/kennel"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <div className="mt-5 inline-flex rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-2 text-sm text-purple-100/80">
          Showing through {formatShowDateTime(currentEpoch + UPCOMING_SHOW_WINDOW_HOURS)}
        </div>
      </section>

      {clusters.length === 0 ? (
        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          <div>No closed upcoming shows are available.</div>
        </section>
      ) : (
        <div className="grid gap-6">
          {clusters.map((cluster) => {
            const entryCount = cluster.showDays.reduce(
              (total, day) => total + day._count.showEntries,
              0
            );
            const resultCount = cluster.showDays.reduce(
              (total, day) => total + day._count.showResults,
              0
            );

            return (
              <section
                key={cluster.id}
                className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] px-6 py-5 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${statusTone(cluster.status)}`}
                    >
                      {cluster.status}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {cluster.name}
                    </h2>
                    <div className="mt-2 text-sm text-purple-100/70">
                      District {cluster.district} - Year {cluster.year} -{" "}
                      {cluster.showDays.length} show day
                      {cluster.showDays.length === 1 ? "" : "s"} - {entryCount}{" "}
                      entr{entryCount === 1 ? "y" : "ies"}
                    </div>
                    <div className="mt-2 text-xs text-purple-100/55">
                      Entries: {formatShowDateTime(cluster.entryOpenEpoch)} to{" "}
                      {formatShowDateTime(cluster.entryCloseEpoch)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <Link
                      href={`/shows/${cluster.id}/results`}
                      className={
                        resultCount > 0
                          ? "rounded-2xl bg-sky-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-sky-500 lg:min-w-32"
                          : "rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10 lg:min-w-32"
                      }
                    >
                      Results
                    </Link>
                    <Link
                      href={`/shows/${cluster.id}`}
                      className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10 lg:min-w-32"
                    >
                      View Show
                    </Link>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
