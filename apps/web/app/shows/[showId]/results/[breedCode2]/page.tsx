import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { publishReadyBreedResultsForCluster } from "@/server/services/judging.service";

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
  AOM: 10,
};

function formatShowDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString();
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

type ResultRow = {
  id: string;
  finalRank: number | null;
  publishedAtEpoch: number;
  dog: {
    id: string;
    registeredName: string | null;
    callName: string | null;
    regNumber: string;
    sex: "M" | "F";
  };
  showEntry: {
    kennel: {
      name: string;
      slug: string;
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
      <h3 className="text-lg font-semibold text-sky-100">{title}</h3>
      <div className="mt-3 overflow-x-auto">
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
            {sectionResults.map((result) => {
              const awards = getSectionAwards(result, awardGroups);

              return (
                <tr
                  key={`${title}-${result.id}`}
                  className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <div className="flex min-w-24 flex-wrap gap-2">
                      {awards.map((award) => (
                        <span
                          key={`${result.id}-${award.awardCode}-${award.awardGroup}`}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 font-semibold text-sky-100"
                        >
                          <span>{award.awardCode}</span>
                          {award.pointsAwarded > 0 ? (
                            <span className="font-bold text-white">
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
  await publishReadyBreedResultsForCluster({
    showId,
    breedCode2: normalizedBreedCode,
    currentEpoch: getCurrentEpoch(),
  });

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
              _count: { select: { showEntries: true, showResults: true } },
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
  const firstBlock = enteredBlocks[0] ?? blocks[0];

  if (!firstBlock) {
    notFound();
  }

  const resultCount = enteredBlocks.reduce(
    (total, block) => total + block._count.showResults,
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
          Breed Results
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          {cluster.name}
        </h1>
        <p className="mt-4 text-2xl font-semibold text-purple-100">
          {formatShowDate(cluster.startEpoch)}
        </p>
        <h2 className="mt-8 text-2xl font-bold uppercase tracking-[0.08em] text-white">
          {firstBlock.breed.name}
        </h2>
        <p className="mt-2 text-lg font-semibold text-purple-100">
          Judge:{" "}
          <Link
            href={`/judges/${firstBlock.judge.judgeCode}`}
            className="text-white underline-offset-4 hover:underline"
          >
            {firstBlock.judge.name}
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/shows/${cluster.id}/results`}
            className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Breed List
          </Link>
          <Link
            href={`/shows/${cluster.id}`}
            className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Show Detail
          </Link>
          <Link
            href="/shows"
            className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            All Shows
          </Link>
        </div>
      </section>

      {enteredBlocks.length === 0 ? (
        <section className="mt-6 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          This breed had no entries in this show.
        </section>
      ) : resultCount === 0 ? (
        <section className="mt-6 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 text-sm text-purple-100/75">
          Results have not been published for this breed yet.
        </section>
      ) : (
        <div className="mt-6 grid gap-6">
          {enteredBlocks.map((block) => (
            <section
              key={block.id}
              className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-purple-200/70">
                    Ring {block.ringNumber}
                    {block.ringName ? ` - ${block.ringName}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-purple-100/65">
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
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
