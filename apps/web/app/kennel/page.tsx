import Link from "next/link";
import { redirect } from "next/navigation";

import LogoutButton from "@/components/LogoutButton";
import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import { db } from "@/lib/db";
import { getDistrictPanelStyle } from "@/lib/districtStyles";
import { getSessionUserId } from "@/lib/session";
import { getShowDistrictRegion } from "@showring/rules";
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

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-6 grid gap-3 lg:grid-cols-[1.35fr_0.85fr_0.85fr_1fr]">
        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Kennel
          </div>
          <div className="mt-1 text-lg font-semibold">{kennel.name}</div>
          <div className="mt-1 text-xs text-neutral-600">{kennel.slug}</div>
        </div>

        <div
          style={homeRegion ? getDistrictPanelStyle(homeRegion) : undefined}
          className="rounded-2xl border border-purple-900 bg-purple-800/40 p-4 shadow-sm"
        >
          <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Region
          </div>
          <div className="mt-1 text-lg font-semibold">
            {homeRegion?.name ?? "-"}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Balance
          </div>
          <div className="mt-1 text-lg font-semibold">
            ${kennel.balance.toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-neutral-500">
            <span>Prestige</span>
            <Link
              href="/faq#kennel-prestige"
              aria-label="How is kennel prestige calculated?"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 text-xs font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              ?
            </Link>
          </div>
          <div className="mt-1 text-lg font-semibold">
            {prestige.score.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-neutral-600">
            {prestige.tier.label}
          </div>
          <Link
            href="/kennel/prestige"
            className="mt-2 inline-block text-xs font-semibold text-fuchsia-100 underline-offset-4 hover:underline"
          >
            View details
          </Link>
        </div>
      </section>

      <section className="mb-6 rounded-[24px] border border-white/10 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">My Kennel</h1>
            <p className="mt-1 text-sm text-purple-100/72">
              Your operations dashboard for shows, breeding, records, and day
              to day kennel management.
            </p>
          </div>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/shows"
            className="rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Shows
          </Link>
          <Link
            href="/my-results"
            className="rounded-md border border-sky-300/40 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/40"
          >
            My Results
          </Link>
          <Link href="/plan-a-litter" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
              â—†
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
            href="/litters"
            className="rounded-md border border-emerald-400/40 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
          >
            Litters
          </Link>
          <Link
            href="/market"
            className="rounded-md bg-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-purple-600"
          >
            Market
          </Link>
          <Link
            href="/bulletin"
            className="rounded-md border border-amber-300/40 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/40"
          >
            Bulletin Board
          </Link>
          <Link
            href="/ledger"
            className="rounded-md border border-purple-300/40 px-5 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-950/40"
          >
            Ledger
          </Link>
          <Link
            href="/memorium"
            className="rounded-md border border-rose-300/40 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-950/40"
          >
            Memorium
          </Link>
          <Link
            href="/"
            className="rounded-md border border-purple-500 px-5 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-950/40"
          >
            Home
          </Link>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">
            Future Summary
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Pregnant Bitches
          </h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/72">
            Placeholder for an at-a-glance view of kennel pregnancies.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">
            Future Summary
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Litters Due Soon
          </h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/72">
            Placeholder for whelping countdowns and due-soon reminders.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">
            Future Summary
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Show Eligible Dogs
          </h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/72">
            Placeholder for quick access to dogs ready for the next shows.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">
            Future Summary
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Recent Kennel Notices
          </h2>
          <p className="mt-2 text-sm leading-6 text-purple-100/72">
            Placeholder for recent alerts and important kennel updates.
          </p>
        </div>
      </section>

      <KennelDogsPanel />
    </main>
  );
}
