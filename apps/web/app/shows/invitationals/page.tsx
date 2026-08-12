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
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel px-6 py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-xs uppercase tracking-[0.22em]">
              Week 52
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              Invitational Showcase
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Annual Top Ten invitationals, Best in Show winners, and the
              year-end field of invited dogs.
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
              href="/shows/history"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Historical Results
            </Link>
            <Link
              href="/shows/top-ten"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Top Ten
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {invitationals.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl px-5 py-4 text-sm">
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
                      <span>Year {cluster.year}</span>
                      <span>{formatShowDate(cluster.startEpoch)}</span>
                    </div>
                    <h2 className="theme-heading mt-1 text-2xl font-semibold">
                      {cluster.name}
                    </h2>
                    {winner ? (
                      <div className="theme-copy mt-3 text-sm">
                        <span className="font-semibold">Best in Show:</span>{" "}
                        {formatDogDisplayName(winner.dog)}
                        <span>
                          {" "}
                          - {winner.breed.name} ({winner.breed.code2})
                          {kennelName ? ` - ${kennelName}` : ""}
                        </span>
                      </div>
                    ) : (
                      <div className="theme-copy mt-3 text-sm">
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
                    <span className="theme-neutral-badge rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      {entryCount} invitation
                      {entryCount === 1 ? "" : "s"}
                    </span>
                    <span className="theme-status-info rounded-full px-2 py-0.5 text-[11px] font-semibold">
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
