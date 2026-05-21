import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listEligibleDogsByShowBlock } from "@/server/services/showEntry.service";
import { ENTRY_FEE_PER_SHOW } from "@showring/rules";

function formatShowDateTime(epoch: number): string {
  return epochToDate(epoch).toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
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

function statusTone(status: string): string {
  switch (status) {
    case "OPEN":
    case "ENTRY_OPEN":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "JUDGING":
    case "ENTRY_LOCKED":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "RESULTS_PUBLISHED":
    case "COMPLETE":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "CANCELLED":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-purple-300/20 bg-white/5 text-purple-100";
  }
}

export default async function ShowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{
    entryError?: string;
    entryMessage?: string;
    dogIds?: string;
    judged?: string;
    judgedEntries?: string;
    judgeError?: string;
  }>;
}) {
  const { showId } = await params;
  const {
    entryError,
    entryMessage,
    dogIds,
    judged,
    judgedEntries,
    judgeError,
  } = await searchParams;
  const selectedDogIds = new Set(
    typeof dogIds === "string" && dogIds.trim()
      ? dogIds
          .split(",")
          .map((dogId) => dogId.trim())
          .filter(Boolean)
      : []
  );
  const currentEpoch = getCurrentEpoch();
  const userId = await getSessionUserId();
  const kennel = userId ? await getKennelForUser(userId) : null;
  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judgingBlocks: {
            orderBy: [
              { startEpoch: "asc" },
              { ringNumber: "asc" },
              { blockOrder: "asc" },
            ],
            include: {
              judge: { select: { name: true } },
              breed: { select: { name: true } },
              _count: { select: { showEntries: true, showResults: true } },
            },
          },
        },
      },
    },
  });

  if (!cluster) {
    notFound();
  }

  const eligibleDogsByBlock = kennel
    ? await listEligibleDogsByShowBlock({
        showId: cluster.id,
        kennelId: kennel.id,
        currentEpoch,
      })
    : {};
  const resultCount = cluster.showDays.reduce(
    (dayTotal, day) =>
      dayTotal +
      day.judgingBlocks.reduce(
        (blockTotal, block) => blockTotal + block._count.showResults,
        0
      ),
    0
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Show Detail
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {cluster.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Rings, breed blocks, assigned judges, entry counts, and eligible
              kennel dogs for this cluster.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/shows/${cluster.id}/results`}
              className={
                resultCount > 0
                  ? "rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                  : "rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              }
            >
              Results
            </Link>
            <Link
              href="/shows"
              className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              All Shows
            </Link>
            <Link
              href="/kennel"
              className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
            >
              My Kennel
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <div
            className={`rounded-full border px-3 py-1 font-semibold ${statusTone(cluster.status)}`}
          >
            {cluster.status}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            District {cluster.district}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-purple-100/75">
            Entries close {formatShowDateTime(cluster.entryCloseEpoch)}
          </div>
        </div>

        {entryMessage ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {entryMessage}
          </div>
        ) : null}

        {entryError ? (
          <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {entryError}
          </div>
        ) : null}

        {judged ? (
          <div className="mt-5 rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Judging complete
            {judgedEntries ? ` for ${judgedEntries} entered dog(s).` : "."}
          </div>
        ) : null}

        {judgeError ? (
          <div className="mt-5 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {judgeError}
          </div>
        ) : null}

        {selectedDogIds.size > 0 ? (
          <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100/80">
            Showing eligible entries from {selectedDogIds.size} selected kennel
            dog{selectedDogIds.size === 1 ? "" : "s"}.
          </div>
        ) : null}
      </section>

      <div className="grid gap-6">
        {cluster.showDays.map((day) => (
          <section
            key={day.id}
            className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  Day {day.dayIndex}
                </h2>
                <p className="mt-2 text-sm text-purple-100/70">
                  Starts {formatShowDateTime(day.scheduledEpoch)}
                </p>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(day.status)}`}
              >
                {day.status}
              </div>
            </div>

            {day.judgingBlocks.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
                No judging blocks have been scheduled for this day.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[1240px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Ring</th>
                      <th className="px-3 py-2">Breed</th>
                      <th className="px-3 py-2">Judge</th>
                      <th className="px-3 py-2">Start</th>
                      <th className="px-3 py-2">Entries</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Enter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.judgingBlocks.map((block) => {
                      const eligibleDogs = (eligibleDogsByBlock[block.id] ?? []).filter(
                        (dog) =>
                          selectedDogIds.size === 0 || selectedDogIds.has(dog.dogId)
                      );

                      return (
                        <tr
                          key={block.id}
                          className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                        >
                          <td className="rounded-l-2xl px-3 py-3 text-purple-100">
                            {block.blockOrder}
                          </td>
                          <td className="px-3 py-3 text-white">
                            Ring {block.ringNumber}
                            {block.ringName ? ` - ${block.ringName}` : ""}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">
                              {block.breed.name}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">
                              {block.judge.name}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-purple-100/75">
                            {formatShowDateTime(block.startEpoch)}
                          </td>
                          <td className="px-3 py-3 text-purple-100/75">
                            {block._count.showEntries}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(block.status)}`}
                            >
                              {block.status}
                            </span>
                          </td>
                          <td className="rounded-r-2xl px-3 py-3">
                            <div className="flex min-w-[300px] flex-col gap-2">
                              {kennel ? (
                              eligibleDogs.length > 0 ? (
                                <form
                                  action={`/api/shows/${cluster.id}/enter`}
                                  method="post"
                                  className="flex min-w-[300px] gap-2"
                                >
                                  <input
                                    type="hidden"
                                    name="judgingBlockId"
                                    value={block.id}
                                  />
                                  <select
                                    name="dogId"
                                    className="min-w-0 flex-1 rounded-xl border border-purple-300/20 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                                  >
                                    {eligibleDogs.map((dog) => (
                                      <option key={dog.dogId} value={dog.dogId}>
                                        {dog.displayName} - {dog.sex} -{" "}
                                        {formatAge(dog.ageHours)}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="submit"
                                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
                                  >
                                    Enter ${ENTRY_FEE_PER_SHOW}
                                  </button>
                                </form>
                              ) : (
                                <div className="text-xs text-purple-100/55">
                                  No eligible kennel dogs
                                </div>
                              )
                            ) : (
                              <Link
                                href="/login"
                                className="text-sm font-semibold text-purple-100 underline-offset-4 hover:underline"
                              >
                                Log in
                              </Link>
                            )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
