import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import MyResultsAccordion from "./MyResultsAccordion";
import { loadMyResultsPage } from "./myResults.loader";

export default async function MyShowResultsPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const resultsPage = await loadMyResultsPage({
    kennelId: kennel.id,
    currentEpoch: getCurrentEpoch(),
  });

  return (
    <main className="results-page mx-auto max-w-7xl px-6 py-8">
      <section className="theme-panel mb-8 rounded-[28px] px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="theme-heading text-4xl font-bold tracking-tight">
              My Show Results
            </h1>
            <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
              Judged show results and absences for dogs in{" "}
              {kennel.name}.
            </p>
          </div>
          </div>
      </section>

      <section className="theme-panel rounded-[28px] p-6">
        {resultsPage.hierarchy.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl p-4 text-sm">
            No judged show results yet.
          </div>
        ) : (
          <MyResultsAccordion
            initialHierarchy={resultsPage.hierarchy}
            initialNextCursor={resultsPage.nextCursor}
          />
        )}
      </section>
    </main>
  );
}
