import Link from "next/link";
import { redirect } from "next/navigation";

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
  const { litters, activeBreedings } = await listLittersForKennel({
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
            <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
              Follow active pregnancies and review every litter whelped by your
              kennel.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/breed?mode=full"
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Plan A Litter
            </Link>
            <Link
              href="/kennel"
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Total Litters
            </div>
            <div className="mt-2 text-3xl font-semibold">{litters.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Puppies Whelped
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {litters.reduce((total, litter) => total + litter.pupCount, 0)}
            </div>
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
              <span className="text-sm text-purple-100/65">
                {activeBreedings.length} active
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {activeBreedings.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(13,148,136,0.18),rgba(255,255,255,0.05))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-emerald-100">
                        {statusLabel(attempt.status)}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">
                        {attempt.damName} x {attempt.sireName}
                      </h3>
                      <p className="mt-1 text-sm text-purple-100/70">
                        Breed code {attempt.breedCode2}
                      </p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-purple-100">
                      Attempt
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-purple-200">
                        Pregnancy Check
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatGameDays(attempt.hoursUntilPregCheck)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-wide text-purple-200">
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
            <span className="text-sm text-purple-100/65">
              Epoch {currentEpoch}
            </span>
          </div>

          {litters.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <h3 className="text-xl font-semibold">No litters yet</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-purple-100/70">
                Once a pregnant dam reaches her due date, the litter engine will
                create puppies and they will appear here.
              </p>
              <Link
                href="/breed?mode=full"
                className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold transition hover:bg-emerald-500"
              >
                Plan A Litter
              </Link>
            </div>
          ) : (
            <div className="grid gap-5">
              {litters.map((litter) => (
                <Link
                  key={litter.litterId}
                  href={`/litters/${litter.litterId}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition hover:border-emerald-200/35 hover:bg-white/10"
                >
                  <article className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                          {litter.breedName} ({litter.breedCode2})
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-purple-100">
                          Serial {litter.serial7}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-semibold text-white">
                        {litter.dam.displayName} x {litter.sire.displayName}
                      </h3>
                      <p className="mt-2 text-sm text-purple-100/70">
                        Whelped {formatGameDays(litter.ageHours)} ago by{" "}
                        {litter.bredByKennelName ?? "Unknown kennel"}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-purple-100/80">
                        <span>{litter.pupCount} puppies</span>
                        <span>{litter.maleCount} dogs</span>
                        <span>{litter.femaleCount} bitches</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
                      {litter.puppiesPreview.map((puppy) => (
                        <div
                          key={puppy.dogId}
                          className="rounded-xl border border-white/10 bg-black/20 p-3"
                        >
                          <div className="text-xs text-purple-200">
                            Puppy {puppy.litterOrder ?? "-"} {puppy.sex}
                          </div>
                          <div className="mt-1 truncate text-sm font-semibold text-white">
                            {puppy.displayName}
                          </div>
                          <div className="mt-1 truncate text-xs text-purple-100/60">
                            {puppy.regNumber}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
