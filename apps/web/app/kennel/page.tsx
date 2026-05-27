import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import Link from "next/link";

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
      reputationScore: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Kennel</div>
          <div className="mt-1 text-xl font-semibold">{kennel.name}</div>
          <div className="mt-1 text-sm text-neutral-600">{kennel.slug}</div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">District</div>
          <div className="mt-1 text-xl font-semibold">{kennel.homeDistrict}</div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Balance</div>
          <div className="mt-1 text-xl font-semibold">
            ${kennel.balance.toLocaleString()}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-900 bg-purple-800/40 p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Reputation</div>
          <div className="mt-1 text-xl font-semibold">
            {kennel.reputationScore ?? 0}
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

