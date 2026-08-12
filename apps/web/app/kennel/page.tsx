import Link from "next/link";
import { redirect } from "next/navigation";

import KennelDogsPanel from "@/components/kennel/KennelDogsPanel";
import NewKennelChecklist from "@/components/kennel/NewKennelChecklist";
import { db } from "@/lib/db";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";

export default async function KennelPage() {
  const perf = createPerfTimer({ route: "/kennel" });
  const userId = await perf.measure("sessionMs", () => getSessionUserId());

  if (!userId) {
    perf.log({ userContextPresent: false, kennelContextPresent: false });
    redirect("/login");
  }

  const kennel = await perf.measure("kennelQueryMs", () =>
    db.kennel.findUnique({
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
    })
  );

  if (!kennel) {
    perf.log({ userContextPresent: true, kennelContextPresent: false });
    redirect("/onboarding");
  }

  const hasDogs = kennel._count.ownedDogs > 0;
  const hasShowEntries = kennel._count.showEntries > 0;
  const hasBreedingPlan =
    kennel._count.createdBreedingAttempts > 0 || kennel._count.bredLitters > 0;
  const hasBeginnerLoopComplete = hasDogs && hasShowEntries && hasBreedingPlan;
  perf.log({
    userContextPresent: true,
    kennelContextPresent: true,
    dogCount: kennel._count.ownedDogs,
    entryCount: kennel._count.showEntries,
    breedingAttemptCount: kennel._count.createdBreedingAttempts,
    litterCount: kennel._count.bredLitters,
    payloadSizeBytes: estimateJsonSizeBytes(kennel),
  });

  return (
    <main className="kennel-page mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
      <NewKennelChecklist
        hasDogs={hasDogs}
        hasShowEntries={hasShowEntries}
        hasBreedingPlan={hasBreedingPlan}
        showByDefault={!hasBeginnerLoopComplete}
      />

      <section className="theme-card mb-8 rounded-2xl p-4">
        <div className="theme-label mb-3 text-xs font-semibold uppercase tracking-[0.18em]">
          Premium Features
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/plan-a-litter"
            className="theme-primary-button inline-flex min-h-12 items-center gap-[.65rem] rounded-xl px-[.9rem] py-2"
          >
            <span>
              <span className="block text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[var(--color-primary-foreground)]">
                Advanced Planning Tool
              </span>
              <span className="mt-0.5 block text-sm font-bold tracking-wide text-[var(--color-primary-foreground)]">
                Plan A Litter
              </span>
            </span>
          </Link>
        </div>
      </section>

      <KennelDogsPanel />
    </main>
  );
}
