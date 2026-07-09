import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getDogShowEntryPlanner,
  type DogShowEntryPlannerClusterDto,
  type DogShowEntryPlannerDayDto,
  type DogShowEntryPlannerDogDto,
  type DogShowEntryQuotePreviewDto,
} from "@/server/services/dogShowEntryPlanner.service";
import { getKennelForUser } from "@/server/services/kennel.service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ dogId: string }>;
};

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function formatState(value: string): string {
  return value
    .split("_")
    .map((part) => part.slice(0, 1) + part.slice(1).toLowerCase())
    .join(" ");
}

function badgeTone(tone: "green" | "amber" | "red" | "sky" | "neutral") {
  switch (tone) {
    case "green":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "amber":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "red":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    case "sky":
      return "border-sky-300/25 bg-sky-500/10 text-sky-100";
    case "neutral":
      return "theme-neutral-badge";
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--dog-border)] bg-purple-500/10 px-3 py-2">
      <div className="theme-label text-[0.68rem] uppercase tracking-[0.14em]">
        {label}
      </div>
      <div className="theme-heading mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red" | "sky" | "neutral";
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeTone(
        tone
      )}`}
    >
      {children}
    </span>
  );
}

function DogSnapshot({ dog }: { dog: DogShowEntryPlannerDogDto }) {
  return (
    <aside className="dog-panel rounded-[28px] px-5 py-5">
      <Link
        href={`/dogs/${dog.dogId}`}
        className="theme-secondary-button inline-flex rounded-xl px-3 py-2 text-sm font-semibold"
      >
        Back to Dog Profile
      </Link>

      <div className="mt-5">
        <p className="theme-label text-xs uppercase tracking-[0.18em]">
          Show Entry
        </p>
        <h1 className="theme-heading mt-2 text-3xl font-bold tracking-tight">
          {dog.displayName}
        </h1>
        <div className="theme-copy mt-2 text-sm">{dog.regNumber}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge tone={dog.broadCanShow ? "green" : "amber"}>
          {dog.broadCanShow ? "Broadly show eligible" : "Not broadly show eligible"}
        </StatusBadge>
        {dog.hasPendingEmergencyCare ? (
          <StatusBadge tone="red">Emergency care pending</StatusBadge>
        ) : null}
        {dog.isPregnant ? <StatusBadge tone="amber">Pregnant</StatusBadge> : null}
      </div>

      <div className="mt-5 grid gap-3">
        <DetailRow label="Registered Name" value={dog.registeredName} />
        <DetailRow label="Call Name" value={dog.callName} />
        <DetailRow label="Breed" value={dog.breedName} />
        <DetailRow label="Sex" value={dog.sex === "M" ? "Dog" : "Bitch"} />
        <DetailRow label="Age" value={formatAge(dog.ageHours)} />
        <DetailRow label="Lifecycle" value={formatState(dog.lifecycleState)} />
        <DetailRow label="Market" value={formatState(dog.marketState)} />
        <DetailRow label="Current Run" value={dog.currentRun?.name ?? null} />
        <DetailRow
          label="Last Whelped Epoch"
          value={dog.lastWhelpedEpoch ?? null}
        />
        <DetailRow label="Coat Condition" value={dog.coatCondition.toFixed(2)} />
        <DetailRow label="Fatigue" value={dog.fatiguePoints} />
      </div>
    </aside>
  );
}

function QuotePreview({
  quote,
}: {
  quote: DogShowEntryQuotePreviewDto;
}) {
  if (!quote) {
    return (
      <div className="theme-copy rounded-xl border border-[var(--dog-border)] bg-black/10 px-3 py-2 text-sm">
        No selectable days in this show, so no cost preview is available.
      </div>
    );
  }

  return (
    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <DetailRow label="Preview Days" value={quote.selectedDayCount} />
      <DetailRow label="Entry Fees" value={formatMoney(quote.entryFees)} />
      <DetailRow label="Travel" value={formatMoney(quote.travelCost)} />
      <DetailRow label="Handler" value={formatMoney(quote.handlerFee)} />
      <DetailRow label="Estimated Total" value={formatMoney(quote.estimatedTotalCost)} />
      <DetailRow label="Balance After" value={formatMoney(quote.balanceAfter)} />
      <DetailRow
        label="Travel Status"
        value={quote.travelCostAlreadyCovered ? "Already covered" : "New trip"}
      />
      <DetailRow
        label="Entry Type"
        value={quote.isSecondaryEntry ? "Travel entry" : "Primary show entry"}
      />
    </div>
  );
}

function DayStatus({ day }: { day: DogShowEntryPlannerDayDto }) {
  const tone = day.canSelect
    ? "green"
    : day.alreadyEntered
      ? "sky"
      : day.sameWeekendConflict
        ? "amber"
        : "neutral";

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        day.canSelect
          ? "border-emerald-300/30 bg-emerald-500/10"
          : "border-[var(--dog-border)] bg-black/10 opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="theme-heading text-sm font-semibold">
            Day {day.dayIndex}
          </div>
          <div className="theme-copy mt-0.5 text-xs">{day.label}</div>
          <div className="theme-copy mt-0.5 text-xs">Judge: {day.judgeName}</div>
        </div>
        <StatusBadge tone={tone}>
          {day.canSelect
            ? "Selectable"
            : day.alreadyEntered
              ? "Entered"
              : "Unavailable"}
        </StatusBadge>
      </div>
      {day.disabledReason ? (
        <div className="mt-2 text-xs font-medium text-[var(--dog-copy)]">
          {day.disabledReason}
        </div>
      ) : null}
      {day.sameWeekendConflict ? (
        <div className="mt-2 text-xs text-amber-100">
          Same-weekend conflict: {day.sameWeekendConflict.clusterName}
        </div>
      ) : null}
    </div>
  );
}

function ShowClusterCard({
  cluster,
}: {
  cluster: DogShowEntryPlannerClusterDto;
}) {
  return (
    <article
      className={`theme-card rounded-2xl p-4 ${
        cluster.hasSelectableDays ? "" : "opacity-80"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="theme-heading text-xl font-semibold">{cluster.name}</h2>
            <StatusBadge tone={cluster.hasSelectableDays ? "green" : "neutral"}>
              {cluster.hasSelectableDays ? "Selectable days" : "No selectable days"}
            </StatusBadge>
            {cluster.dogAlreadyEnteredInCluster ? (
              <StatusBadge tone="sky">Dog entered</StatusBadge>
            ) : null}
            {cluster.kennelRepresentedInCluster ? (
              <StatusBadge tone="sky">Kennel represented</StatusBadge>
            ) : null}
          </div>
          <div className="theme-copy mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>{cluster.weekendKey}</span>
            <span>{cluster.districtName}</span>
            <span>{cluster.entryStatusMessage}</span>
          </div>
        </div>
      </div>

      {cluster.entryImpact.notice ? (
        <div className="mt-3 rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
          {cluster.entryImpact.notice}
        </div>
      ) : null}

      {cluster.disabledReason ? (
        <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {cluster.disabledReason}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {cluster.days.map((day) => (
          <DayStatus key={day.showDayId} day={day} />
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--dog-border)] pt-4">
        <div className="theme-label mb-2 text-xs uppercase tracking-[0.14em]">
          Cost Preview
        </div>
        <QuotePreview quote={cluster.quotePreview} />
      </div>
    </article>
  );
}

export default async function DogShowEntryPage({ params }: PageProps) {
  const [{ dogId }, userId] = await Promise.all([
    params,
    getSessionUserId(),
  ]);

  if (!userId) redirect("/login");

  const kennel = await getKennelForUser(userId);
  if (!kennel) redirect("/onboarding");

  const currentEpoch = getCurrentEpoch();
  let planner;

  try {
    planner = await getDogShowEntryPlanner({
      kennelId: kennel.id,
      dogId,
      currentEpoch,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Dog not found for this kennel."
    ) {
      notFound();
    }

    throw error;
  }

  return (
    <main className="dog-page min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <DogSnapshot dog={planner.dog} />

        <section className="dog-panel rounded-[28px] px-5 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="theme-label text-xs uppercase tracking-[0.18em]">
                Open Shows
              </p>
              <h2 className="theme-heading mt-2 text-3xl font-bold tracking-tight">
                Entry Planner
              </h2>
              <p className="theme-copy mt-2 max-w-2xl text-sm leading-6">
                This read-only preview shows currently open shows and why each
                day is or is not available for this dog.
              </p>
            </div>
            <div className="theme-neutral-badge rounded-full px-3 py-1 text-sm">
              {planner.clusters.length} open show
              {planner.clusters.length === 1 ? "" : "s"}
            </div>
          </div>

          {planner.clusters.length === 0 ? (
            <div className="theme-card theme-copy mt-6 rounded-2xl px-4 py-5 text-sm">
              No shows are currently open for entry.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {planner.clusters.map((cluster) => (
                <ShowClusterCard key={cluster.showId} cluster={cluster} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
