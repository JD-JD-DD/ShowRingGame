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
      deathEpoch: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      _count: {
        select: {
          sireOf: true,
          damOf: true,
        },
      },
      sireOf: {
        where: {
          visibleTitlePrefix: "CH",
        },
        select: {
          id: true,
        },
      },
      damOf: {
        where: {
          visibleTitlePrefix: "CH",
        },
        select: {
          id: true,
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
            <h1 className="mt-2 text-3xl font-semibold">In Memoriam</h1>
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
            No dogs are listed in In Memoriam.
          </section>
        ) : (
          <section className="overflow-hidden rounded-[28px] border border-rose-200/15 bg-[linear-gradient(180deg,rgba(45,25,48,0.96),rgba(18,10,24,0.98))] shadow-[0_18px_44px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_4rem] gap-4 border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100/80">
              <div>Name</div>
              <div className="text-right">Died</div>
              <div className="text-right">Progeny</div>
              <div className="text-right">CH</div>
            </div>

            <div className="divide-y divide-white/10">
              {dogs.map((dog) => {
                const name = formatDogDisplayName(dog);
                const deathEpoch = dog.deathEpoch ?? currentEpoch;
                const progenyCount =
                  dog.sex === "M" ? dog._count.sireOf : dog._count.damOf;
                const championProgenyCount =
                  dog.sex === "M" ? dog.sireOf.length : dog.damOf.length;

                return (
                  <Link
                    key={dog.id}
                    href={`/dogs/${dog.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_4rem] gap-4 px-5 py-2.5 text-sm transition hover:bg-white/5"
                  >
                    <div className="min-w-0 truncate self-center font-semibold text-white">
                      {name}
                    </div>
                    <div className="self-center text-right font-semibold text-purple-100">
                      {formatDate(deathEpoch)}
                    </div>
                    <div className="self-center text-right font-semibold text-white">
                      {progenyCount}
                    </div>
                    <div className="self-center text-right font-semibold text-white">
                      {championProgenyCount}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
