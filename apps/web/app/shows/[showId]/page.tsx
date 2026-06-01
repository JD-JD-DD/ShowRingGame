import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getShowDistrictRegionName } from "@showring/rules";
import {
  getShowEntryPlanner,
  getShowWeekendEntryPlanStatus,
  listShowEntryBreedOptions,
} from "@/server/services/showEntry.service";

import { ShowEntryPlanner } from "./ShowEntryPlanner";

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

  const cluster = await db.showCluster.findUnique({
    where: { id: showId },
    include: {
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        include: {
          judge: { select: { judgeCode: true, name: true } },
          _count: { select: { showResults: true, showEntries: true } },
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
  const weekendPlanStatus = kennel
    ? await getShowWeekendEntryPlanStatus({
        showId: cluster.id,
        kennelId: kennel.id,
      })
    : null;
  const hasDifferentPrimaryShow = Boolean(
    weekendPlanStatus?.primaryClusterId &&
      weekendPlanStatus.primaryClusterId !== cluster.id
  );
  const showRole = hasDifferentPrimaryShow ? "SECONDARY" : "PRIMARY";
  const breedOptions =
    kennel
      ? await listShowEntryBreedOptions({
          showId: cluster.id,
          kennelId: kennel.id,
          currentEpoch,
        })
      : [];
  const selectedBreed = selectedBreedCode
    ? breedOptions.find((breed) => breed.code2 === selectedBreedCode) ?? null
    : null;
  const planner =
    kennel && selectedBreed
      ? await getShowEntryPlanner({
          showId: cluster.id,
          kennelId: kennel.id,
          breedCode2: selectedBreed.code2,
          currentEpoch,
          selectedDogIds,
        })
      : null;

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
              Choose a breed, then enter each dog for one day or the full cluster.
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
            {getShowDistrictRegionName(cluster.district)}
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

        {kennel && weekendPlanStatus && !weekendPlanStatus.primaryClusterId ? (
          <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-3 text-sm text-purple-100">
            Submitting entries here will make this your primary show for the
            weekend.
          </div>
        ) : null}

        {kennel && weekendPlanStatus?.isPrimaryShow ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            This is your primary show for the weekend. Travel is already planned
            for this show.
          </div>
        ) : null}

        {kennel && hasDifferentPrimaryShow ? (
          <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Your primary show for this weekend is{" "}
            {weekendPlanStatus?.primaryClusterName ?? "another show"}.
            Entries here use traveling handlers, and dogs already entered in
            another show this weekend are not available.
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cluster.showDays.map((day) => (
            <div
              key={day.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  Day {day.dayIndex}
                </div>
                <div
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone(day.status)}`}
                >
                  {day.status}
                </div>
              </div>
              <div className="mt-3 text-sm text-purple-100/75">
                {formatShowDateTime(day.scheduledEpoch)}
              </div>
              <div className="mt-2 text-sm text-purple-100/75">
                Judge:{" "}
                <Link
                  href={`/judges/${day.judge.judgeCode}`}
                  className="font-semibold text-white underline-offset-4 hover:underline"
                >
                  {day.judge.name}
                </Link>
              </div>
              <div className="mt-2 text-xs text-purple-100/50">
                {day._count.showEntries} entered
              </div>
            </div>
          ))}
        </div>

        {!kennel ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
            Log in to enter dogs from your kennel.
          </div>
        ) : breedOptions.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
            No eligible kennel dogs are available for this show.
          </div>
        ) : (
          <div className="mt-6">
            <form
              action={`/shows/${cluster.id}`}
              method="get"
              className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto]"
            >
              {typeof dogIds === "string" && dogIds.trim() ? (
                <input type="hidden" name="dogIds" value={dogIds} />
              ) : null}
              <label className="grid gap-2 text-sm text-purple-100/75">
                Breed to Enter
                <select
                  name="breedCode2"
                  defaultValue={selectedBreed?.code2 ?? ""}
                  className="rounded-xl border border-purple-300/20 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option value="">Choose a breed...</option>
                  {breedOptions.map((breed) => (
                    <option key={breed.code2} value={breed.code2}>
                      {breed.name} ({breed.eligibleDogCount})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="self-end rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Show Dogs
              </button>
            </form>

            {!selectedBreedCode ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
                Choose a breed to see eligible kennel dogs for this show.
              </div>
            ) : selectedBreed && planner && planner.dogs.length > 0 ? (
              <>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">
                      {selectedBreed.name}
                    </h2>
                    <p className="mt-1 text-sm text-purple-100/65">
                      Select one or more show days for each dog.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-purple-100/75">
                    Balance ${kennel.balance.toLocaleString("en-US")}
                  </div>
                </div>
                <ShowEntryPlanner
                  showId={cluster.id}
                  breedCode2={selectedBreed.code2}
                  days={planner.days.map((day) => ({
                    ...day,
                    label: formatShowDateTime(day.scheduledEpoch),
                  }))}
                  dogs={planner.dogs.map((dog) => ({
                    ...dog,
                    ageLabel: formatAge(dog.ageHours),
                  }))}
                  kennelBalance={kennel.balance}
                  homeDistrict={kennel.homeDistrict ?? cluster.district}
                  clusterDistrict={cluster.district}
                  showRole={showRole}
                  travelCostAlreadyPlanned={Boolean(
                    weekendPlanStatus?.primaryClusterId
                  )}
                  existingDogIdsForBreed={planner.existingDogIdsForBreed}
                  initiallySelectedDogIds={[...selectedDogIds]}
                />
              </>
            ) : selectedBreed ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
                No eligible {selectedBreed.name} dogs are available for open days in this show.
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/70">
                No eligible kennel dogs are available for this show.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
