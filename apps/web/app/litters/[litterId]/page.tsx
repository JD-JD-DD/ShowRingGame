import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getLitterForKennel } from "@/server/services/litter.service";
import TraitLine from "@/components/ui/TraitLine";

type PageProps = {
  params: Promise<{
    litterId: string;
  }>;
};

function formatGameDays(hours: number | null): string {
  if (hours === null) return "Pending";
  if (hours <= 0) return "Today";
  if (hours === 1) return "1 day";
  return `${hours} days`;
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function geneticVisibleCategoryEntries(categories: Record<string, number>) {
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
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            href="/litters"
            className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-2 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
          >
            Back to Litters
          </Link>
          <Link
            href="/kennel"
            className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-2 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
          >
            My Kennel
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-panel)] px-5 py-4 shadow-[var(--dog-shadow)]">
          <div className="grid gap-5 lg:grid-cols-[1fr_minmax(420px,0.75fr)] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-200">
                Litter Record
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                {litter.dam.displayName} x {litter.sire.displayName}
              </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--dog-copy)]">
              {litter.breedName} ({litter.breedCode2}) litter {litter.serial7},
              whelped {formatGameDays(litter.ageHours)} ago.
            </p>
            {litter.neonatalLossCount > 0 ? (
              <p className="mt-3 text-sm leading-6 text-rose-100/80">
                {litter.neonatalLossCount === 1
                  ? "One puppy was lost before placement age."
                  : `${litter.neonatalLossCount} puppies were lost before placement age.`}
              </p>
            ) : null}
          </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                  Born
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none">
                  {litter.pupCount}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                  Survived
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none">
                  {litter.survivedCount}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                  Lost
                </div>
                <div className="mt-1 text-2xl font-semibold leading-none">
                  {litter.neonatalLossCount}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                  Sexes
                </div>
                <div className="mt-1 text-sm font-semibold leading-5">
                  {litter.maleCount} dogs
                  <br />
                  {litter.femaleCount} bitches
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Sire
            </div>
            <Link
              href={`/dogs/${litter.sire.dogId}`}
              className="mt-2 block text-lg font-semibold hover:underline"
            >
              {litter.sire.displayName}
            </Link>
            <div className="mt-1 text-sm text-[var(--dog-copy)]">
              {litter.sire.regNumber}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Dam
            </div>
            <Link
              href={`/dogs/${litter.dam.dogId}`}
              className="mt-2 block text-lg font-semibold hover:underline"
            >
              {litter.dam.displayName}
            </Link>
            <div className="mt-1 text-sm text-[var(--dog-copy)]">
              {litter.dam.regNumber}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Breeding
            </div>
            <div className="mt-2 text-lg font-semibold">
              {litter.breedingAttempt
                ? statusLabel(litter.breedingAttempt.status)
                : "Recorded"}
            </div>
            <div className="mt-1 text-sm text-[var(--dog-copy)]">
              Bred by {litter.bredByKennel?.name ?? "Unknown kennel"}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Puppies</h2>
            <span className="text-sm text-[var(--dog-copy)]">
              Born epoch {litter.bornEpoch}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {litter.puppies.map((puppy) => {
              const visibleCategories = geneticVisibleCategoryEntries(
                puppy.visibleCategories
              );

              return (
                <article
                  key={puppy.dogId}
                  className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-100">
                        Puppy {puppy.litterOrder ?? "-"} / {puppy.sex}
                      </div>
                      {puppy.isNeonatalLoss ? (
                        <div className="mt-2 text-xl font-semibold text-white">
                          Litter loss
                        </div>
                      ) : (
                        <Link
                          href={`/dogs/${puppy.dogId}`}
                          className="mt-2 block text-xl font-semibold hover:underline"
                        >
                          {puppy.displayName}
                        </Link>
                      )}
                      <div className="mt-1 text-sm text-[var(--dog-copy)]">
                        {puppy.regNumber}
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1 text-xs font-medium text-[var(--dog-heading)]">
                      {statusLabel(puppy.lifecycleState)}
                    </div>
                  </div>

                  {puppy.isNeonatalLoss ? (
                    <div className="mt-5 rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4 text-sm text-[var(--dog-copy)]">
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
                          leftLabel="Poor"
                          rightLabel="Poor"
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
