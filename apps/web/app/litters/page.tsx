import Link from "next/link";
import { redirect } from "next/navigation";

import { LittersListClient } from "@/components/litters/LittersListClient";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listLittersForKennel } from "@/server/services/litter.service";

function formatGameDays(hours: number | null): string {
  if (hours === null) return "Pending";
  if (hours <= 0) return "Ready";
  if (hours === 1) return "1 day";
  return `${hours} days`;
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function LittersPage() {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await getKennelForUser(userId);

  if (!kennel) {
    redirect("/onboarding");
  }

  const currentEpoch = getCurrentEpoch();
  const {
    litters,
    nextCursor,
    hasMore,
    totalCount,
    totalPuppyCount,
    activeBreedings,
  } = await listLittersForKennel({
    kennelId: kennel.id,
    currentEpoch,
  });

  const pregnantBreedings = activeBreedings.filter(
    (attempt) => attempt.status === "PREGNANT"
  );

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-emerald-200/85">
              Breeding Records
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Litters
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--dog-copy)]">
              Follow active pregnancies and review every litter whelped by your
              kennel.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/kennel"
              className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-3 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Total Litters
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalCount}</div>
          </div>
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Puppies Whelped
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalPuppyCount}</div>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <div className="text-xs uppercase tracking-wide text-emerald-100">
              Pregnant Dams
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {pregnantBreedings.length}
            </div>
          </div>
        </section>

        {activeBreedings.length > 0 ? (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">In Progress</h2>
              <span className="text-sm text-[var(--dog-copy)]">
                {activeBreedings.length} active
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeBreedings.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-panel)] p-5 shadow-[var(--dog-shadow)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-100">
                        {statusLabel(attempt.status)}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">
                        {attempt.damName} x {attempt.sireName}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--dog-copy)]">
                        Breed code {attempt.breedCode2}
                      </p>
                    </div>
                    <div className="rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1 text-xs font-medium text-[var(--dog-heading)]">
                      Attempt
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                        Pregnancy Check
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatGameDays(attempt.hoursUntilPregCheck)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                        Due
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatGameDays(attempt.hoursUntilDue)}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Whelped Litters</h2>
            <span className="text-sm text-[var(--dog-copy)]">
              Epoch {currentEpoch}
            </span>
          </div>

          <LittersListClient
            initialLitters={litters}
            initialCursor={nextCursor}
            initialHasMore={hasMore}
          />
        </section>
      </div>
    </main>
  );
}
