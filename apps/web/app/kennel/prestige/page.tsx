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
      <section className="mb-8 rounded-[28px] border border-fuchsia-300/20 bg-[var(--dog-panel)] p-6 text-white shadow-[var(--dog-shadow)]">
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
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--dog-copy)]">
              Prestige rewards {kennel.name}&apos;s long-term show identity:
              champions bred, champions finished, Grand Champion achievements,
              major show wins, Top Ten standing, and health-tested excellence.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
              >
                Back to My Kennel
              </Link>
              <Link
                href="/kennels/top-ten"
                className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
              >
                Kennel Top Ten
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-fuchsia-200/20 bg-[var(--dog-card)] px-6 py-5 text-right">
            <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/70">
              Score
            </div>
            <div className="mt-1 text-4xl font-black">
              {prestige.score.toLocaleString()}
            </div>
            {prestige.tier.nextScore ? (
              <div className="mt-2 text-xs text-[var(--dog-copy)]">
                {prestige.tier.nextScore - prestige.score} to{" "}
                {prestige.tier.nextLabel}
              </div>
            ) : (
              <div className="mt-2 text-xs text-[var(--dog-copy)]">
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
              className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3"
            >
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
                {label}
              </div>
              <div className="mt-1 text-xl font-bold">
                {Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
              Champions Bred
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.championsBred}
            </div>
            <div className="mt-1 text-[var(--dog-copy)]">
              {prestige.metrics.championProducingLitters} champion-producing
              litters
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
              Champions Finished
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.championsFinishedOwnerHandled +
                prestige.metrics.championsFinishedWithHandler}
            </div>
            <div className="mt-1 text-[var(--dog-copy)]">
              {prestige.metrics.championsFinishedOwnerHandled} owner-handled,{" "}
              {prestige.metrics.championsFinishedWithHandler} with handler
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
              Grand Champions
            </div>
            <div className="mt-1 text-2xl font-bold">
              {grandChampionTotal}
            </div>
            <div className="mt-1 text-[var(--dog-copy)]">
              {prestige.metrics.grandChampionMilestoneTitles} milestone
              credits
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
              Year {prestige.currentYear} Top Ten
            </div>
            <div className="mt-1 text-2xl font-bold">{topTenTotal}</div>
            <div className="mt-1 text-[var(--dog-copy)]">
              {prestige.metrics.currentBreedNumberOnes +
                prestige.metrics.currentAllBreedNumberOnes}{" "}
              #1 standing credits
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--dog-copy)]">
              Major Awards
            </div>
            <div className="mt-1 text-2xl font-bold">
              {prestige.metrics.bestInShowWins} BIS
            </div>
            <div className="mt-1 text-[var(--dog-copy)]">
              {prestige.metrics.reserveBestInShowWins} RBIS,{" "}
              {prestige.metrics.groupPlacements} group placements
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
