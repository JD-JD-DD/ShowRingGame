import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentEpoch } from "@/lib/gameClock";
import { formatGameAge } from "@/lib/gameTimeFormat";
import { formatShowCalendarLabel } from "@/lib/showCalendarLabels";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getLitterForKennel } from "@/server/services/litter.service";
import TraitLine from "@/components/ui/TraitLine";

type PageProps = {
  params: Promise<{
    litterId: string;
  }>;
};

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

const VISIBLE_CATEGORY_LABELS: Record<string, string> = {
  typeExpression: "Type & Expression",
  structureBalance: "Structure & Balance",
  movement: "Movement",
  coatPresentation: "Coat & Presentation",
  temperamentRingBehavior: "Temperament & Ring Behavior",
  conditioningHandling: "Conditioning & Handling",
};

function formatCategoryName(key: string): string {
  return (
    VISIBLE_CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function visibleCategoryEntries(categories: Record<string, number>) {
  return Object.entries(categories).filter(
    ([key]) => key !== "conditioningHandling"
  );
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function LitterDetailPage({ params }: PageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    redirect("/onboarding");
  }

  const { litterId } = await params;
  const currentEpoch = getCurrentEpoch();
  const litter = await getLitterForKennel({
    kennelId: kennel.id,
    litterId,
    currentEpoch,
  });

  if (!litter) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="theme-panel mb-8 rounded-2xl px-5 py-4">
          <div className="grid gap-5 lg:grid-cols-[1fr_minmax(420px,0.75fr)] lg:items-center">
            <div>
              <p className="theme-label text-sm uppercase tracking-[0.25em]">
                Litter Record
              </p>
              <h1 className="theme-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                <Link
                  href={`/dogs/${litter.dam.dogId}`}
                  className={`hover:underline ${focusLinkClass}`}
                >
                  {litter.dam.displayName}
                </Link>{" "}
                x{" "}
                <Link
                  href={`/dogs/${litter.sire.dogId}`}
                  className={`hover:underline ${focusLinkClass}`}
                >
                  {litter.sire.displayName}
                </Link>
              </h1>
            <p className="theme-copy mt-2 text-sm leading-6">
              {litter.breedName} ({litter.breedCode2}) litter {litter.serial7},
              Whelped: {formatShowCalendarLabel(litter.bornEpoch)}. Litter age: {formatGameAge(litter.ageHours ?? 0)}.
            </p>
            {litter.neonatalLossCount > 0 ? (
              <p className="theme-status-danger mt-3 rounded-xl px-3 py-2 text-sm leading-6">
                {litter.neonatalLossCount === 1
                  ? "One puppy was lost before placement age."
                  : `${litter.neonatalLossCount} puppies were lost before placement age.`}
              </p>
            ) : null}
          </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="theme-card rounded-xl px-4 py-3">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Born
                </div>
                <div className="theme-heading mt-1 text-2xl font-semibold leading-none">
                  {litter.pupCount}
                </div>
              </div>
              <div className="theme-card rounded-xl px-4 py-3">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Survived
                </div>
                <div className="theme-heading mt-1 text-2xl font-semibold leading-none">
                  {litter.survivedCount}
                </div>
              </div>
              <div className="theme-card rounded-xl px-4 py-3">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Lost
                </div>
                <div className="theme-heading mt-1 text-2xl font-semibold leading-none">
                  {litter.neonatalLossCount}
                </div>
              </div>
              <div className="theme-card rounded-xl px-4 py-3">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Sexes
                </div>
                <div className="theme-heading mt-1 text-sm font-semibold leading-5">
                  {litter.maleCount} dogs
                  <br />
                  {litter.femaleCount} bitches
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-3">
          <div className="theme-card rounded-2xl p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              Sire
            </div>
            <Link
              href={`/dogs/${litter.sire.dogId}`}
              className={`mt-2 block text-lg font-semibold hover:underline ${focusLinkClass}`}
            >
              {litter.sire.displayName}
            </Link>
            <div className="theme-copy mt-1 text-sm">
              {litter.sire.regNumber}
            </div>
          </div>

          <div className="theme-card rounded-2xl p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              Dam
            </div>
            <Link
              href={`/dogs/${litter.dam.dogId}`}
              className={`mt-2 block text-lg font-semibold hover:underline ${focusLinkClass}`}
            >
              {litter.dam.displayName}
            </Link>
            <div className="theme-copy mt-1 text-sm">
              {litter.dam.regNumber}
            </div>
          </div>

          <div className="theme-card rounded-2xl p-5">
            <div className="theme-label text-xs uppercase tracking-wide">
              Breeding
            </div>
            <div className="theme-heading mt-2 text-lg font-semibold">
              {litter.breedingAttempt
                ? statusLabel(litter.breedingAttempt.status)
                : "Recorded"}
            </div>
            <div className="theme-copy mt-1 text-sm">
              Bred by{" "}
              {litter.bredByKennel ? (
                <Link
                  href={`/kennels/${litter.bredByKennel.slug}`}
                  className={`font-semibold hover:underline ${focusLinkClass}`}
                >
                  {litter.bredByKennel.name}
                </Link>
              ) : (
                "Unknown kennel"
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="theme-heading text-2xl font-semibold">Puppies</h2>
            <span className="theme-copy text-sm">
              Whelped {formatShowCalendarLabel(litter.bornEpoch)}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {litter.puppies.map((puppy) => {
              const visibleCategories = visibleCategoryEntries(
                puppy.visibleCategories
              );

              return (
                <article
                  key={puppy.dogId}
                  className="theme-card rounded-2xl p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Puppy {puppy.litterOrder ?? "-"} / {puppy.sex}
                      </div>
                      {puppy.isNeonatalLoss ? (
                        <div className="theme-heading mt-2 text-xl font-semibold">
                          Litter loss
                        </div>
                      ) : (
                        <Link
                          href={`/dogs/${puppy.dogId}`}
                          className={`mt-2 block text-xl font-semibold hover:underline ${focusLinkClass}`}
                        >
                          {puppy.displayName}
                        </Link>
                      )}
                      <div className="theme-copy mt-1 text-sm">
                        {puppy.regNumber}
                      </div>
                    </div>
                    <div className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                      {statusLabel(puppy.lifecycleState)}
                    </div>
                  </div>

                  {puppy.isNeonatalLoss ? (
                    <div className="theme-card theme-copy mt-5 rounded-xl p-4 text-sm">
                      This puppy was lost before placement age and is preserved
                      here as part of the litter record.
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2">
                      {visibleCategories.map(([key, value]) => (
                        <TraitLine
                          key={key}
                          label={formatCategoryName(key)}
                          value={value}
                          min={0}
                          max={20}
                          ideal={10}
                          leftLabel="Under ideal"
                          rightLabel="Over ideal"
                        />
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
