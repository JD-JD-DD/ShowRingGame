import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  getDogShowEntryPlanner,
  type DogShowEntryPlannerDogDto,
} from "@/server/services/dogShowEntryPlanner.service";
import { getKennelForUser } from "@/server/services/kennel.service";

import { DogShowEntryPlannerClient } from "./DogShowEntryPlannerClient";

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
        <DogShowEntryPlannerClient planner={planner} />
      </div>
    </main>
  );
}
