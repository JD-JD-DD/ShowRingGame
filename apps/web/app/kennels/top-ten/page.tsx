import Link from "next/link";

import { dateToEpoch, epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { createPerfTimer } from "@/lib/perf";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";
import { getReleasedBreedsGroupedByCanonicalShowGroup } from "@/server/services/breed.service";
import { getCurrentPublishedBreedKennelPrestigeLeaderboardState, listCurrentPublishedBreedKennelPrestigeLeaderboardEntries } from "@/server/services/breedKennelPrestigeLeaderboard.service";
import {
  getCurrentKennelPrestigeLeaderboardState,
  listCurrentKennelPrestigeLeaderboardEntries,
} from "@/server/services/kennelPrestigeLeaderboard.service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    breed?: string | string[];
  }>;
};

type PublishedOverallLeaderboardRow = {
  rank: number;
  kennelId: string;
  kennelName: string;
  kennelSlug: string;
  prestigeScore: number;
  tierLabel: string;
  championsBred: number;
  bestInShowWins: number;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function LeaderboardTable({ rows, title = "Top Ten Overall", description = "All-breed kennel prestige across the whole show game.", empty = "No kennel prestige has been earned here yet." }: { rows: PublishedOverallLeaderboardRow[]; title?: string; description?: string; empty?: string }) {
  return (
    <section className="theme-panel overflow-hidden rounded-[28px]">
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        <h2 className="theme-heading text-2xl font-bold">{title}</h2>
        <p className="theme-copy mt-2 text-sm leading-6">
          {description}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="theme-copy px-6 py-6 text-sm">
          {empty}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {rows.map((row) => (
            <Link
              key={row.kennelId}
              href={`/kennels/${row.kennelSlug}`}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem] gap-4 px-6 py-4 text-sm transition hover:bg-[var(--color-surface-subtle)] md:grid-cols-[4rem_minmax(0,1fr)_9rem_8rem]"
            >
              <div className="self-center text-2xl font-black text-fuchsia-100">
                #{row.rank}
              </div>
              <div className="min-w-0">
                <div className="theme-heading truncate text-lg font-bold">
                  {row.kennelName}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100/70">
                  {row.tierLabel}
                </div>
              </div>
              <div className="self-center text-right">
                <div className="theme-copy text-xs uppercase tracking-[0.16em]">
                  Score
                </div>
                <div className="theme-heading text-xl font-bold">
                  {row.prestigeScore.toLocaleString()}
                </div>
              </div>
              <div className="theme-copy hidden self-center text-right text-xs md:block">
                {row.championsBred} bred CH
                <br />
                {row.bestInShowWins} BIS
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function KennelTopTenPage({ searchParams }: PageProps) {
  const perf = createPerfTimer({ route: "/kennels/top-ten" });
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const breedQuery = firstQueryValue(resolvedSearchParams.breed)
    ?.trim()
    .toUpperCase();
  const groups = await getReleasedBreedsGroupedByCanonicalShowGroup();
  const breeds = groups.flatMap((group) => group.breeds);
  const selectedBreed = breedQuery ? breeds.find((breed) => breed.code2 === breedQuery) ?? null : null;
  const invalidBreed = Boolean(breedQuery && !selectedBreed);
  const [state, entries] = selectedBreed ? [null, []] : await perf.measure("publishedSnapshotReadMs", () =>
    Promise.all([
      getCurrentKennelPrestigeLeaderboardState(),
      listCurrentKennelPrestigeLeaderboardEntries({ scope: "OVERALL" }),
    ])
  );
  const hasPublishedSnapshot =
    state?.lastCalculatedAt != null && state.lastCalculatedEpoch != null;
  const overallRows: PublishedOverallLeaderboardRow[] = entries.map((entry) => ({
    rank: entry.rank,
    kennelId: entry.kennelId,
    kennelName: entry.kennelName,
    kennelSlug: entry.kennelSlug,
    prestigeScore: entry.prestigeScore,
    tierLabel: entry.tierLabel,
    championsBred: entry.championsBred,
    bestInShowWins: entry.bestInShowWins,
  }));
  const nextUpdateIsPending =
    !state?.nextRefreshAt ||
    state.nextRefreshAt.getTime() <= epochToDate(getCurrentEpoch()).getTime();
  const lastCalculatedGameTime = state && state.lastCalculatedEpoch !== null
    ? formatShowCalendarLabel(state.lastCalculatedEpoch!)
    : null;
  const nextUpdateGameTime =
    state?.nextRefreshAt && !nextUpdateIsPending
      ? formatShowCalendarLabel(dateToEpoch(state.nextRefreshAt))
      : null;
  const [breedState, breedEntries] = selectedBreed
    ? await perf.measure("breedPublishedSnapshotReadMs", () => Promise.all([
      getCurrentPublishedBreedKennelPrestigeLeaderboardState(),
      listCurrentPublishedBreedKennelPrestigeLeaderboardEntries({ breedCode2: selectedBreed.code2 }),
    ]))
    : [null, []];
  const breedRows: PublishedOverallLeaderboardRow[] = breedEntries;
  const breedPublished = Boolean(breedState?.publishedGenerationId);
  const breedLastUpdated = breedState?.publishedAt ? formatShowCalendarLabel(dateToEpoch(breedState.publishedAt)) : null;
  const breedNextUpdate = breedState?.nextRefreshAt ? formatShowCalendarLabel(dateToEpoch(breedState.nextRefreshAt)) : null;

  perf.log({
    publishedSnapshotExists: hasPublishedSnapshot,
    overallLeaderboardRowCount: overallRows.length,
    breedFilterRequested: Boolean(breedQuery),
    requestedRankingScope: selectedBreed ? "breed" : "overall",
    breedPublishedSnapshotExists: breedPublished,
    breedLeaderboardRowCount: breedRows.length,
  });

  return (
    <main className="rankings-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="theme-panel mb-8 rounded-[28px] px-6 py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="theme-label text-sm uppercase tracking-[0.25em]">
                Kennel Prestige
              </p>
              <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
                Kennel Top Ten
              </h1>
              <p className="theme-copy mt-4 max-w-3xl text-sm leading-7">
                Compare kennels by overall prestige earned through champions,
                show wins, Top Ten standing, and health-tested excellence.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/shows/top-ten"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Dog Top Ten
              </Link>
            </div>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-2">
          <div className="grid gap-4">
            {selectedBreed ? (breedPublished ? <><LeaderboardTable rows={breedRows} title={`Top Ten ${selectedBreed.name}`} description="Published breed-specific kennel prestige standings." empty={`No kennel prestige has been earned for ${selectedBreed.name} yet.`} /><section className="theme-card rounded-[24px] p-4" aria-live="polite"><div className="theme-copy text-xs leading-6"><div>Last updated: {breedLastUpdated ?? "Pending"}</div><div>Next refresh begins: {breedNextUpdate ?? "Pending"}</div></div></section></> : <section className="theme-panel overflow-hidden rounded-[28px]" aria-live="polite"><div className="theme-copy px-6 py-6 text-sm">Breed-specific rankings are being prepared. Please check back after the first update.</div></section>) : invalidBreed ? <section className="theme-panel overflow-hidden rounded-[28px]" role="status"><div className="theme-copy px-6 py-6 text-sm">The selected breed is unavailable. Showing Overall standings.</div></section> : hasPublishedSnapshot ? <LeaderboardTable rows={overallRows} /> : (
              <section className="theme-panel overflow-hidden rounded-[28px]" aria-live="polite">
                <div className="border-b border-[var(--color-border)] px-6 py-5">
                  <h2 className="theme-heading text-2xl font-bold">Top Ten Overall</h2>
                </div>
                <div className="theme-copy px-6 py-6 text-sm">
                  Rankings are being prepared. Please check back after the next update.
                </div>
              </section>
            )}

            {hasPublishedSnapshot ? (
              <section className="theme-card rounded-[24px] p-4" aria-live="polite">
                <div className="theme-copy text-xs leading-6">
                  <div>
                    Last calculated: {lastCalculatedGameTime}
                  </div>
                  <div>
                    {nextUpdateIsPending
                      ? "Next update: Pending"
                      : `Next update due: ${nextUpdateGameTime}`}
                  </div>
                  {state?.refreshClaimToken ? <div>Updating rankings in the background.</div> : null}
                </div>
              </section>
            ) : null}
          </div>

          <div className="grid gap-4">
            <section className="theme-card rounded-[24px] p-4">
              <div className="theme-label mb-3 text-xs font-semibold uppercase tracking-[0.18em]">
                Breed
              </div>
              <form action="/kennels/top-ten" method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <label
                    htmlFor="breed"
                    className="theme-copy mb-1 block text-xs uppercase tracking-wide"
                  >
                    Breed
                  </label>
                  <select
                    id="breed"
                    name="breed"
                    defaultValue={selectedBreed?.code2 ?? ""}
                    className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="">Overall</option>{groups.flatMap((group) => group.breeds).map((breed) => <option key={breed.code2} value={breed.code2}>{breed.name}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  className="theme-primary-button rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  View rankings
                </button>
              </form>
              <p id="breed-ranking-status" className="theme-copy mt-3 text-sm leading-6">
                {selectedBreed ? `Showing ${selectedBreed.name} standings.` : "Choose a breed or return to Overall standings."}
              </p>
              {invalidBreed ? (
                <p className="theme-copy mt-2 text-sm leading-6" role="status">
                  Showing Overall standings.
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
