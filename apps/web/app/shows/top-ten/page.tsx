import Link from "next/link";

import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";
import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getCurrentEpoch } from "@/lib/gameClock";
import { SHOW_YEAR_HOURS } from "@showring/rules";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    year?: string | string[];
    breed?: string | string[];
    allTimeBreed?: string | string[];
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

function rankRows<T extends { dogId: string }>(
  rows: T[]
): Array<T & { rank: number }> {
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}

function buildTopTenHref({
  year,
  breed,
  allTimeBreed,
}: {
  year: number;
  breed?: string | null;
  allTimeBreed?: string | null;
}): string {
  const params = new URLSearchParams({ year: `${year}` });

  if (breed) params.set("breed", breed);
  if (allTimeBreed) params.set("allTimeBreed", allTimeBreed);

  return `/shows/top-ten?${params.toString()}`;
}

type AllTimePrestigeTotal = {
  dogId: string;
  breedCode2: string;
  _sum: {
    breedDogsBeaten: number | null;
    allBreedDogsBeaten: number | null;
    breedWinCount: number | null;
    groupWinCount: number | null;
    bestInShowWinCount: number | null;
    reserveBisCount: number | null;
  };
};

export default async function ShowTopTenPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const fallbackYear = Math.floor(getCurrentEpoch() / SHOW_YEAR_HOURS) + 1;
  const selectedYear = parseYear(
    firstQueryValue(resolvedSearchParams.year),
    fallbackYear
  );
  const breedQuery = firstQueryValue(resolvedSearchParams.breed)?.toUpperCase();
  const allTimeBreedQuery = firstQueryValue(
    resolvedSearchParams.allTimeBreed
  )?.toUpperCase();
  const [years, breedOptions, allTimeBreedOptions] = await Promise.all([
    db.dogYearlyPrestigeStat.findMany({
      distinct: ["gameYear"],
      orderBy: [{ gameYear: "desc" }],
      select: {
        gameYear: true,
      },
    }),
    db.dogYearlyPrestigeStat.findMany({
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
                groupName: true,
              },
            },
          },
        },
      },
    }),
    db.dogYearlyPrestigeStat.findMany({
      where: {
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
                groupName: true,
              },
            },
          },
        },
      },
    }),
  ]);
  const selectedBreedCode =
    breedOptions.some((option) => option.breedCode2 === breedQuery)
      ? breedQuery ?? null
      : null;
  const selectedAllTimeBreedCode =
    allTimeBreedOptions.some(
      (option) => option.breedCode2 === allTimeBreedQuery
    )
      ? allTimeBreedQuery ?? null
      : null;
  const yearOptions = [
    ...new Set([fallbackYear, ...years.map((year) => year.gameYear)]),
  ].sort((a, b) => b - a);
  const currentYearBreedSelectOptions = breedOptions.map((option) => ({
    code2: option.breedCode2,
    name: option.dog.breed.name,
    groupName: option.dog.breed.groupName,
  }));
  const allTimeBreedSelectOptions = allTimeBreedOptions.map((option) => ({
    code2: option.breedCode2,
    name: option.dog.breed.name,
    groupName: option.dog.breed.groupName,
  }));
  const [
    allBreedRows,
    breedRows,
    allTimeAllBreedTotals,
    allTimeBreedTotals,
  ] = await Promise.all([
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
    db.dogYearlyPrestigeStat.groupBy({
      by: ["dogId", "breedCode2"],
      where: {
        allBreedDogsBeaten: {
          gt: 0,
        },
      },
      _sum: {
        breedDogsBeaten: true,
        allBreedDogsBeaten: true,
        breedWinCount: true,
        groupWinCount: true,
        bestInShowWinCount: true,
        reserveBisCount: true,
      },
      orderBy: [
        { _sum: { allBreedDogsBeaten: "desc" } },
        { _sum: { bestInShowWinCount: "desc" } },
        { _sum: { groupWinCount: "desc" } },
        { _sum: { breedDogsBeaten: "desc" } },
      ],
      take: 10,
    }),
    selectedAllTimeBreedCode
      ? db.dogYearlyPrestigeStat.groupBy({
          by: ["dogId", "breedCode2"],
          where: {
            breedCode2: selectedAllTimeBreedCode,
            breedDogsBeaten: {
              gt: 0,
            },
          },
          _sum: {
            breedDogsBeaten: true,
            allBreedDogsBeaten: true,
            breedWinCount: true,
            groupWinCount: true,
            bestInShowWinCount: true,
            reserveBisCount: true,
          },
          orderBy: [
            { _sum: { breedDogsBeaten: "desc" } },
            { _sum: { breedWinCount: "desc" } },
            { _sum: { allBreedDogsBeaten: "desc" } },
          ],
          take: 10,
        })
      : Promise.resolve([]),
  ]);
  const selectedBreedName =
    breedOptions.find((option) => option.breedCode2 === selectedBreedCode)?.dog
      .breed.name ??
    breedRows[0]?.dog.breed.name ??
    selectedBreedCode;
  const allTimeDogIds = [
    ...new Set(
      [...allTimeAllBreedTotals, ...allTimeBreedTotals].map((row) => row.dogId)
    ),
  ];
  const allTimeDogs = await db.dog.findMany({
    where: {
      id: {
        in: allTimeDogIds,
      },
      isPlayerVisible: true,
    },
    include: {
      breed: true,
      ownerKennel: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });
  const allTimeDogsById = new Map(allTimeDogs.map((dog) => [dog.id, dog]));
  const buildAllTimeRows = (rows: AllTimePrestigeTotal[]) =>
    rows.flatMap((row) => {
      const dog = allTimeDogsById.get(row.dogId);
      if (!dog) return [];

      return [
        {
          dogId: row.dogId,
          breedCode2: row.breedCode2,
          breedDogsBeaten: row._sum.breedDogsBeaten ?? 0,
          allBreedDogsBeaten: row._sum.allBreedDogsBeaten ?? 0,
          breedWinCount: row._sum.breedWinCount ?? 0,
          groupWinCount: row._sum.groupWinCount ?? 0,
          bestInShowWinCount: row._sum.bestInShowWinCount ?? 0,
          reserveBisCount: row._sum.reserveBisCount ?? 0,
          dog,
        },
      ];
    });
  const allTimeAllBreedRows = buildAllTimeRows(allTimeAllBreedTotals);
  const allTimeBreedRows = buildAllTimeRows(allTimeBreedTotals);
  const selectedAllTimeBreedName =
    allTimeBreedOptions.find(
      (option) => option.breedCode2 === selectedAllTimeBreedCode
    )?.dog.breed.name ??
    allTimeBreedRows[0]?.dog.breed.name ??
    selectedAllTimeBreedCode;

  return (
    <main className="rankings-page mx-auto max-w-7xl px-6 py-8">
      <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
              Prestige Rankings
            </p>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              Top Ten
            </h1>
            <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
              Yearly dogs-beaten standings for all-breed wins and breed
              competition. Deceased dogs stay ranked until another dog passes
              them or the game year rolls over.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={buildTopTenHref({
                year: selectedYear,
                breed: selectedBreedCode,
                allTimeBreed: selectedAllTimeBreedCode,
              })}
              className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
            >
              Refresh Standings
            </a>
            <Link
              href="/shows"
              className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
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

      <section className="mb-6 flex flex-wrap gap-3 rounded-[24px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
            Year
          </span>
          {yearOptions.map((year) => (
            <Link
              key={year}
              href={buildTopTenHref({
                year,
                breed: selectedBreedCode,
                allTimeBreed: selectedAllTimeBreedCode,
              })}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                year === selectedYear
                  ? "border-[var(--dog-border)] bg-purple-600 text-white"
                  : "border-[var(--dog-border)] bg-[var(--dog-card)] text-[var(--dog-heading)] hover:bg-[var(--dog-card)]"
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
          <section className="rounded-[24px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
              Breed
            </div>
            {breedOptions.length === 0 ? (
              <p className="text-sm text-[var(--dog-copy)]">
                No breed standings have been recorded for Year {selectedYear}.
              </p>
            ) : (
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <input type="hidden" name="year" value={selectedYear} />
                {selectedAllTimeBreedCode ? (
                  <input
                    type="hidden"
                    name="allTimeBreed"
                    value={selectedAllTimeBreedCode}
                  />
                ) : null}
                <div>
                  <label
                    htmlFor="breed"
                    className="mb-1 block text-xs uppercase tracking-wide text-[var(--dog-copy)]"
                  >
                    Breed
                  </label>
                  <select
                    id="breed"
                    name="breed"
                    defaultValue={selectedBreedCode ?? ""}
                    className="w-full rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="">Choose a breed...</option>
                    <BreedSelectOptions options={currentYearBreedSelectOptions} />
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
                    href={buildTopTenHref({
                      year: selectedYear,
                      allTimeBreed: selectedAllTimeBreedCode,
                    })}
                    className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
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

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <RankingPanel
          title="All-Time All-Breed Top Ten"
          subtitle="Career totals across all recorded years"
          metricLabel="All-Breed Dogs Beaten"
          rows={rankRows(allTimeAllBreedRows)}
          getMetric={(row) => row.allBreedDogsBeaten}
        />

        <div className="grid gap-4">
          <section className="rounded-[24px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
              All-Time Breed
            </div>
            {allTimeBreedOptions.length === 0 ? (
              <p className="text-sm text-[var(--dog-copy)]">
                No all-time breed standings have been recorded yet.
              </p>
            ) : (
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
                <input type="hidden" name="year" value={selectedYear} />
                {selectedBreedCode ? (
                  <input type="hidden" name="breed" value={selectedBreedCode} />
                ) : null}
                <div>
                  <label
                    htmlFor="allTimeBreed"
                    className="mb-1 block text-xs uppercase tracking-wide text-[var(--dog-copy)]"
                  >
                    Breed
                  </label>
                  <select
                    id="allTimeBreed"
                    name="allTimeBreed"
                    defaultValue={selectedAllTimeBreedCode ?? ""}
                    className="w-full rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="">Choose a breed...</option>
                    <BreedSelectOptions options={allTimeBreedSelectOptions} />
                  </select>
                </div>

                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  View Breed
                </button>

                {selectedAllTimeBreedCode ? (
                  <Link
                    href={buildTopTenHref({
                      year: selectedYear,
                      breed: selectedBreedCode,
                    })}
                    className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
            )}
          </section>

          {selectedAllTimeBreedCode && selectedAllTimeBreedName ? (
            <RankingPanel
              title={`All-Time ${selectedAllTimeBreedName} Top Ten`}
              subtitle="Career totals across all recorded years"
              metricLabel="Breed Dogs Beaten"
              rows={rankRows(allTimeBreedRows)}
              getMetric={(row) => row.breedDogsBeaten}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function RankingPanel<
  T extends {
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
  },
>({
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
    <section className="overflow-hidden rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-panel)] shadow-[var(--dog-shadow)]">
      <div className="border-b border-[var(--dog-border)] px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-[var(--dog-copy)]">{subtitle}</p>
          </div>
          <div className="rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1 text-xs font-semibold text-[var(--dog-heading)]">
            {metricLabel}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-[var(--dog-copy)]">
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
                <div className="self-center text-2xl font-semibold text-[var(--dog-heading)]">
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
                      <span className="rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--dog-copy)]">
                        {status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-[var(--dog-copy)]">
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
                  <div className="mt-2 flex flex-wrap gap-2 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--dog-copy)]">
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
