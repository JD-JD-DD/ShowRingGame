import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate } from "@/lib/gameClock";

function formatEpoch(epoch: number): string {
  return `${epoch.toLocaleString()} (${epochToDate(epoch).toLocaleString()})`;
}

function formatPublishedDate(epoch: number): string {
  return epochToDate(epoch).toLocaleString();
}

function getDogDisplayName(dog: {
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
}): string {
  return dog.registeredName || dog.callName || dog.regNumber;
}

function getAwardLabel(result: {
  finalRank: number | null;
  placementCode: string | null;
}): string {
  const placement = result.placementCode ?? "";
  const numericPlacement = Number(placement);
  const rank = result.finalRank ?? numericPlacement;

  if (Number.isFinite(numericPlacement)) {
    return rank >= 1 && rank <= 4 ? String(rank) : "-";
  }

  return placement || "-";
}

function getAwardPointsLabel(result: {
  placementCode: string | null;
  pointsAwarded: number;
}): string | null {
  const pointEligibleAwards = new Set(["WB", "WD", "BOB"]);

  if (
    !result.placementCode ||
    !pointEligibleAwards.has(result.placementCode) ||
    result.pointsAwarded <= 0
  ) {
    return null;
  }

  return `${result.pointsAwarded} ${result.pointsAwarded === 1 ? "pt" : "pts"}`;
}

function statusTone(status: string): string {
  switch (status) {
    case "RESULTS_PUBLISHED":
    case "COMPLETE":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "JUDGING":
    case "ENTRY_LOCKED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "OPEN":
    case "ENTRY_OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-purple-300/20 bg-white/5 text-purple-100";
  }
}

export default async function ShowResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{
    judged?: string;
    judgedEntries?: string;
    judgeError?: string;
  }>;
}) {
  const { showId } = await params;
  const { judged, judgedEntries, judgeError } = await searchParams;
  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judgingBlocks: {
            orderBy: [
              { startEpoch: "asc" },
              { ringNumber: "asc" },
              { blockOrder: "asc" },
            ],
            include: {
              judge: { select: { name: true, style: true } },
              breed: { select: { name: true, code2: true, groupName: true } },
              showResults: {
                orderBy: [{ finalRank: "asc" }, { finalScore: "desc" }],
                include: {
                  dog: {
                    select: {
                      id: true,
                      registeredName: true,
                      callName: true,
                      regNumber: true,
                      sex: true,
                    },
                  },
                  showEntry: {
                    include: {
                      kennel: { select: { name: true, slug: true } },
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

  if (!cluster) {
    notFound();
  }

  const resultCount = cluster.showDays.reduce(
    (dayTotal, day) =>
      dayTotal +
      day.judgingBlocks.reduce(
        (blockTotal, block) => blockTotal + block.showResults.length,
        0
      ),
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Show Results
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {cluster.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Published awards, placements, dogs, and kennels for each completed
              breed block.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/shows/${cluster.id}`}
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Show Detail
            </Link>
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              All Shows
            </Link>
            <Link
              href="/kennel"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div
            className={`rounded-full border px-3 py-1 font-semibold ${statusTone(cluster.status)}`}
          >
            {cluster.status}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            District {cluster.district}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            Results: {resultCount}
          </div>
        </div>

        {judged ? (
          <div className="mt-5 rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Judging complete
            {judgedEntries ? ` for ${judgedEntries} entered dog(s).` : "."}
          </div>
        ) : null}

        {judgeError ? (
          <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {judgeError}
          </div>
        ) : null}
      </section>

      {resultCount === 0 ? (
        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          No results have been published for this show yet.
        </section>
      ) : (
        <div className="grid gap-6">
          {cluster.showDays.map((day) => (
            <section
              key={day.id}
              className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Day {day.dayIndex}
                  </h2>
                  <p className="mt-2 text-sm text-purple-100/70">
                    Scheduled {formatEpoch(day.scheduledEpoch)}
                  </p>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(day.status)}`}
                >
                  {day.status}
                </div>
              </div>

              <div className="mt-5 grid gap-5">
                {day.judgingBlocks.map((block) => (
                  <div
                    id={block.id}
                    key={block.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-purple-200/70">
                          Ring {block.ringNumber}
                          {block.ringName ? ` - ${block.ringName}` : ""}
                        </div>
                        <h3 className="mt-2 text-xl font-semibold text-white">
                          {block.breed.name}
                        </h3>
                        <p className="mt-1 text-sm text-purple-100/65">
                          Judge: {block.judge.name}{" "}
                          <span className="text-purple-100/45">
                            ({block.judge.style ?? "balanced"})
                          </span>
                        </p>
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(block.status)}`}
                      >
                        {block.status}
                      </div>
                    </div>

                    {block.showResults.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-purple-100/65">
                        No results published for this block yet.
                      </div>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                              <th className="px-3 py-2">Award</th>
                              <th className="px-3 py-2">Dog</th>
                              <th className="px-3 py-2">Kennel</th>
                              <th className="px-3 py-2">Sex</th>
                              <th className="px-3 py-2">Published</th>
                            </tr>
                          </thead>
                          <tbody>
                            {block.showResults.map((result) => {
                              const awardLabel = getAwardLabel(result);
                              const pointsLabel = getAwardPointsLabel(result);

                              return (
                                <tr
                                  key={result.id}
                                  className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                                >
                                  <td className="rounded-l-2xl px-3 py-3">
                                    <div className="inline-flex min-w-10 items-center justify-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 font-semibold text-sky-100">
                                      <span>{awardLabel}</span>
                                      {pointsLabel ? (
                                        <span className="font-bold text-white">
                                          {pointsLabel}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3">
                                    <Link
                                      href={`/dogs/${result.dog.id}`}
                                      className="font-semibold text-white underline-offset-4 hover:underline"
                                    >
                                      {getDogDisplayName(result.dog)}
                                    </Link>
                                    <div className="text-xs text-purple-100/55">
                                      {result.dog.regNumber}
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-purple-100/75">
                                    {result.showEntry.kennel.name}
                                  </td>
                                  <td className="px-3 py-3 text-purple-100/75">
                                    {result.dog.sex}
                                  </td>
                                  <td className="rounded-r-2xl px-3 py-3 text-purple-100/65">
                                    {formatPublishedDate(result.publishedAtEpoch)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
