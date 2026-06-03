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

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-8 rounded-[28px] border border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(76,29,149,0.42),rgba(15,23,42,0.72))] p-6 text-white shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-100/75">
                Kennel Prestige
              </p>
              <Link
                href="/faq#kennel-prestige"
                aria-label="How is kennel prestige calculated?"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 text-sm font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                ?
              </Link>
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {prestige.tier.label}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              Prestige rewards {kennel.name}&apos;s long-term show identity:
              champions bred, champions finished, major show wins, Top Ten
              standing, and health-tested excellence.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Back to My Kennel
              </Link>
              <Link
                href="/shows/top-ten#kennel-top-ten"
                className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                Kennel Top Ten
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-fuchsia-200/20 bg-black/25 px-6 py-5 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/70">
              Score
            </div>
            <div className="mt-1 text-4xl font-black">
              {prestige.score.toLocaleString()}
            </div>
            {prestige.tier.nextScore ? (
              <div className="mt-2 text-xs text-purple-100/65">
                {prestige.tier.nextScore - prestige.score} to{" "}
                {prestige.tier.nextLabel}
              </div>
            ) : (
              <div className="mt-2 text-xs text-purple-100/65">
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
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="text-xs uppercase tracking-[0.16em] text-purple-100/60">
                {label}
              </div>
              <div className="mt-1 text-xl font-bold">
                {Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-purple-100/60">
              Champions Bred
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.championsBred}
            </div>
            <div className="mt-1 text-purple-100/65">
              {prestige.metrics.championProducingLitters} champion-producing
              litters
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-purple-100/60">
              Champions Finished
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.championsFinishedOwnerHandled +
                prestige.metrics.championsFinishedWithHandler}
            </div>
            <div className="mt-1 text-purple-100/65">
              {prestige.metrics.championsFinishedOwnerHandled} owner-handled,{" "}
              {prestige.metrics.championsFinishedWithHandler} with handler
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-purple-100/60">
              Year {prestige.currentYear} Top Ten
            </div>
            <div className="mt-1 text-2xl font-bold">{topTenTotal}</div>
            <div className="mt-1 text-purple-100/65">
              {prestige.metrics.currentBreedNumberOnes +
                prestige.metrics.currentAllBreedNumberOnes}{" "}
              #1 standing credits
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-purple-100/60">
              Major Awards
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.bestInShowWins} BIS
            </div>
            <div className="mt-1 text-purple-100/65">
              {prestige.metrics.reserveBestInShowWins} RBIS,{" "}
              {prestige.metrics.groupPlacements} group placements
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
