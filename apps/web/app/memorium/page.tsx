import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

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
  const dogs = await db.dog.findMany({
    where: {
      ownerKennelId: kennel.id,
      lifecycleState: "DECEASED",
      isPlayerVisible: true,
      showInMemoriam: true,
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
          sireOf: {
            where: {
              isPlayerVisible: true,
            },
          },
          damOf: {
            where: {
              isPlayerVisible: true,
            },
          },
        },
      },
      sireOf: {
        where: {
          visibleTitlePrefix: "CH",
          isPlayerVisible: true,
        },
        select: {
          id: true,
        },
      },
      damOf: {
        where: {
          visibleTitlePrefix: "CH",
          isPlayerVisible: true,
        },
        select: {
          id: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div>
            <p className="theme-label text-sm uppercase tracking-[0.25em]">
              {kennel.name}
            </p>
            <h1 className="theme-heading mt-2 text-3xl font-semibold">In Memoriam</h1>
            <p className="theme-copy mt-3 max-w-2xl text-sm leading-7">
              Dogs who have passed stay here for pedigree, show record, and
              kennel history.
            </p>
          </div>
        </div>

        {dogs.length === 0 ? (
          <section className="theme-panel theme-copy rounded-[28px] p-8 text-sm">
            No dogs are listed in In Memoriam.
          </section>
        ) : (
          <section className="theme-panel overflow-hidden rounded-[28px]">
            <div className="theme-label grid grid-cols-[minmax(0,1fr)_7rem_5rem_4rem_8rem] gap-4 border-b border-[var(--color-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
              <div>Name</div>
              <div className="text-right">Died</div>
              <div className="text-right">Progeny</div>
              <div className="text-right">CH</div>
              <div className="text-right">Memorial</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {dogs.map((dog) => {
                const name = formatDogDisplayName(dog);
                const deathEpoch = dog.deathEpoch ?? currentEpoch;
                const progenyCount =
                  dog.sex === "M" ? dog._count.sireOf : dog._count.damOf;
                const championProgenyCount =
                  dog.sex === "M" ? dog.sireOf.length : dog.damOf.length;

                return (
                  <div
                    key={dog.id}
                    className="grid grid-cols-[minmax(0,1fr)_7rem_5rem_4rem_8rem] gap-4 px-5 py-2.5 text-sm transition hover:bg-[var(--color-surface-subtle)]"
                  >
                    <Link
                      href={`/dogs/${dog.id}`}
                      className="theme-heading min-w-0 truncate self-center font-semibold underline-offset-4 hover:underline"
                    >
                      {name}
                    </Link>
                    <div className="theme-heading self-center text-right font-semibold">
                      {formatDate(deathEpoch)}
                    </div>
                    <div className="theme-heading self-center text-right font-semibold">
                      {progenyCount}
                    </div>
                    <div className="theme-heading self-center text-right font-semibold">
                      {championProgenyCount}
                    </div>
                    <form
                      action={`/api/dogs/${dog.id}/memoriam`}
                      method="post"
                      className="self-center text-right"
                    >
                      <button
                        type="submit"
                        className="theme-status-danger rounded-lg px-2.5 py-1 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
