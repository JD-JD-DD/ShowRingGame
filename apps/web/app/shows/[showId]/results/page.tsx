import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { publishReadyShowResultsForCluster } from "@/server/services/judging.service";

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString();
}

function getDogDisplayName(dog: {
  registeredName: string | null;
  callName: string | null;
  regNumber: string;
}): string {
  return dog.registeredName || dog.callName || dog.regNumber;
}

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other Breeds";
}

function groupSortKey(groupName: string): string {
  const match = groupName.match(/\d+/);

  if (match) {
    return match[0].padStart(3, "0");
  }

  return groupName;
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

export default async function ShowResultsIndexPage({
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
  await publishReadyShowResultsForCluster({
    showId,
    currentEpoch: getCurrentEpoch(),
  });

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
              breed: { select: { name: true, code2: true, groupName: true } },
              _count: { select: { showEntries: true, showResults: true } },
            },
          },
          _count: { select: { showResults: true } },
          showAwards: {
            where: {
              awardGroup: {
                in: ["GROUP", "BEST_IN_SHOW"],
              },
            },
            orderBy: [{ awardGroup: "asc" }, { rank: "asc" }],
            include: {
              breed: { select: { name: true, code2: true, groupName: true } },
              dog: {
                select: {
                  id: true,
                  registeredName: true,
                  callName: true,
                  regNumber: true,
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
  });

  if (!cluster) {
    notFound();
  }

  const resultCount = cluster.showDays.reduce(
    (total, day) => total + day._count.showResults,
    0
  );
  const entryCount = cluster.showDays.reduce(
    (total, day) =>
      total +
      day.judgingBlocks.reduce(
        (blockTotal, block) => blockTotal + block._count.showEntries,
        0
      ),
    0
  );
  const breedBlocks = new Map<
    string,
    {
      code2: string;
      name: string;
      groupName: string;
      entryCount: number;
      resultCount: number;
    }
  >();

  for (const day of cluster.showDays) {
    for (const block of day.judgingBlocks) {
      if (block._count.showEntries === 0) {
        continue;
      }

      const existing = breedBlocks.get(block.breed.code2);
      breedBlocks.set(block.breed.code2, {
        code2: block.breed.code2,
        name: block.breed.name,
        groupName: normalizeGroupName(block.breed.groupName),
        entryCount:
          (existing?.entryCount ?? 0) + block._count.showEntries,
        resultCount:
          (existing?.resultCount ?? 0) + block._count.showResults,
      });
    }
  }

  const groupedBreeds = [...breedBlocks.values()]
    .sort((a, b) => {
      const groupCompare = groupSortKey(a.groupName).localeCompare(
        groupSortKey(b.groupName)
      );

      return groupCompare || a.name.localeCompare(b.name);
    })
    .reduce(
      (groups, breed) => {
        const group = groups.get(breed.groupName) ?? [];
        group.push(breed);
        groups.set(breed.groupName, group);
        return groups;
      },
      new Map<string, Array<{
        code2: string;
        name: string;
        groupName: string;
        entryCount: number;
        resultCount: number;
      }>>()
    );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 text-white">
      <section className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
          Show Results
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          {cluster.name}
        </h1>
        <p className="mt-4 text-2xl font-semibold text-purple-100">
          {formatShowDate(cluster.startEpoch)}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <div
            className={`rounded-full border px-3 py-1 font-semibold ${statusTone(cluster.status)}`}
          >
            {cluster.status}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            District {cluster.district}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            Entries: {entryCount}
          </div>
          {resultCount > 0 ? (
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
              Results: {resultCount}
            </div>
          ) : null}
        </div>

        {judged ? (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Judging complete
            {judgedEntries ? ` for ${judgedEntries} entered dog(s).` : "."}
          </div>
        ) : null}

        {judgeError ? (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {judgeError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
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
      </section>

      {cluster.showDays.some((day) => day.showAwards.length > 0) ? (
        <section className="mt-6 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
          <h2 className="text-xl font-semibold text-white">
            Group & Best In Show
          </h2>

          <div className="mt-5 grid gap-6">
            {cluster.showDays
              .filter((day) => day.showAwards.length > 0)
              .map((day) => {
                const bestInShowAwards = day.showAwards.filter(
                  (award) => award.awardGroup === "BEST_IN_SHOW"
                );
                const groupAwards = day.showAwards.filter(
                  (award) => award.awardGroup === "GROUP"
                );
                const groupAwardsByGroup = groupAwards.reduce(
                  (groups, award) => {
                    const groupName = normalizeGroupName(award.breed.groupName);
                    const awards = groups.get(groupName) ?? [];
                    awards.push(award);
                    groups.set(groupName, awards);
                    return groups;
                  },
                  new Map<string, typeof groupAwards>()
                );

                return (
                  <div
                    key={day.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <h3 className="text-lg font-semibold text-purple-100">
                      Day {day.dayIndex} - {formatShowDate(day.scheduledEpoch)}
                    </h3>

                    {bestInShowAwards.length > 0 ? (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-100">
                          Best In Show
                        </h4>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {bestInShowAwards.map((award) => (
                            <Link
                              key={award.id}
                              href={`/dogs/${award.dog.id}`}
                              className="rounded-xl border border-sky-300/20 bg-sky-500/10 px-4 py-3 text-sm transition hover:border-sky-300/40"
                            >
                              <div className="font-semibold text-white">
                                {award.awardCode} - {getDogDisplayName(award.dog)}
                              </div>
                              <div className="mt-1 text-xs text-purple-100/65">
                                {award.breed.name} ({award.breed.code2}) -{" "}
                                {award.showEntry.kennel.name}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {groupAwardsByGroup.size > 0 ? (
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        {[...groupAwardsByGroup.entries()]
                          .sort((a, b) =>
                            groupSortKey(a[0]).localeCompare(groupSortKey(b[0]))
                          )
                          .map(([groupName, awards]) => (
                            <div
                              key={`${day.id}-${groupName}`}
                              className="rounded-xl border border-white/10 bg-white/5 p-4"
                            >
                              <h4 className="text-sm font-semibold text-purple-100">
                                {groupName}
                              </h4>
                              <div className="mt-3 grid gap-2">
                                {awards
                                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                                  .map((award) => (
                                    <Link
                                      key={award.id}
                                      href={`/dogs/${award.dog.id}`}
                                      className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm transition hover:border-purple-300/35 hover:bg-white/10"
                                    >
                                      <div className="font-semibold text-white">
                                        {award.awardCode} -{" "}
                                        {getDogDisplayName(award.dog)}
                                      </div>
                                      <div className="mt-1 text-xs text-purple-100/60">
                                        {award.breed.name} -{" "}
                                        {award.showEntry.kennel.name}
                                      </div>
                                    </Link>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <h2 className="text-xl font-semibold text-white">Breeds & Classes</h2>

        {groupedBreeds.size === 0 ? (
          <p className="mt-4 text-sm text-purple-100/70">
            No breed results are available for this show yet.
          </p>
        ) : (
          <div className="mt-5 space-y-7">
            {[...groupedBreeds.entries()].map(([groupName, breeds]) => (
              <div key={groupName}>
                <h3 className="text-lg font-semibold text-purple-100">
                  {groupName}
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {breeds.map((breed) => (
                    <Link
                      key={breed.code2}
                      href={`/shows/${cluster.id}/results/${breed.code2}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/40 hover:bg-sky-500/10"
                    >
                      <span>{breed.name}</span>
                      {breed.resultCount > 0 ? (
                        <span className="ml-2 text-xs font-normal text-purple-100/55">
                          {breed.resultCount} result
                          {breed.resultCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
