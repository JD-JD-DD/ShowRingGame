import Link from "next/link";

import { db } from "@/lib/db";
import {
  getKennelPrestigeLeaderboard,
  type KennelPrestigeLeaderboardRow,
} from "@/server/services/kennelPrestige.service";
import { CURRENT_BREED_RELEASE } from "@showring/rules";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    breed?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildBreedHref(breedCode2: string): string {
  const params = new URLSearchParams();

  if (breedCode2) {
    params.set("breed", breedCode2);
  }

  return `/kennels/top-ten${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function LeaderboardTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: KennelPrestigeLeaderboardRow[];
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-purple-100/70">
          {description}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-6 text-sm text-purple-100/70">
          No kennel prestige has been earned here yet.
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {rows.map((row) => (
            <Link
              key={`${title}:${row.kennel.id}`}
              href={`/kennels/${row.kennel.slug}`}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem] gap-4 px-6 py-4 text-sm transition hover:bg-white/5 md:grid-cols-[4rem_minmax(0,1fr)_9rem_8rem]"
            >
              <div className="self-center text-2xl font-black text-fuchsia-100">
                #{row.rank}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold text-white">
                  {row.kennel.name}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100/70">
                  {row.prestige.tier.label}
                </div>
              </div>
              <div className="self-center text-right">
                <div className="text-xs uppercase tracking-[0.16em] text-purple-100/55">
                  Score
                </div>
                <div className="text-xl font-bold text-white">
                  {row.prestige.score.toLocaleString()}
                </div>
              </div>
              <div className="hidden self-center text-right text-xs text-purple-100/65 md:block">
                {row.prestige.metrics.championsBred} bred CH
                <br />
                {row.prestige.metrics.bestInShowWins} BIS
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function KennelTopTenPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const breedQuery = firstQueryValue(resolvedSearchParams.breed)
    ?.trim()
    .toUpperCase();
  const breeds = await db.breed.findMany({
    where: {
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    select: {
      code2: true,
      name: true,
      groupName: true,
    },
  });
  const selectedBreed =
    breeds.find((breed) => breed.code2 === breedQuery) ?? null;
  const overallRows = await getKennelPrestigeLeaderboard({ take: 10 });
  const breedRows = selectedBreed
    ? await getKennelPrestigeLeaderboard({
        breedCode2: selectedBreed.code2,
        take: 10,
      })
    : [];

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-fuchsia-200/80">
                Kennel Prestige
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
                Kennel Top Ten
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
                Compare kennels by overall prestige and by breed-specific
                prestige earned through champions, show wins, Top Ten standing,
                and health-tested excellence.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                My Kennel
              </Link>
              <Link
                href="/shows/top-ten"
                className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
              >
                Dog Top Ten
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-[28px] border border-fuchsia-300/15 bg-fuchsia-500/10 px-6 py-5">
          <form className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label
                htmlFor="breed"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100/75"
              >
                Breed Top Ten
              </label>
              <select
                id="breed"
                name="breed"
                defaultValue={selectedBreed?.code2 ?? ""}
                className="w-full rounded-2xl border border-purple-300/20 bg-black/25 px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">Choose a breed</option>
                {breeds.map((breed) => (
                  <option key={breed.code2} value={breed.code2}>
                    {breed.name}
                    {breed.groupName ? ` - ${breed.groupName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
            >
              View Breed
            </button>
          </form>
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <LeaderboardTable
            title="Top Ten Overall"
            description="All-breed kennel prestige across the whole show game."
            rows={overallRows}
          />
          {selectedBreed ? (
            <LeaderboardTable
              title={`${selectedBreed.name} Top Ten`}
              description={`Kennel prestige earned specifically through ${selectedBreed.name}s.`}
              rows={breedRows}
            />
          ) : (
            <section className="overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="text-2xl font-bold text-white">
                  Breed Top Ten
                </h2>
                <p className="mt-2 text-sm leading-6 text-purple-100/70">
                  Choose a breed above to view breed-specific kennel prestige
                  rankings.
                </p>
              </div>
              <div className="px-6 py-6 text-sm text-purple-100/70">
                Select a breed to load that breed&apos;s kennel rankings.
              </div>
            </section>
          )}
        </div>

        {selectedBreed ? (
          <div className="mt-6 text-center text-xs text-purple-100/55">
            Direct link:{" "}
            <Link
              href={buildBreedHref(selectedBreed.code2)}
              className="text-fuchsia-100 hover:text-white"
            >
              {buildBreedHref(selectedBreed.code2)}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
