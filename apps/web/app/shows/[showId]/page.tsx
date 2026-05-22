import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listEligibleDogsForShowBlock } from "@/server/services/showEntry.service";
import { ensureGeneratedShowBlocksForCluster } from "@/server/services/showSchedule.service";
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

type BreedOption = {
  code2: string;
  name: string;
  blockId: string;
  dayIndex: number;
  startEpoch: number;
  entryCount: number;
};

export default async function ShowDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ showId: string }>;
  searchParams: Promise<{
    entryError?: string;
    entryMessage?: string;
    dogIds?: string;
    breedCode2?: string;
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
    breedCode2,
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
  const selectedBreedCode =
    typeof breedCode2 === "string" && breedCode2.trim()
      ? breedCode2.trim().toUpperCase()
      : "";
  const currentEpoch = getCurrentEpoch();
  const userId = await getSessionUserId();
  const kennel = userId ? await getKennelForUser(userId) : null;

  await ensureGeneratedShowBlocksForCluster({
    showClusterId: showId,
    currentEpoch,
  });

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
              breed: { select: { code2: true, name: true } },
              _count: { select: { showEntries: true, showResults: true } },
            },
          },
          _count: { select: { showResults: true } },
        },
      },
    },
  });

  if (!cluster) {
    notFound();
  }

  const resultCount = cluster.showDays.reduce(
    (total, day) => total + day._count.showResults,
    0
  );
  const breedOptionByCode = new Map<string, BreedOption>();

  for (const day of cluster.showDays) {
    for (const block of day.judgingBlocks) {
      if (block.status !== "ENTRY_OPEN") {
        continue;
      }

      if (breedOptionByCode.has(block.breed.code2)) {
        continue;
      }

      breedOptionByCode.set(block.breed.code2, {
        code2: block.breed.code2,
        name: block.breed.name,
        blockId: block.id,
        dayIndex: day.dayIndex,
        startEpoch: block.startEpoch,
        entryCount: block._count.showEntries,
      });
    }
  }

  const breedOptions = [...breedOptionByCode.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const selectedBreed =
    breedOptionByCode.get(selectedBreedCode) ?? breedOptions[0] ?? null;
  const eligibleDogs =
    kennel && selectedBreed
      ? (
          await listEligibleDogsForShowBlock({
            judgingBlockId: selectedBreed.blockId,
            kennelId: kennel.id,
            currentEpoch,
          })
        ).filter(
          (dog) => selectedDogIds.size === 0 || selectedDogIds.has(dog.dogId)
        )
      : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
              Show Entry
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white">
              {cluster.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-purple-100/75">
              Choose a breed, then enter eligible dogs from your kennel.
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
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <form
          action={`/shows/${cluster.id}`}
          method="get"
          className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto]"
        >
          {typeof dogIds === "string" && dogIds.trim() ? (
            <input type="hidden" name="dogIds" value={dogIds} />
          ) : null}
          <label className="grid gap-2 text-sm text-purple-100/75">
            Breed
            <select
              name="breedCode2"
              defaultValue={selectedBreed?.code2 ?? ""}
              className="rounded-xl border border-purple-300/20 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none"
            >
              {breedOptions.length === 0 ? (
                <option value="">No open breed entries</option>
              ) : (
                breedOptions.map((breed) => (
                  <option key={breed.code2} value={breed.code2}>
                    {breed.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
          >
            Show Dogs
          </button>
        </form>

        {!kennel ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
            Log in to enter dogs from your kennel.
          </div>
        ) : !selectedBreed ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
            No breeds are currently open for entry in this show.
          </div>
        ) : eligibleDogs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
            No eligible {selectedBreed.name} dogs are available in your kennel.
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {selectedBreed.name}
                </h2>
                <p className="mt-1 text-sm text-purple-100/65">
                  Day {selectedBreed.dayIndex} · Starts{" "}
                  {formatShowDateTime(selectedBreed.startEpoch)} ·{" "}
                  {selectedBreed.entryCount} entered
                </p>
              </div>
              <form
                id="bulk-entry-form"
                action={`/api/shows/${cluster.id}/enter`}
                method="post"
              >
                <input
                  type="hidden"
                  name="judgingBlockId"
                  value={selectedBreed.blockId}
                />
                <input type="hidden" name="breedCode2" value={selectedBreed.code2} />
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Enter Selected ${ENTRY_FEE_PER_SHOW} each
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Dog</th>
                    <th className="px-3 py-2">Sex</th>
                    <th className="px-3 py-2">Age</th>
                    <th className="px-3 py-2">Condition</th>
                    <th className="px-3 py-2">Enter</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleDogs.map((dog) => (
                    <tr
                      key={dog.dogId}
                      className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                    >
                      <td className="rounded-l-2xl px-3 py-3">
                        <input
                          form="bulk-entry-form"
                          type="checkbox"
                          name="dogIds"
                          value={dog.dogId}
                          className="h-5 w-5 accent-purple-500"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dogs/${dog.dogId}`}
                          className="font-semibold text-white underline-offset-4 hover:underline"
                        >
                          {dog.displayName}
                        </Link>
                        <div className="text-xs text-purple-100/55">
                          {dog.regNumber}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-purple-100/75">{dog.sex}</td>
                      <td className="px-3 py-3 text-purple-100/75">
                        {formatAge(dog.ageHours)}
                      </td>
                      <td className="px-3 py-3 text-purple-100/75">
                        {dog.conditioningSnapshot}
                      </td>
                      <td className="rounded-r-2xl px-3 py-3">
                        <form
                          action={`/api/shows/${cluster.id}/enter`}
                          method="post"
                          className="inline-flex"
                        >
                          <input
                            type="hidden"
                            name="judgingBlockId"
                            value={selectedBreed.blockId}
                          />
                          <input
                            type="hidden"
                            name="breedCode2"
                            value={selectedBreed.code2}
                          />
                          <input type="hidden" name="dogId" value={dog.dogId} />
                          <button
                            type="submit"
                            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
                          >
                            Enter ${ENTRY_FEE_PER_SHOW}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
