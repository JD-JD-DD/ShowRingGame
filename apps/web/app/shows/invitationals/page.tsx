import Link from "next/link";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import {
  getShowClusterDisplayStatus,
  type ShowDisplayStatus,
} from "@/server/services/showAvailability.service";

export const dynamic = "force-dynamic";

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

export default async function InvitationalsPage() {
  const currentEpoch = getCurrentEpoch();
  const invitationals = await db.showCluster.findMany({
    where: {
      id: {
        startsWith: "invitational-year-",
      },
    },
    orderBy: [{ year: "desc" }],
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
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="border-y border-amber-300/20 bg-[linear-gradient(90deg,rgba(120,53,15,0.48),rgba(24,24,27,0.84),rgba(8,47,73,0.42))] px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-amber-100/75">
              Week 52
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              Invitational Showcase
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-amber-100/75">
              Annual Top Ten invitationals, Best in Show winners, and the
              year-end field of invited dogs.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-amber-300/25 bg-black/20 px-5 py-3 text-sm font-semibold text-amber-100 transition hover:bg-black/35"
            >
              All Shows
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
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {invitationals.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-black/20 px-5 py-4 text-sm text-amber-100/75">
            No invitational records are available yet.
          </div>
        ) : (
          invitationals.map((cluster) => {
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
            const kennelName =
              winner?.showEntry.enteredKennelName?.trim() ||
              winner?.showEntry.kennel.name;

            return (
              <Link
                key={cluster.id}
                href={`/shows/${cluster.id}/results`}
                className="block rounded-2xl border border-amber-200/20 bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(69,26,3,0.62))] p-5 transition hover:border-amber-200/45"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-100/70">
                      <span>Year {cluster.year}</span>
                      <span>{formatShowDate(cluster.startEpoch)}</span>
                    </div>
                    <h2 className="mt-1 text-2xl font-semibold text-white">
                      {cluster.name}
                    </h2>
                    {winner ? (
                      <div className="mt-3 text-sm text-amber-50">
                        <span className="font-semibold">Best in Show:</span>{" "}
                        {formatDogDisplayName(winner.dog)}
                        <span className="text-amber-100/65">
                          {" "}
                          - {winner.breed.name} ({winner.breed.code2})
                          {kennelName ? ` - ${kennelName}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-amber-100/70">
                        Results are not published yet.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(playerStatus)}`}
                    >
                      {playerStatus}
                    </span>
                    <span className="rounded-full border border-amber-300/20 bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-amber-100/80">
                      {entryCount} invitation
                      {entryCount === 1 ? "" : "s"}
                    </span>
                    <span className="rounded-full border border-sky-300/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-100">
                      {resultCount} result{resultCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}
