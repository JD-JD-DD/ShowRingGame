import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";
import { getShowDistrictRegionName } from "@showring/rules";

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
      return "theme-status-info";
    case "JUDGING":
    case "ENTRY_LOCKED":
      return "theme-status-warning";
    case "OPEN":
    case "ENTRY_OPEN":
      return "theme-status-success";
    case "CANCELLED":
      return "theme-status-danger";
    default:
      return "theme-status-neutral";
  }
}

function showEntryKennelName(entry: {
  enteredKennelName: string | null;
  kennel: { name: string; moderationStatus: "ACTIVE" | "CLOSED" };
}): string {
  if (entry.kennel.moderationStatus === "CLOSED") return entry.kennel.name;
  return entry.enteredKennelName?.trim() || entry.kennel.name;
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
              _count: {
                select: {
                  showEntries: true,
                  showResults: true,
                },
              },
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
                  visibleTitlePrefix: true,
                  visibleTitleSuffix: true,
                },
              },
              showEntry: {
                include: {
                  kennel: { select: { name: true, slug: true, moderationStatus: true } },
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
  const canShowEntryCount =
    resultCount > 0 || cluster.status === "COMPLETE";
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
    <main className="results-page mx-auto max-w-6xl px-6 py-8">
      <section className="theme-panel rounded-[28px] px-6 py-8 text-center">
        <p className="theme-label text-sm uppercase tracking-[0.22em]">
          Show Results
        </p>
        <h1 className="theme-heading mt-3 text-4xl font-bold tracking-tight">
          {cluster.name}
        </h1>
        <p className="theme-heading mt-4 text-2xl font-semibold">
          {formatShowCalendarLabel(cluster.startEpoch)}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <div
            className={`rounded-full border px-3 py-1 font-semibold ${statusTone(cluster.status)}`}
          >
            {cluster.status}
          </div>
          <div className="theme-neutral-badge rounded-full px-3 py-1">
            {getShowDistrictRegionName(cluster.district)}
          </div>
          {canShowEntryCount ? (
            <div className="theme-neutral-badge rounded-full px-3 py-1">
              Entries: {entryCount}
            </div>
          ) : null}
          {resultCount > 0 ? (
            <div className="theme-neutral-badge rounded-full px-3 py-1">
              Results: {resultCount}
            </div>
          ) : null}
        </div>

        {judged ? (
          <div className="theme-status-info mx-auto mt-5 max-w-xl rounded-2xl px-4 py-3 text-sm">
            Judging complete
            {judgedEntries ? ` for ${judgedEntries} entered dog(s).` : "."}
          </div>
        ) : null}

        {judgeError ? (
          <div className="theme-status-danger mx-auto mt-5 max-w-xl rounded-2xl px-4 py-3 text-sm">
            {judgeError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {cluster.status === "OPEN" ? (
            <Link
              href={`/shows/${cluster.id}`}
              className="theme-primary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Enter Show
            </Link>
          ) : null}
          <Link
            href={`/shows/${cluster.id}`}
            className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Show Detail
          </Link>
        </div>
      </section>

      {cluster.showDays.some((day) => day.showAwards.length > 0) ? (
        <section className="theme-panel mt-6 rounded-[28px] p-6">
          <h2 className="theme-heading text-xl font-semibold">
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
                    className="theme-card rounded-2xl p-5"
                  >
                    <h3 className="theme-heading text-lg font-semibold">
                      {formatShowCalendarLabel(day.scheduledEpoch)}
                    </h3>

                    {bestInShowAwards.length > 0 ? (
                      <div className="mt-4">
                        <h4 className="theme-accent-link text-sm font-semibold uppercase tracking-[0.16em]">
                          Best In Show
                        </h4>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {bestInShowAwards.map((award) => (
                            <Link
                              key={award.id}
                              href={`/dogs/${award.dog.id}`}
                              className="theme-card-interactive rounded-xl px-4 py-3 text-sm"
                            >
                              <div className="theme-heading font-semibold">
                                {award.awardCode} - {formatDogDisplayName(award.dog)}
                              </div>
                              <div className="theme-copy mt-1 text-xs">
                                {award.breed.name} ({award.breed.code2}) -{" "}
                                {showEntryKennelName(award.showEntry)}
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
                              className="theme-card rounded-xl p-4"
                            >
                              <h4 className="theme-heading text-sm font-semibold">
                                {groupName}
                              </h4>
                              <div className="mt-3 grid gap-2">
                                {awards
                                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                                  .map((award) => (
                                    <Link
                                      key={award.id}
                                      href={`/dogs/${award.dog.id}`}
                                      className="theme-card-interactive rounded-lg px-3 py-2 text-sm"
                                    >
                                      <div className="theme-heading font-semibold">
                                        {award.awardCode} -{" "}
                                        {formatDogDisplayName(award.dog)}
                                      </div>
                                      <div className="theme-copy mt-1 text-xs">
                                        {award.breed.name} -{" "}
                                        {showEntryKennelName(award.showEntry)}
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

      <section className="theme-panel mt-6 rounded-[28px] p-6">
        <h2 className="theme-heading text-xl font-semibold">Breeds & Classes</h2>

        {groupedBreeds.size === 0 ? (
          <p className="theme-copy mt-4 text-sm">
            No breed results are available for this show yet.
          </p>
        ) : (
          <div className="mt-5 space-y-7">
            {[...groupedBreeds.entries()].map(([groupName, breeds]) => (
              <div key={groupName}>
                <h3 className="theme-heading text-lg font-semibold">
                  {groupName}
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {breeds.map((breed) => (
                    <Link
                      key={breed.code2}
                      href={`/shows/${cluster.id}/results/${breed.code2}`}
                      className="theme-card-interactive theme-accent-link rounded-xl px-4 py-3 text-sm font-semibold"
                    >
                      <span>{breed.name}</span>
                      {breed.resultCount > 0 ? (
                        <span className="theme-copy ml-2 text-xs font-normal">
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
