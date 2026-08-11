import Link from "next/link";
import { redirect } from "next/navigation";

import { LittersListClient } from "@/components/litters/LittersListClient";
import { getCurrentEpoch } from "@/lib/gameClock";
import { formatRealDurationHoursLong } from "@/lib/gameTimeFormat";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listLittersForKennel } from "@/server/services/litter.service";

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function breedingProgressLabel(attempt: {
  status: string;
  reproductiveEmergencyStatus: string | null;
}): string {
  if (attempt.status === "INITIATED") return "Pregnancy not yet confirmed";
  if (attempt.status === "PREGNANT") return "Pregnancy confirmed";
  if (attempt.status === "REPRODUCTIVE_EMERGENCY") {
    if (attempt.reproductiveEmergencyStatus === "PENDING") {
      return "Reproductive emergency — care decision required";
    }
    if (attempt.reproductiveEmergencyStatus === "TREATMENT_AUTHORIZED") {
      return "Reproductive emergency — treatment in progress";
    }
    if (attempt.reproductiveEmergencyStatus === "TREATMENT_DECLINED") {
      return "Reproductive emergency — outcome pending";
    }
  }
  return statusLabel(attempt.status);
}

const focusLinkClass =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200";

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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
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
              className="theme-secondary-button rounded-xl px-5 py-3 text-sm font-semibold"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="theme-card rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Total Litters
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalCount}</div>
          </div>
          <div className="theme-card rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Puppies Whelped
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalPuppyCount}</div>
          </div>
          <div className="theme-status-success rounded-2xl border p-5">
            <div className="text-xs uppercase tracking-wide">
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
                  className="theme-panel rounded-2xl p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="theme-label text-xs uppercase tracking-wide">
                        {breedingProgressLabel(attempt)}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">
                        <Link href={`/dogs/${attempt.damId}`} className={`hover:underline ${focusLinkClass}`}>
                          {attempt.damName}
                        </Link>{" "}
                        x{" "}
                        <Link href={`/dogs/${attempt.sireId}`} className={`hover:underline ${focusLinkClass}`}>
                          {attempt.sireName}
                        </Link>
                      </h3>
                      <p className="mt-1 text-sm text-[var(--dog-copy)]">
                        Breed code {attempt.breedCode2}
                      </p>
                    </div>
                    <div className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-medium">
                      Attempt
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="theme-card rounded-xl p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                        Pregnancy Check
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {attempt.hoursUntilPregCheck === null
                          ? "Not scheduled"
                          : `Pregnancy check in ${formatRealDurationHoursLong(attempt.hoursUntilPregCheck)}`}
                      </div>
                    </div>
                    <div className="theme-card rounded-xl p-4">
                      <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                        Due
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {attempt.hoursUntilDue === null
                          ? "Not scheduled"
                          : `Due in ${formatRealDurationHoursLong(attempt.hoursUntilDue)}`}
                      </div>
                    </div>
                  </div>
                  {attempt.status === "REPRODUCTIVE_EMERGENCY" &&
                  attempt.reproductiveEmergencyStatus === "PENDING" ? (
                    <Link
                      href={`/dogs/${attempt.damId}#whelping-emergency`}
                      className={`mt-5 inline-flex rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 ${focusLinkClass}`}
                    >
                      Review emergency care
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Whelped Litters</h2>
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
