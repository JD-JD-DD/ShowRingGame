import Link from "next/link";
import { redirect } from "next/navigation";

import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import NewKennelChecklist from "@/components/kennel/NewKennelChecklist";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export default async function KennelPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      _count: {
        select: {
          ownedDogs: true,
          showEntries: true,
          createdBreedingAttempts: true,
          bredLitters: true,
        },
      },
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const hasDogs = kennel._count.ownedDogs > 0;
  const hasShowEntries = kennel._count.showEntries > 0;
  const hasBreedingPlan =
    kennel._count.createdBreedingAttempts > 0 || kennel._count.bredLitters > 0;
  const hasBeginnerLoopComplete = hasDogs && hasShowEntries && hasBreedingPlan;

  return (
    <main className="kennel-page mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <NewKennelChecklist
        hasDogs={hasDogs}
        hasShowEntries={hasShowEntries}
        hasBreedingPlan={hasBreedingPlan}
        showByDefault={!hasBeginnerLoopComplete}
      />

      <section className="theme-card mb-8 rounded-2xl p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-100/75">
          Premium Features
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/guide" className="premium-planner-link">
            <span className="premium-planner-link__spark" aria-hidden="true">
            </span>
            <span>
              <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-fuchsia-100/85">
                New? Start Here
              </span>
              <span className="mt-0.5 block text-sm font-bold tracking-wide text-white">
                New Player Guide
              </span>
            </span>
          </Link>
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
