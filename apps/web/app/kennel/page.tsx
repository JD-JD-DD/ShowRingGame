import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";

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

      <div className="mb-8">
        <LogoutButton />
      </div>

      <KennelDogsPanel />
    </main>
  );
}

