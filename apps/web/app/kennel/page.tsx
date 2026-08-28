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
      <KennelDogsPanel />
    </main>
  );
}
