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
    <main className="kennel-page mx-auto max-w-7xl px-6 py-8">
      <section className="mb-6 grid gap-3 lg:grid-cols-[1.35fr_0.85fr_0.85fr_1fr]">
        <div className="theme-card rounded-2xl p-3">
          <div className="theme-label text-xs uppercase tracking-[0.16em]">
            Kennel
          </div>
          <div className="theme-heading mt-0.5 text-base font-semibold">{kennel.name}</div>
          <div className="theme-copy mt-1 text-xs">{kennel.slug}</div>
        </div>

        <div
          style={homeRegion ? getDistrictPanelStyle(homeRegion) : undefined}
          className="theme-card rounded-2xl p-3"
        >
          <div className="theme-label text-xs uppercase tracking-[0.16em]">
            Region
          </div>
          <div className="theme-heading mt-0.5 text-base font-semibold">
            {homeRegion?.name ?? "-"}
          </div>
        </div>

        <div className="theme-card rounded-2xl p-3">
          <div className="theme-label text-xs uppercase tracking-[0.16em]">
            Balance
          </div>
          <div className="theme-heading mt-0.5 text-base font-semibold">
            ${kennel.balance.toLocaleString()}
          </div>
        </div>

        <div className="theme-card rounded-2xl p-3">
          <div className="theme-label flex items-center gap-2 text-xs uppercase tracking-[0.16em]">
            <span>Prestige</span>
            <Link
              href="/faq#kennel-prestige"
              aria-label="How is kennel prestige calculated?"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 text-xs font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              ?
            </Link>
          </div>
          <div className="theme-heading mt-0.5 text-base font-semibold">
            {prestige.score.toLocaleString()}
          </div>
          <div className="theme-copy mt-1 text-xs">
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

      <section className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="theme-secondary-button rounded-md px-5 py-2 text-sm font-semibold"
          >
            Home
          </Link>
          <Link
            href="/shows"
            className="rounded-md border border-sky-400/40 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/40"
          >
            Shows
          </Link>
          <Link
            href="/my-results"
            className="rounded-md border border-sky-300/40 px-5 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-950/40"
          >
            My Results
          </Link>
          <Link
            href="/litters"
            className="rounded-md border border-emerald-400/40 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
          >
            Litters
          </Link>
          <Link
            href="/market"
            className="theme-secondary-button rounded-md px-5 py-2 text-sm font-semibold"
          >
            Market
          </Link>
          <Link
            href="/community"
            className="rounded-md border border-amber-300/40 px-5 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/40"
          >
            Community
          </Link>
          <Link
            href="/ledger"
            className="theme-secondary-button rounded-md px-5 py-2 text-sm font-semibold"
          >
            Ledger
          </Link>
          <Link
            href="/kennel/services"
            className="rounded-md border border-emerald-300/40 px-5 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/40"
          >
            Services
          </Link>
          <Link
            href="/memorium"
            className="rounded-md border border-rose-300/40 px-5 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-950/40"
          >
            In Memoriam
          </Link>

          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </section>

      <section className="theme-card mb-8 rounded-2xl p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/75">
          Premium Features
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/plan-a-litter" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
              
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
          <Link href="/kennel/program-planner" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
            </span>
            <span>
              <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                Kennel Strategy Tool
              </span>
              <span className="mt-0.5 block text-sm font-bold tracking-wide text-white">
                Program Planner
              </span>
            </span>
          </Link>
        </div>
      </section>

      <KennelDogsPanel />
    </main>
  );
}
