import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getKennelPrestigeSummary } from "@/server/services/kennelPrestige.service";

export default async function KennelPrestigePage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const prestige = await getKennelPrestigeSummary(kennel.id);
  const topTenTotal =
    prestige.metrics.currentBreedTopTenOwned +
    prestige.metrics.currentBreedTopTenBred +
    prestige.metrics.currentAllBreedTopTenOwned +
    prestige.metrics.currentAllBreedTopTenBred;
  const grandChampionTotal =
    prestige.metrics.grandChampionsCompletedOwnerHandled +
    prestige.metrics.grandChampionsCompletedWithHandler +
    prestige.metrics.grandChampionsCompletedHandlingUnknown;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="theme-label text-xs font-bold uppercase tracking-[0.2em]">
                Kennel Prestige
              </p>
              <Link
                href="/faq#kennel-prestige"
                aria-label="How is kennel prestige calculated?"
                className="theme-secondary-button inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              >
                ?
              </Link>
            </div>
            <h1 className="theme-heading mt-2 text-4xl font-bold tracking-tight">
              {prestige.tier.label}
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              Prestige rewards {kennel.name}&apos;s long-term show identity:
              champions bred, champions finished, Grand Champion achievements,
              major show wins, Top Ten standing, and health-tested excellence.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/kennels/top-ten"
                className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Kennel Top Ten
              </Link>
            </div>
          </div>

          <div className="theme-card rounded-3xl px-6 py-5 text-right">
            <div className="theme-label text-xs uppercase tracking-[0.18em]">
              Score
            </div>
            <div className="theme-heading mt-1 text-4xl font-black">
              {prestige.score.toLocaleString()}
            </div>
            {prestige.tier.nextScore ? (
              <div className="theme-copy mt-2 text-xs">
                {prestige.tier.nextScore - prestige.score} to{" "}
                {prestige.tier.nextLabel}
              </div>
            ) : (
              <div className="theme-copy mt-2 text-xs">
                Highest prestige tier
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            ["Breeding", prestige.categories.breeding],
            ["Show", prestige.categories.show],
            ["Legacy", prestige.categories.legacy],
            ["Care", prestige.categories.care],
          ].map(([label, value]) => (
            <div
              key={label}
              className="theme-card rounded-2xl px-4 py-3"
            >
              <div className="theme-copy text-xs uppercase tracking-[0.16em]">
                {label}
              </div>
              <div className="theme-heading mt-1 text-xl font-bold">
                {Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div className="theme-card rounded-2xl p-4">
            <div className="theme-copy text-xs uppercase tracking-[0.16em]">
              Champions Bred
            </div>
            <div className="theme-heading mt-1 text-2xl font-bold">
              {prestige.metrics.championsBred}
            </div>
            <div className="theme-copy mt-1">
              {prestige.metrics.championProducingLitters} champion-producing
              litters
            </div>
          </div>

          <div className="theme-card rounded-2xl p-4">
            <div className="theme-copy text-xs uppercase tracking-[0.16em]">
              Champions Finished
            </div>
            <div className="theme-heading mt-1 text-2xl font-bold">
              {prestige.metrics.championsFinishedOwnerHandled +
                prestige.metrics.championsFinishedWithHandler}
            </div>
            <div className="theme-copy mt-1">
              {prestige.metrics.championsFinishedOwnerHandled} owner-handled,{" "}
              {prestige.metrics.championsFinishedWithHandler} with handler
            </div>
          </div>

          <div className="theme-card rounded-2xl p-4">
            <div className="theme-copy text-xs uppercase tracking-[0.16em]">
              Grand Champions
            </div>
            <div className="theme-heading mt-1 text-2xl font-bold">
              {grandChampionTotal}
            </div>
            <div className="theme-copy mt-1">
              {prestige.metrics.grandChampionMilestoneTitles} milestone
              credits
            </div>
          </div>

          <div className="theme-card rounded-2xl p-4">
            <div className="theme-copy text-xs uppercase tracking-[0.16em]">
              Year {prestige.currentYear} Top Ten
            </div>
            <div className="theme-heading mt-1 text-2xl font-bold">{topTenTotal}</div>
            <div className="theme-copy mt-1">
              {prestige.metrics.currentBreedNumberOnes +
                prestige.metrics.currentAllBreedNumberOnes}{" "}
              #1 standing credits
            </div>
          </div>

          <div className="theme-card rounded-2xl p-4">
            <div className="theme-copy text-xs uppercase tracking-[0.16em]">
              Major Awards
            </div>
            <div className="theme-heading mt-1 text-2xl font-bold">
              {prestige.metrics.bestInShowWins} BIS
            </div>
            <div className="theme-copy mt-1">
              {prestige.metrics.reserveBestInShowWins} RBIS,{" "}
              {prestige.metrics.groupPlacements} group placements
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
