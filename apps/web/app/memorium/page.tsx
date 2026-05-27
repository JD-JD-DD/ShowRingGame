import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";

function formatDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

export default async function MemoriumPage() {
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
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const currentEpoch = getCurrentEpoch();
  await resolveDogDeaths({ kennelId: kennel.id, currentEpoch });

  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennel.id,
      lifecycleState: "DECEASED",
    },
    orderBy: [{ deathEpoch: "desc" }, { regNumber: "asc" }],
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      deathEpoch: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      breed: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          showResults: true,
          sireOf: true,
          damOf: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-rose-200/80">
              {kennel.name}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Memorium</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-purple-100/70">
              Dogs who have passed stay here for pedigree, show record, and
              kennel history.
            </p>
          </div>

          <Link
            href="/kennel"
            className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Back to My Kennel
          </Link>
        </div>

        {dogs.length === 0 ? (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/70 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            No dogs are in the memorium.
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dogs.map((dog) => {
              const name = formatDogDisplayName(dog);
              const deathEpoch = dog.deathEpoch ?? currentEpoch;
              const ageAtDeath = Math.max(0, deathEpoch - dog.birthEpoch);
              const progenyCount =
                dog.sex === "M" ? dog._count.sireOf : dog._count.damOf;

              return (
                <Link
                  key={dog.id}
                  href={`/dogs/${dog.id}`}
                  className="rounded-[28px] border border-rose-200/15 bg-[linear-gradient(180deg,rgba(45,25,48,0.96),rgba(18,10,24,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.3)] transition hover:border-rose-200/35 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-rose-100">
                        {dog.breed.name} ({dog.breedCode2})
                      </div>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {name}
                      </h2>
                      <div className="mt-1 text-sm text-purple-100/60">
                        {dog.regNumber}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-purple-100">
                      {dog.sex}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-purple-100/75">
                    <div className="flex items-center justify-between gap-3">
                      <span>Died</span>
                      <span className="font-semibold text-white">
                        {formatDate(deathEpoch)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Age</span>
                      <span className="font-semibold text-white">
                        {formatAge(ageAtDeath)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Show Results</span>
                      <span className="font-semibold text-white">
                        {dog._count.showResults}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Progeny</span>
                      <span className="font-semibold text-white">
                        {progenyCount}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
