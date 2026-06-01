import Link from "next/link";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { SHOW_YEAR_HOURS } from "@showring/rules";

type PageProps = {
  searchParams?: Promise<{
    year?: string | string[];
    breed?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseYear(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatStatus(state: string): string | null {
  return state === "DECEASED" ? "Deceased" : null;
}

function rankRows<T extends { dogId: string }>(rows: T[]): Array<T & { rank: number }> {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

export default async function ShowTopTenPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const fallbackYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const selectedYear = parseYear(
    firstQueryValue(resolvedSearchParams.year),
    fallbackYear
  );
  const breedQuery = firstQueryValue(resolvedSearchParams.breed)?.toUpperCase();
  const years = await db.dogYearlyPrestigeStat.findMany({
    distinct: ["gameYear"],
    orderBy: [{ gameYear: "desc" }],
    select: {
      gameYear: true,
    },
  });
  const breedOptions = await db.dogYearlyPrestigeStat.findMany({
    where: {
      gameYear: selectedYear,
      breedDogsBeaten: {
        gt: 0,
      },
    },
    distinct: ["breedCode2"],
    orderBy: [{ breedCode2: "asc" }],
    select: {
      breedCode2: true,
      dog: {
        select: {
          breed: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
  const selectedBreedCode =
    breedOptions.some((option) => option.breedCode2 === breedQuery)
      ? breedQuery ?? null
      : null;
  const yearOptions = [
    ...new Set([fallbackYear, ...years.map((year) => year.gameYear)]),
  ].sort((a, b) => b - a);
  const [allBreedRows, breedRows] = await Promise.all([
    db.dogYearlyPrestigeStat.findMany({
      where: {
        gameYear: selectedYear,
        allBreedDogsBeaten: {
          gt: 0,
        },
      },
      orderBy: [
        { allBreedDogsBeaten: "desc" },
        { bestInShowWinCount: "desc" },
        { groupWinCount: "desc" },
        { breedDogsBeaten: "desc" },
      ],
      take: 10,
      include: {
        dog: {
          include: {
            breed: true,
            ownerKennel: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    }),
    selectedBreedCode
      ? db.dogYearlyPrestigeStat.findMany({
          where: {
            gameYear: selectedYear,
            breedCode2: selectedBreedCode,
            breedDogsBeaten: {
              gt: 0,
            },
          },
          orderBy: [
            { breedDogsBeaten: "desc" },
            { breedWinCount: "desc" },
            { allBreedDogsBeaten: "desc" },
          ],
          take: 10,
          include: {
            dog: {
              include: {
                breed: true,
                ownerKennel: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const selectedBreedName =
    breedOptions.find((option) => option.breedCode2 === selectedBreedCode)?.dog
      .breed.name ??
    breedRows[0]?.dog.breed.name ??
    selectedBreedCode;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-purple-300/80">
              Prestige Rankings
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Top Ten
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Yearly dogs-beaten standings for all-breed wins and breed
              competition. Deceased dogs stay ranked until another dog passes
              them or the game year rolls over.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Show Calendar
            </Link>
            <Link
              href="/kennel"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              My Kennel
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-6 flex flex-wrap gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
            Year
          </span>
          {yearOptions.map((year) => (
            <Link
              key={year}
              href={`/shows/top-ten?year=${year}${
                selectedBreedCode ? `&breed=${selectedBreedCode}` : ""
              }`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                year === selectedYear
                  ? "border-purple-300/40 bg-purple-600 text-white"
                  : "border-purple-300/20 bg-black/20 text-purple-100 hover:bg-white/10"
              }`}
            >
              Year {year}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RankingPanel
          title="All-Breed Top Ten"
          subtitle={`Year ${selectedYear}`}
          metricLabel="All-Breed Dogs Beaten"
          rows={rankRows(allBreedRows)}
          getMetric={(row) => row.allBreedDogsBeaten}
        />

        <div className="grid gap-4">
          <section className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
              Breed
            </div>
            {breedOptions.length === 0 ? (
              <p className="text-sm text-purple-100/70">
                No breed standings have been recorded for Year {selectedYear}.
              </p>
            ) : (
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <input type="hidden" name="year" value={selectedYear} />
                <div>
                  <label
                    htmlFor="breed"
                    className="mb-1 block text-xs uppercase tracking-wide text-purple-100/60"
                  >
                    Breed
                  </label>
                  <select
                    id="breed"
                    name="breed"
                    defaultValue={selectedBreedCode ?? ""}
                    className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="">Choose a breed...</option>
                    {breedOptions.map((option) => (
                      <option key={option.breedCode2} value={option.breedCode2}>
                        {option.dog.breed.name} ({option.breedCode2})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  View Breed
                </button>

                {selectedBreedCode ? (
                  <Link
                    href={`/shows/top-ten?year=${selectedYear}`}
                    className="rounded-xl border border-purple-300/25 bg-white/5 px-5 py-2.5 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
            )}
          </section>

          {selectedBreedCode && selectedBreedName ? (
            <RankingPanel
              title={`${selectedBreedName} Top Ten`}
              subtitle={`Year ${selectedYear}`}
              metricLabel="Breed Dogs Beaten"
              rows={rankRows(breedRows)}
              getMetric={(row) => row.breedDogsBeaten}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function RankingPanel<T extends {
  rank: number;
  dogId: string;
  breedDogsBeaten: number;
  allBreedDogsBeaten: number;
  breedWinCount: number;
  groupWinCount: number;
  bestInShowWinCount: number;
  reserveBisCount: number;
  dog: {
    id: string;
    lifecycleState: string;
    callName: string | null;
    registeredName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
    breed: {
      name: string;
      code2: string;
    };
    ownerKennel: {
      name: string;
      slug: string;
    } | null;
  };
}>({
  title,
  subtitle,
  metricLabel,
  rows,
  getMetric,
}: {
  title: string;
  subtitle: string;
  metricLabel: string;
  rows: T[];
  getMetric: (row: T) => number;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-purple-100/60">{subtitle}</p>
          </div>
          <div className="rounded-full border border-purple-300/20 bg-black/20 px-3 py-1 text-xs font-semibold text-purple-100">
            {metricLabel}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-purple-100/70">
          No standings have been recorded yet.
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {rows.map((row) => {
            const status = formatStatus(row.dog.lifecycleState);

            return (
              <div
                key={row.dogId}
                className="grid grid-cols-[3rem_minmax(0,1fr)_6rem] gap-4 px-5 py-3 text-sm"
              >
                <div className="self-center text-2xl font-semibold text-purple-100">
                  {row.rank}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dogs/${row.dog.id}`}
                      className="truncate font-semibold text-white underline-offset-4 hover:underline"
                    >
                      {formatDogDisplayName(row.dog)}
                    </Link>
                    {status ? (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-purple-100/70">
                        {status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-purple-100/58">
                    {row.dog.breed.name} ({row.dog.breed.code2})
                    {row.dog.ownerKennel ? (
                      <>
                        {" "}
                        -{" "}
                        <Link
                          href={`/kennels/${row.dog.ownerKennel.slug}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {row.dog.ownerKennel.name}
                        </Link>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[0.68rem] font-semibold uppercase tracking-wide text-purple-100/70">
                    {row.breedWinCount > 0 ? (
                      <span>BOB {row.breedWinCount}</span>
                    ) : null}
                    {row.groupWinCount > 0 ? (
                      <span>G1 {row.groupWinCount}</span>
                    ) : null}
                    {row.bestInShowWinCount > 0 ? (
                      <span>BIS {row.bestInShowWinCount}</span>
                    ) : null}
                    {row.reserveBisCount > 0 ? (
                      <span>RBIS {row.reserveBisCount}</span>
                    ) : null}
                  </div>
                </div>
                <div className="self-center text-right text-2xl font-semibold text-white">
                  {getMetric(row).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
