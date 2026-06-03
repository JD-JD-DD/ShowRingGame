import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import Link from "next/link";
import { getShowDistrictRegion } from "@showring/rules";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { getKennelPrestigeSummary } from "@/server/services/kennelPrestige.service";

export default async function KennelPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      slug: true,
      homeDistrict: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const homeRegion = kennel.homeDistrict
    ? getShowDistrictRegion(kennel.homeDistrict)
    : null;
  const prestige = await getKennelPrestigeSummary(kennel.id);
  const topTenTotal =
    prestige.metrics.currentBreedTopTenOwned +
    prestige.metrics.currentBreedTopTenBred +
    prestige.metrics.currentAllBreedTopTenOwned +
    prestige.metrics.currentAllBreedTopTenBred;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Kennel</div>
          <div className="mt-1 text-xl font-semibold">{kennel.name}</div>
          <div className="mt-1 text-sm text-neutral-600">{kennel.slug}</div>
        </div>

        <div
          style={homeRegion ? getDistrictPanelStyle(homeRegion) : undefined}
          className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm"
        >
          <div className="text-sm text-neutral-500">Region</div>
          <div className="mt-1 text-xl font-semibold">
            {homeRegion?.name ?? "-"}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Balance</div>
          <div className="mt-1 text-xl font-semibold">
            ${kennel.balance.toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Prestige</div>
          <div className="mt-1 text-xl font-semibold">
            {prestige.score.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-neutral-600">
            {prestige.tier.label}
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-[28px] border border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(76,29,149,0.42),rgba(15,23,42,0.72))] p-6 text-white shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-100/75">
              Kennel Prestige
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              {prestige.tier.label}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              Prestige rewards the kennel&apos;s long-term show identity: champions
              bred, champions finished, major show wins, Top Ten standing, and
              health-tested excellence.
            </p>
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
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          href="/"
          className="rounded-md border border-purple-500 px-5 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-950/40"
        >
          Home
        </Link>

        <Link
          href="/market"
          className="rounded-md bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-600"
        >
          Market
        </Link>

        <Link
          href="/litters"
          className="rounded-md border border-emerald-400/40 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
        >
          Litters
        </Link>

        <Link
          href="/plan-a-litter"
          className="premium-planner-link"
        >
          <span className="premium-planner-link__spark" aria-hidden="true">
            ◆
          </span>
          <span>
            <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
              Advanced Planning Tool
            </span>
            <span className="mt-0.5 block text-sm font-bold tracking-wide text-white">
              Plan A Litter
            </span>
          </span>
        </Link>

        <Link
          href="/memorium"
          className="rounded-md border border-rose-300/40 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-950/40"
        >
          Memorium
        </Link>

        <Link
          href="/bulletin"
          className="rounded-md border border-amber-300/40 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/40"
        >
          Bulletin Board
        </Link>

        <Link
          href="/shows"
          className="rounded-md border border-sky-400/40 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/40"
        >
          Shows
        </Link>

        <Link
          href="/shows/top-ten#kennel-top-ten"
          className="rounded-md border border-fuchsia-300/40 px-5 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-950/40"
        >
          Kennel Top Ten
        </Link>

        <Link
          href="/my-results"
          className="rounded-md border border-sky-300/40 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/40"
        >
          My Results
        </Link>

        <Link
          href="/ledger"
          className="rounded-md border border-purple-300/40 px-5 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-950/40"
        >
          Ledger
        </Link>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>

      <KennelDogsPanel />
    </main>
  );
}

