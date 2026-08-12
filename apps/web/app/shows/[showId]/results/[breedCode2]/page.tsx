import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import { formatShowAwardLabel } from "@/lib/showAwards";
import { formatShowEntryAbsenceReason } from "@/lib/showEntryAbsence";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";
import type { ShowEntryAbsenceReason } from "@prisma/client";

const AWARD_SORT_ORDER: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  WD: 5,
  WB: 5,
  RWD: 6,
  RWB: 6,
  BOW: 7,
  BOB: 8,
  BOS: 9,
  SELECT_DOG: 10,
  SELECT_BITCH: 11,
  AOM: 12,
};

function formatPublishedDate(epoch: number): string {
  return epochToDate(epoch).toLocaleString();
}

function formatPoints(pointsAwarded: number): string {
  return `${pointsAwarded} ${pointsAwarded === 1 ? "pt" : "pts"}`;
}

function sortAwards<T extends { awardCode: string; rank: number | null }>(
  awards: T[]
): T[] {
  return [...awards].sort((a, b) => {
    const orderDifference =
      (AWARD_SORT_ORDER[a.awardCode] ?? 99) -
      (AWARD_SORT_ORDER[b.awardCode] ?? 99);

    if (orderDifference !== 0) return orderDifference;

    return (a.rank ?? 99) - (b.rank ?? 99);
  });
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

type ResultRow = {
  id: string;
  finalRank: number | null;
  publishedAtEpoch: number;
  dog: {
    id: string;
    registeredName: string | null;
    callName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
    sex: "M" | "F";
  };
  showEntry: {
    enteredKennelName: string | null;
    enteredKennelSlug: string | null;
    kennel: {
      name: string;
      slug: string;
      moderationStatus: "ACTIVE" | "CLOSED";
    };
  };
  showAwards: Array<{
    awardCode: string;
    awardGroup: string;
    sex: "M" | "F" | null;
    rank: number | null;
    pointsAwarded: number;
    isMajor: boolean;
  }>;
};

type EntryRow = {
  id: string;
  entryStatus: string;
  absenceReason: ShowEntryAbsenceReason | null;
  enteredKennelName: string | null;
  enteredKennelSlug: string | null;
  dog: {
    id: string;
    registeredName: string | null;
    callName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
    sex: "M" | "F";
  };
  kennel: {
    name: string;
    slug: string;
    moderationStatus: "ACTIVE" | "CLOSED";
  };
  showResult: {
    id: string;
    finalRank: number | null;
    publishedAtEpoch: number;
    showAwards: Array<{
      awardCode: string;
      awardGroup: string;
      sex: "M" | "F" | null;
      rank: number | null;
      pointsAwarded: number;
      isMajor: boolean;
    }>;
  } | null;
};

function showEntryKennelName(entry: ResultRow["showEntry"]): string {
  if (entry.kennel.moderationStatus === "CLOSED") return entry.kennel.name;
  return entry.enteredKennelName?.trim() || entry.kennel.name;
}

function getSectionAwards(result: ResultRow, awardGroups: string[]): ResultRow["showAwards"] {
  return sortAwards(
    result.showAwards.filter((award) => awardGroups.includes(award.awardGroup))
  );
}

function hasSectionAwards(result: ResultRow, awardGroups: string[]): boolean {
  return getSectionAwards(result, awardGroups).length > 0;
}

function ResultSection({
  title,
  results,
  awardGroups,
}: {
  title: string;
  results: ResultRow[];
  awardGroups: string[];
}) {
  const sectionResults = results.filter((result) =>
    hasSectionAwards(result, awardGroups)
  );

  if (sectionResults.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <h3 className="theme-heading text-lg font-semibold">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--dog-label)]">
              <th className="px-3 py-2">Award</th>
              <th className="px-3 py-2">Dog</th>
              <th className="px-3 py-2">Kennel</th>
              <th className="px-3 py-2">Sex</th>
              <th className="px-3 py-2">Published</th>
            </tr>
          </thead>
          <tbody>
            {sectionResults.map((result) => {
              const awards = getSectionAwards(result, awardGroups);

              return (
                <tr
                  key={`${title}-${result.id}`}
                  className="border border-[var(--dog-border)] bg-[var(--dog-card)] shadow-[var(--dog-shadow)]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <div className="flex min-w-24 flex-wrap gap-2">
                      {awards.map((award) => (
                        <span
                          key={`${result.id}-${award.awardCode}-${award.awardGroup}`}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 font-semibold text-sky-100"
                        >
                          <span>{formatShowAwardLabel(award.awardCode)}</span>
                          {award.pointsAwarded > 0 ? (
                            <span className="theme-heading font-bold">
                              {formatPoints(award.pointsAwarded)}
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/dogs/${result.dog.id}`}
                      className="theme-heading font-semibold underline-offset-4 hover:underline"
                    >
                      {formatDogDisplayName(result.dog)}
                    </Link>
                    <div className="text-xs text-[var(--dog-copy)]">
                      {result.dog.regNumber}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--dog-copy)]">
                    {showEntryKennelName(result.showEntry)}
                  </td>
                  <td className="px-3 py-3 text-[var(--dog-copy)]">
                    {result.dog.sex}
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 text-[var(--dog-copy)]">
                    {formatPublishedDate(result.publishedAtEpoch)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AllEntriesTable({ entries }: { entries: EntryRow[] }) {
  const sortedEntries = [...entries].sort((a, b) => {
    const rankDifference =
      (a.showResult?.finalRank ?? 9999) - (b.showResult?.finalRank ?? 9999);

    if (rankDifference !== 0) return rankDifference;

    return formatDogDisplayName(a.dog).localeCompare(formatDogDisplayName(b.dog));
  });

  if (sortedEntries.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <h3 className="theme-heading text-lg font-semibold">All Entered Dogs</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-[var(--dog-label)]">
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Awards</th>
              <th className="px-3 py-2">Dog</th>
              <th className="px-3 py-2">Kennel</th>
              <th className="px-3 py-2">Sex</th>
              <th className="px-3 py-2">Published</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => {
              const awards = sortAwards(entry.showResult?.showAwards ?? []);
              const kennelName = showEntryKennelName(entry);

              return (
                <tr
                  key={`all-entries-${entry.id}`}
                  className="border border-[var(--dog-border)] bg-[var(--dog-card)] shadow-[var(--dog-shadow)]"
                >
                  <td className="theme-heading rounded-l-2xl px-3 py-3 font-semibold">
                    {entry.showResult?.finalRank ?? "-"}
                  </td>
                  <td className="px-3 py-3">
                    {awards.length > 0 ? (
                      <div className="flex min-w-24 flex-wrap gap-2">
                        {awards.map((award) => (
                          <span
                            key={`${entry.id}-${award.awardCode}-${award.awardGroup}-${award.rank ?? "none"}`}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 font-semibold text-sky-100"
                          >
                            <span>{formatShowAwardLabel(award.awardCode)}</span>
                            {award.pointsAwarded > 0 ? (
                              <span className="theme-heading font-bold">
                                {formatPoints(award.pointsAwarded)}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--dog-copy)]">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/dogs/${entry.dog.id}`}
                      className="theme-heading font-semibold underline-offset-4 hover:underline"
                    >
                      {formatDogDisplayName(entry.dog)}
                    </Link>
                    <div className="text-xs text-[var(--dog-copy)]">
                      {entry.dog.regNumber}
                      {entry.entryStatus !== "JUDGED" ? (
                        <span className="ml-2 text-amber-100/70">
                          {entry.entryStatus === "ABSENT" ? "ABS" : entry.entryStatus}
                        </span>
                      ) : null}
                      {entry.entryStatus === "ABSENT" &&
                      entry.absenceReason ? (
                        <div className="mt-1 text-[11px] text-[var(--dog-copy)]">
                          {formatShowEntryAbsenceReason(entry.absenceReason)}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--dog-copy)]">
                    {kennelName}
                  </td>
                  <td className="px-3 py-3 text-[var(--dog-copy)]">
                    {entry.dog.sex}
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 text-[var(--dog-copy)]">
                    {entry.showResult
                      ? formatPublishedDate(entry.showResult.publishedAtEpoch)
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function BreedResultsPage({
  params,
}: {
  params: Promise<{ showId: string; breedCode2: string }>;
}) {
  const { showId, breedCode2 } = await params;
  const normalizedBreedCode = decodeURIComponent(breedCode2).toUpperCase();

  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judgingBlocks: {
            where: { breedCode2: normalizedBreedCode },
            orderBy: [
              { startEpoch: "asc" },
              { ringNumber: "asc" },
              { blockOrder: "asc" },
            ],
            include: {
              judge: { select: { judgeCode: true, name: true, style: true } },
              breed: { select: { name: true, code2: true, groupName: true } },
              _count: {
                select: {
                  showEntries: true,
                  showResults: true,
                },
              },
              showEntries: {
                orderBy: [{ id: "asc" }],
                include: {
                  dog: {
                    select: {
                      id: true,
                      registeredName: true,
                      callName: true,
                      regNumber: true,
                      visibleTitlePrefix: true,
                      visibleTitleSuffix: true,
                      sex: true,
                    },
                  },
                  kennel: { select: { name: true, slug: true, moderationStatus: true } },
                  showResult: {
                    include: {
                      showAwards: {
                        select: {
                          awardCode: true,
                          awardGroup: true,
                          sex: true,
                          rank: true,
                          pointsAwarded: true,
                          isMajor: true,
                        },
                      },
                    },
                  },
                },
              },
              showResults: {
                orderBy: [{ finalRank: "asc" }, { finalScore: "desc" }],
                include: {
                  dog: {
                    select: {
                      id: true,
                      registeredName: true,
                      callName: true,
                      regNumber: true,
                      visibleTitlePrefix: true,
                      visibleTitleSuffix: true,
                      sex: true,
                    },
                  },
                  showEntry: {
                    include: {
                      kennel: { select: { name: true, slug: true, moderationStatus: true } },
                    },
                  },
                  showAwards: {
                    select: {
                      awardCode: true,
                      awardGroup: true,
                      sex: true,
                      rank: true,
                      pointsAwarded: true,
                      isMajor: true,
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

  const blocks = cluster.showDays.flatMap((day) => day.judgingBlocks);
  const enteredBlocks = blocks.filter((block) => block._count.showEntries > 0);
  const enteredDays = cluster.showDays
    .map((day) => ({
      ...day,
      judgingBlocks: day.judgingBlocks.filter(
        (block) => block._count.showEntries > 0
      ),
    }))
    .filter((day) => day.judgingBlocks.length > 0);
  const firstBlock = enteredBlocks[0] ?? blocks[0];

  if (!firstBlock) {
    notFound();
  }

  const resultCount = enteredBlocks.reduce(
    (total, block) => total + block._count.showResults,
    0
  );

  return (
    <main className="results-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel rounded-[28px] px-6 py-8 text-center">
        <p className="theme-label text-sm uppercase tracking-[0.22em]">
          Breed Results
        </p>
        <h1 className="theme-heading mt-3 text-4xl font-bold tracking-tight">
          {cluster.name}
        </h1>
        <p className="theme-heading mt-4 text-2xl font-semibold">
          {formatShowCalendarLabel(cluster.startEpoch)}
        </p>
        <h2 className="theme-heading mt-8 text-2xl font-bold uppercase tracking-[0.08em]">
          {firstBlock.breed.name}
        </h2>
        <p className="theme-heading mt-2 text-lg font-semibold">
          {enteredDays.length || blocks.length} show day
          {(enteredDays.length || blocks.length) === 1 ? "" : "s"}
        </p>

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
              href={`/shows/${cluster.id}/results`}
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              Full Show Results
          </Link>
          <Link
            href={`/shows/${cluster.id}`}
            className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Show Detail
          </Link>
        </div>
      </section>

      {enteredBlocks.length === 0 ? (
        <section className="theme-card theme-copy mt-6 rounded-[28px] p-6 text-sm">
          This breed had no entries in this show.
        </section>
      ) : resultCount === 0 ? (
        <section className="theme-card theme-copy mt-6 rounded-[28px] p-6 text-sm">
          Results have not been published for this breed yet.
        </section>
      ) : (
        <div className="mt-6 grid gap-6">
          {enteredDays.map((day) => (
            <section
              key={day.id}
              className="theme-panel rounded-[28px] p-6"
            >
              <div className="border-b border-[var(--color-border)] pb-5">
                <p className="theme-label text-xs uppercase tracking-[0.18em]">
                  Show Day
                </p>
                <h3 className="theme-heading mt-2 text-2xl font-bold">
                  {formatShowCalendarLabel(day.scheduledEpoch)}
                </h3>
                <p className="theme-heading mt-2 text-sm font-semibold">
                  Judge:{" "}
                  <Link
                    href={`/judges/${day.judgingBlocks[0].judge.judgeCode}`}
                    className="theme-heading underline-offset-4 hover:underline"
                  >
                    {day.judgingBlocks[0].judge.name}
                  </Link>
                </p>
              </div>

              <div className="mt-5 grid gap-6">
                {day.judgingBlocks.map((block) => (
                  <div key={block.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="theme-label text-xs uppercase tracking-[0.18em]">
                          Ring {block.ringNumber}
                          {block.ringName ? ` - ${block.ringName}` : ""}
                        </p>
                        <p className="theme-copy mt-2 text-sm">
                          {block._count.showEntries} entered /{" "}
                          {block._count.showResults} result
                          {block._count.showResults === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(block.status)}`}
                      >
                        {block.status}
                      </div>
                    </div>

                    <AllEntriesTable entries={block.showEntries} />

                    <ResultSection
                      title={`${block.breed.name}, Dogs`}
                      results={block.showResults.filter(
                        (result) => result.dog.sex === "M"
                      )}
                      awardGroups={["DOG_CLASS", "WINNERS"]}
                    />
                    <ResultSection
                      title={`${block.breed.name}, Bitches`}
                      results={block.showResults.filter(
                        (result) => result.dog.sex === "F"
                      )}
                      awardGroups={["BITCH_CLASS", "WINNERS"]}
                    />
                    <ResultSection
                      title={`${block.breed.name}, Best of Breed Competition`}
                      results={block.showResults}
                      awardGroups={["BREED"]}
                    />
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
