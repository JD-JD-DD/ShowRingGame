"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import {
  MIN_SHOW_AGE_HOURS,
  PUPPY_SALE_MIN_AGE_HOURS,
  getPuppyRehomePayoutForAgeHours,
} from "@showring/rules";

type VisibleCategories = Record<string, number>;

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
    | "Did Not Take"
    | "Whelped"
    | "Post-Whelp Cooldown"
    | "Available for Stud"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
  cooldownInHours: number | null;
};

type KennelDogDto = {
  dogId: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  sex: "M" | "F";
  ageHours: number;
  lifecycleState: string;
  marketState: string;
  kennelRunId: string | null;
  currentRun: {
    id: string;
    name: string;
  } | null;
  healthBadgeStatus: "green" | "yellow" | "red" | null;
  hasAllGreenHealthTests: boolean;
  isListedForSale: boolean;
  isListedAtStud: boolean;
  groomingStatus: {
    dogId: string;
    groomedThisWeek: boolean;
    listedForGrooming: boolean;
    openListingId: string | null;
    currentCoatCondition: number;
    totalGroomingGain: number;
    totalGroomingDecay: number;
    netGroomingImpact: number;
    lastGroomedEpoch: number | null;
    currentGroomingWeek: number;
    groomingStatusLabel:
      | "Groomed this week"
      | "Listed for grooming"
      | "Needs grooming";
  };
  visibleCategories: VisibleCategories;
  breedingCardStatus: BreedingCardStatus;
};

type KennelRunDto = {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  dogCount: number;
};

type KennelDogsResponse = {
  ok: boolean;
  dogs?: KennelDogDto[];
  groomingSummary?: GroomingSummaryDto;
  error?: string;
};

type KennelRunsResponse = {
  ok: boolean;
  runs?: KennelRunDto[];
  error?: string;
};

type GroomingSummaryDto = {
  groomingActionsUsedThisWeek: number;
  groomingActionsRemainingThisWeek: number;
  totalGroomingActionLimit: number;
  currentGroomingWeek: number;
  groomingWeekStartEpoch: number;
  nextGroomingResetEpoch: number;
  selfGroomsCompletedThisWeek: number;
  outsideGroomsCompletedThisWeek: number;
  groomingXp: number;
  groomingLevel: number;
};

type SortKey =
  | "breed"
  | "name"
  | "sex"
  | "age"
  | "typeExpression"
  | "structureBalance"
  | "movement"
  | "coatPresentation"
  | "temperamentRingBehavior"
  | "conditioningHandling";

type BulkAction = "" | "show-entry" | "rehome";
type GroomingStateFilter = "" | "groomed" | "ungroomed";

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function getDogDisplayName(dog: KennelDogDto): string {
  return formatDogDisplayName(dog);
}

function valueForSort(dog: KennelDogDto, key: SortKey): string | number {
  switch (key) {
    case "breed":
      return dog.breedName;
    case "name":
      return getDogDisplayName(dog);
    case "sex":
      return dog.sex;
    case "age":
      return dog.ageHours;
    case "typeExpression":
      return dog.visibleCategories.typeExpression ?? 0;
    case "structureBalance":
      return dog.visibleCategories.structureBalance ?? 0;
    case "movement":
      return dog.visibleCategories.movement ?? 0;
    case "coatPresentation":
      return dog.visibleCategories.coatPresentation ?? 0;
    case "temperamentRingBehavior":
      return dog.visibleCategories.temperamentRingBehavior ?? 0;
    case "conditioningHandling":
      return dog.visibleCategories.conditioningHandling ?? 0;
    default:
      return getDogDisplayName(dog);
  }
}

function colorClassForVisibleValue(value: number): string {
  const distance = Math.abs(value - 10);

  if (distance <= 1.25) return "text-emerald-300";
  if (distance <= 2.5) return "text-lime-300";
  if (distance <= 4) return "text-yellow-300";
  if (distance <= 6) return "text-orange-300";
  return "text-red-300";
}

function StatCell({ value }: { value: number }) {
  return (
    <div className={`text-sm font-semibold ${colorClassForVisibleValue(value)}`}>
      {value.toFixed(1)}
    </div>
  );
}

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) {
    return "Reset available soon";
  }

  const totalMinutes = Math.ceil(msRemaining / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

function GroomingResetCountdown({ resetEpoch }: { resetEpoch: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const resetMs = epochToDate(resetEpoch).getTime();
  const msRemaining = resetMs - nowMs;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="mt-1 font-semibold text-white">
      {formatCountdown(msRemaining)}
    </div>
  );
}

function SortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition ${
        active ? "theme-heading" : "theme-label hover:opacity-80"
      }`}
    >
      <span>{children}</span>
      <span className="text-[10px]">
        {active ? (direction === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </button>
  );
}

export default function KennelDogsPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dogs, setDogs] = useState<KennelDogDto[]>([]);
  const [runs, setRuns] = useState<KennelRunDto[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [groomingSummary, setGroomingSummary] =
    useState<GroomingSummaryDto | null>(null);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [confirmingBulkAction, setConfirmingBulkAction] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [groomingActionDogId, setGroomingActionDogId] = useState<string | null>(
    null
  );
  const [expandedGroomingDogId, setExpandedGroomingDogId] = useState<
    string | null
  >(null);
  const [confirmingGroomingOfferDogId, setConfirmingGroomingOfferDogId] =
    useState<string | null>(null);

  const [breedFilter, setBreedFilter] = useState("");
  const [sexFilter, setSexFilter] = useState<"" | "M" | "F">("");
  const [onlyBreedable, setOnlyBreedable] = useState(false);
  const [onlyForSale, setOnlyForSale] = useState(false);
  const [onlyAtStud, setOnlyAtStud] = useState(false);
  const [groomingStateFilter, setGroomingStateFilter] =
    useState<GroomingStateFilter>("");

  const [sortKey, setSortKey] = useState<SortKey>("breed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function buildDogsUrl(runIds: string[]) {
    const url = new URL("/api/dogs/mine", window.location.origin);

    if (runIds.length === 1) {
      url.searchParams.set("runId", runIds[0]);
    } else if (runIds.length > 1) {
      url.searchParams.set("runIds", runIds.join(","));
    }

    return `${url.pathname}${url.search}`;
  }

  async function loadRuns() {
    setRunsLoading(true);
    setRunError(null);

    try {
      const response = await fetch("/api/kennel/runs", {
        method: "GET",
        cache: "no-store",
      });
      const data: KennelRunsResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load Kennel Runs.");
      }

      const nextRuns = data.runs ?? [];
      setRuns(nextRuns);
      setSelectedRunIds((current) => {
        const validCurrent = current.filter((runId) =>
          nextRuns.some((run) => run.id === runId)
        );

        if (validCurrent.length > 0) {
          return validCurrent;
        }

        const uncategorizedRun = nextRuns.find(
          (run) => run.name === "Uncategorized" && run.isSystem
        );

        return uncategorizedRun ? [uncategorizedRun.id] : [];
      });
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : "Failed to load Kennel Runs."
      );
      setRuns([]);
      setSelectedRunIds([]);
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadDogs(options?: {
    preserveLoadingState?: boolean;
    runIds?: string[];
  }) {
    if (!options?.preserveLoadingState) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        buildDogsUrl(options?.runIds ?? selectedRunIds),
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data: KennelDogsResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load kennel dogs.");
      }

      setDogs(data.dogs ?? []);
      setGroomingSummary(data.groomingSummary ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load kennel dogs."
      );
    } finally {
      if (!options?.preserveLoadingState) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (runsLoading) {
      return;
    }

    if (selectedRunIds.length === 0) {
      setDogs([]);
      setLoading(false);
      return;
    }

    void loadDogs({ runIds: selectedRunIds });
  }, [runsLoading, selectedRunIds]);

  useEffect(() => {
    setSelectedDogIds((current) =>
      current.filter((dogId) => dogs.some((dog) => dog.dogId === dogId))
    );
    setConfirmingGroomingOfferDogId((current) =>
      current && dogs.some((dog) => dog.dogId === current) ? current : null
    );
  }, [dogs]);

  useEffect(() => {
    if (selectedDogIds.length === 0) {
      setBulkAction("");
      setConfirmingBulkAction(false);
    }
  }, [selectedDogIds.length]);

  const breedOptions = useMemo(() => {
    const breedByCode = new Map<
      string,
      { code2: string; name: string; groupName: string | null }
    >();

    for (const dog of dogs) {
      breedByCode.set(dog.breedCode2, {
        code2: dog.breedCode2,
        name: dog.breedName,
        groupName: dog.breedGroupName,
      });
    }

    return [...breedByCode.values()];
  }, [dogs]);

  const filteredDogs = useMemo(() => {
    const list = dogs.filter((dog) => {
      const breedMatch = breedFilter ? dog.breedCode2 === breedFilter : true;
      const sexMatch = sexFilter ? dog.sex === sexFilter : true;

      const breedableMatch = onlyBreedable
        ? dog.breedingCardStatus.label === "Open" ||
          dog.breedingCardStatus.label === "Available for Stud"
        : true;

      const forSaleMatch = onlyForSale ? dog.isListedForSale : true;
      const atStudMatch = onlyAtStud ? dog.isListedAtStud : true;
      const groomingMatch =
        groomingStateFilter === "groomed"
          ? dog.groomingStatus.groomedThisWeek
          : groomingStateFilter === "ungroomed"
            ? !dog.groomingStatus.groomedThisWeek
        : true;

      return (
        breedMatch &&
        sexMatch &&
        breedableMatch &&
        forSaleMatch &&
        atStudMatch &&
        groomingMatch
      );
    });

    list.sort((a, b) => {
      const aValue = valueForSort(a, sortKey);
      const bValue = valueForSort(b, sortKey);

      let comparison = 0;

      if (typeof aValue === "number" && typeof bValue === "number") {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [
    dogs,
    breedFilter,
    sexFilter,
    onlyBreedable,
    onlyForSale,
    onlyAtStud,
    groomingStateFilter,
    sortKey,
    sortDirection,
  ]);

  const selectedDogs = useMemo(() => {
    const selected = new Set(selectedDogIds);
    return dogs.filter((dog) => selected.has(dog.dogId));
  }, [dogs, selectedDogIds]);

  const selectedDogsQuery = selectedDogIds.join(",");
  const selectedRuns = runs.filter((run) => selectedRunIds.includes(run.id));
  const allRunsSelected =
    runs.length > 0 && selectedRunIds.length === runs.length;
  const selectedRunNames = selectedRuns.map((run) => run.name);
  const viewingLabel =
    selectedRuns.length === 1
      ? `Viewing: ${selectedRuns[0].name}`
      : selectedRuns.length > 1
        ? `Viewing: ${selectedRuns.length} runs`
        : "Viewing: Kennel Runs";
  const selectedRunSummary =
    selectedRunNames.length > 1 ? selectedRunNames.join(", ") : "";
  const filtersActive =
    Boolean(breedFilter) ||
    Boolean(sexFilter) ||
    onlyBreedable ||
    onlyForSale ||
    onlyAtStud ||
    Boolean(groomingStateFilter);
  const selectedRehomeCredits = selectedDogs.reduce(
    (total, dog) =>
      total + getPuppyRehomePayoutForAgeHours(dog.ageHours),
    0
  );
  const canBulkRehome =
    selectedDogs.length > 0 &&
    selectedDogs.every(
      (dog) =>
        dog.ageHours >= PUPPY_SALE_MIN_AGE_HOURS &&
        dog.lifecycleState === "ALIVE"
    );
  const canApplyBulkAction =
    bulkAction === "show-entry" ||
    (bulkAction === "rehome" && canBulkRehome && !bulkActionLoading);
  const filteredDogIds = filteredDogs.map((dog) => dog.dogId);
  const selectedVisibleDogCount = filteredDogIds.filter((dogId) =>
    selectedDogIds.includes(dogId)
  ).length;
  const allFilteredDogsSelected =
    filteredDogIds.length > 0 &&
    filteredDogIds.every((dogId) => selectedDogIds.includes(dogId));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "age" ? "desc" : "asc");
  }

  function toggleDogSelection(dogId: string) {
    setConfirmingBulkAction(false);
    setSelectedDogIds((current) =>
      current.includes(dogId)
        ? current.filter((selectedDogId) => selectedDogId !== dogId)
        : [...current, dogId]
    );
  }

  function toggleVisibleSelection() {
    const visibleIdSet = new Set(filteredDogIds);

    if (allFilteredDogsSelected) {
      setConfirmingBulkAction(false);
      setSelectedDogIds((current) =>
        current.filter((dogId) => !visibleIdSet.has(dogId))
      );
      return;
    }

    setConfirmingBulkAction(false);
    setSelectedDogIds((current) =>
      Array.from(new Set([...current, ...filteredDogIds]))
    );
  }

  function clearSelection() {
    setSelectedDogIds([]);
    setBulkAction("");
    setConfirmingBulkAction(false);
  }

  function clearAllFilters() {
    setBreedFilter("");
    setSexFilter("");
    setOnlyBreedable(false);
    setOnlyForSale(false);
    setOnlyAtStud(false);
    setGroomingStateFilter("");
  }

  function selectUncategorizedRun() {
    const uncategorizedRun = runs.find(
      (run) => run.name === "Uncategorized" && run.isSystem
    );

    setSelectedRunIds(uncategorizedRun ? [uncategorizedRun.id] : []);
    clearSelection();
  }

  function selectAllRuns() {
    setSelectedRunIds(runs.map((run) => run.id));
    clearSelection();
  }

  function toggleRunSelection(runId: string) {
    setSelectedRunIds((current) => {
      if (current.includes(runId)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((selectedRunId) => selectedRunId !== runId);
      }

      return [...current, runId];
    });
    clearSelection();
  }

  function updateBulkAction(action: BulkAction) {
    setBulkAction(action);
    setConfirmingBulkAction(false);
  }

  function applyBulkAction() {
    if (!canApplyBulkAction) {
      return;
    }

    if (bulkAction === "show-entry") {
      router.push(`/shows?dogIds=${encodeURIComponent(selectedDogsQuery)}`);
      return;
    }

    if (bulkAction === "rehome") {
      setConfirmingBulkAction(true);
    }
  }

  async function runGroomingAction(args: {
    dogId: string;
    endpoint: string;
  }) {
    if (groomingActionDogId) {
      return;
    }

    if (
      args.endpoint === "/api/services/grooming/self-groom" &&
      (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) <= 0
    ) {
      setError("No grooming actions remaining this week.");
      setExpandedGroomingDogId(null);
      return;
    }

    setGroomingActionDogId(args.dogId);
    setExpandedGroomingDogId(null);
    setConfirmingGroomingOfferDogId(null);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(args.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dogId: args.dogId }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to update grooming status.");
      }

      setMessage(data.message ?? "Grooming status updated.");
      await loadDogs({ preserveLoadingState: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update grooming status."
      );
    } finally {
      setGroomingActionDogId(null);
    }
  }

  async function rehomeSelectedDogs() {
    if (!canBulkRehome || bulkActionLoading) {
      return;
    }

    setBulkActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/dogs/bulk-rehome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dogIds: selectedDogIds }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        rehomedCount?: number;
        creditsAdded?: number;
        dogIds?: string[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to re-home selected dogs.");
      }

      const rehomedIds = new Set(data.dogIds ?? selectedDogIds);
      setDogs((current) =>
        current.filter((dog) => !rehomedIds.has(dog.dogId))
      );
      setSelectedDogIds([]);
      setBulkAction("");
      setConfirmingBulkAction(false);
      router.refresh();
      const creditsAdded = data.creditsAdded ?? 0;
      setMessage(
        `Re-homed ${data.rehomedCount ?? rehomedIds.size} dog(s).${
          creditsAdded > 0
            ? ` Added $${creditsAdded.toLocaleString()} to your ledger.`
            : ""
        }`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to re-home selected dogs."
      );
    } finally {
      setBulkActionLoading(false);
    }
  }

  return (
    <section className="theme-panel rounded-[28px] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="theme-label text-sm font-semibold uppercase tracking-[0.18em]">
            My Dogs
          </div>
          <h2 className="theme-heading mt-2 text-2xl font-semibold">
            Kennel Roster
          </h2>
          <p className="theme-copy mt-2 text-sm leading-7">
            Sort, filter, and compare your dogs in one working roster.
          </p>
        </div>
      </div>

      {groomingSummary ? (
        <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                Grooming Assistance
              </div>
              <p className="theme-copy mt-2 text-sm leading-6">
                Grooming actions used this week:{" "}
                {groomingSummary.groomingActionsUsedThisWeek} /{" "}
                {groomingSummary.totalGroomingActionLimit}. Own dogs groomed:{" "}
                {groomingSummary.selfGroomsCompletedThisWeek}. Outside jobs
                completed: {groomingSummary.outsideGroomsCompletedThisWeek}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="theme-card rounded-xl px-3 py-2">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Remaining
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {groomingSummary.groomingActionsRemainingThisWeek}
                </div>
              </div>
              <div className="theme-card rounded-xl px-3 py-2">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Next Reset
                </div>
                <GroomingResetCountdown
                  resetEpoch={groomingSummary.nextGroomingResetEpoch}
                />
              </div>
              <div className="theme-card rounded-xl px-3 py-2">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Level
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {groomingSummary.groomingLevel}
                </div>
              </div>
              <div className="theme-card rounded-xl px-3 py-2">
                <div className="theme-label text-xs uppercase tracking-wide">
                  XP
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {groomingSummary.groomingXp}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)] xl:items-start">
        <aside className="theme-card order-1 rounded-2xl p-4 xl:order-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
            Kennel Runs
          </div>
          <p className="theme-copy mt-2 text-sm leading-6">
            Choose one or more runs to view.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAllRuns}
              disabled={runs.length === 0}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                allRunsSelected
                  ? "border-sky-200/70 bg-sky-500/20 text-sky-100"
                  : "theme-secondary-button"
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              Select All Runs
            </button>
            <button
              type="button"
              onClick={selectUncategorizedRun}
              disabled={runs.length === 0}
              className="theme-secondary-button rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Uncategorized
            </button>
          </div>

          {runError ? (
            <button
              type="button"
              onClick={() => void loadRuns()}
              disabled={runsLoading}
              className="theme-secondary-button mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {runsLoading ? "Refreshing..." : "Retry"}
            </button>
          ) : null}

          {runsLoading ? (
            <div className="theme-copy mt-4 rounded-lg border border-white/10 px-3 py-3 text-sm">
              Loading runs...
            </div>
          ) : runError ? (
            <div className="mt-4 rounded-lg border border-red-300/25 bg-red-500/10 px-3 py-3 text-sm text-red-100">
              {runError}
            </div>
          ) : runs.length === 0 ? (
            <div className="theme-copy mt-4 rounded-lg border border-white/10 px-3 py-3 text-sm">
              No runs available.
            </div>
          ) : (
            <div className="mt-4 grid max-h-[360px] gap-1.5 overflow-y-auto pr-1 xl:max-h-[calc(100vh-260px)]">
              {runs.map((run) => {
                const selected = selectedRunIds.includes(run.id);

                return (
                  <button
                    key={run.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleRunSelection(run.id)}
                    className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                      selected
                        ? "border-fuchsia-200/70 bg-fuchsia-500/20 text-fuchsia-100"
                        : "theme-neutral-badge hover:opacity-80"
                    }`}
                  >
                    <span className="truncate">{run.name}</span>
                    <span className="shrink-0 tabular-nums">
                      {run.dogCount}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <aside className="theme-card order-2 rounded-2xl p-4 xl:order-1">
          <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
            Filters
          </div>
          <div className="theme-copy mt-2 text-xs leading-5">
            Narrow the selected run view.
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Breed
              </span>
              <select
                value={breedFilter}
                onChange={(e) => setBreedFilter(e.target.value)}
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Breeds</option>
                <BreedSelectOptions options={breedOptions} />
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Sex
              </span>
              <select
                value={sexFilter}
                onChange={(e) => setSexFilter(e.target.value as "" | "M" | "F")}
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Sexes</option>
                <option value="M">Dogs</option>
                <option value="F">Bitches</option>
              </select>
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyBreedable}
                onChange={(e) => setOnlyBreedable(e.target.checked)}
              />
              Breedable
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyForSale}
                onChange={(e) => setOnlyForSale(e.target.checked)}
              />
              For Sale
            </label>

            <label className="theme-control flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={onlyAtStud}
                onChange={(e) => setOnlyAtStud(e.target.checked)}
              />
              At Stud
            </label>

            <label className="grid gap-1.5">
              <span className="theme-label text-[0.7rem] uppercase tracking-wide">
                Grooming
              </span>
              <select
                value={groomingStateFilter}
                onChange={(e) =>
                  setGroomingStateFilter(e.target.value as GroomingStateFilter)
                }
                className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">All Grooming</option>
                <option value="groomed">Groomed</option>
                <option value="ungroomed">Ungroomed</option>
              </select>
            </label>

            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!filtersActive}
              className="theme-secondary-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear All Filters
            </button>
          </div>
        </aside>

        <main className="order-3 min-w-0 xl:order-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
                {viewingLabel}
              </div>
              <div className="theme-copy mt-1 text-sm">
                {filteredDogs.length} visible dog
                {filteredDogs.length === 1 ? "" : "s"}
              </div>
              {selectedRunSummary ? (
                <div className="theme-copy mt-1 max-w-xl truncate text-xs">
                  {selectedRunSummary}
                </div>
              ) : null}
            </div>
          </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <div className="theme-card mb-4 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="theme-heading text-sm font-semibold">
            Selection
          </div>
          <div className="theme-copy mt-1 text-xs">
            {selectedDogIds.length} selected
            {filteredDogs.length > 0
              ? `, ${selectedVisibleDogCount} visible under current filters`
              : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleVisibleSelection}
            disabled={filteredDogs.length === 0}
            className="rounded-xl border border-purple-300/25 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {allFilteredDogsSelected ? "Deselect Filtered" : "Select All Filtered"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedDogIds.length === 0}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {selectedDogIds.length > 0 ? (
        <div className="theme-card mb-4 rounded-2xl p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="theme-heading text-sm font-semibold">
                {selectedDogIds.length} selected
              </div>
              <div className="theme-copy mt-1 text-xs">
                Choose a bulk action, then apply it.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
              <select
                value={bulkAction}
                onChange={(event) =>
                  updateBulkAction(event.target.value as BulkAction)
                }
                className="theme-control rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="">Bulk action...</option>
                <option value="show-entry">Show Entry</option>
                <option value="rehome">Re-Home</option>
              </select>

              <button
                type="button"
                onClick={applyBulkAction}
                disabled={!canApplyBulkAction}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {bulkAction === "show-entry"
                  ? "Continue"
                  : bulkActionLoading
                    ? "Updating..."
                    : "Apply Action"}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          </div>

          {bulkAction === "rehome" && !canBulkRehome ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Only dogs at least 8 weeks old that are active and owned by your
              kennel can be re-homed in bulk. Sale and stud listings do not
              need to be removed first.
            </div>
          ) : null}

          {confirmingBulkAction && bulkAction === "rehome" ? (
            <div className="mt-3 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-red-100">
                Re-home selected dogs?
              </div>
              <div className="mt-1 text-sm leading-6 text-red-100/75">
                This cannot be undone. The selected dogs, even if they are for
                sale or at stud, will leave your kennel and you will no longer
                be able to use them.
              </div>
              <div className="mt-2 text-sm text-red-100/75">
                You are about to re-home {selectedDogIds.length} dog
                {selectedDogIds.length === 1 ? "" : "s"}.
              </div>
              {selectedRehomeCredits > 0 ? (
                <div className="mt-2 text-sm font-semibold text-emerald-100">
                  Expected kennel ledger credit: $
                  {selectedRehomeCredits.toLocaleString()}.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={rehomeSelectedDogs}
                  disabled={bulkActionLoading}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {bulkActionLoading
                    ? "Re-Homing..."
                    : "Yes, Re-Home Selected Dogs"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingBulkAction(false)}
                  className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  Keep Dogs
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="theme-card theme-copy rounded-2xl px-4 py-6 text-sm">
          Loading kennel dogs...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-6 text-sm text-red-100">
          {error}
        </div>
      ) : filteredDogs.length === 0 ? (
        <div className="theme-card theme-copy rounded-2xl px-4 py-6 text-sm">
          {dogs.length === 0 && !filtersActive
            ? "This run is empty."
            : "No dogs match the current filters."}
        </div>
      ) : (
        <div className="overflow-x-auto pb-1 touch-pan-x">
          <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-y-2 text-sm">
            <caption className="theme-label mb-2 caption-top text-left text-xs uppercase tracking-[0.16em]">
              Main categories: 0–20 directional · 10 ideal; Cond/Handling: 0–10 · 10 optimized
            </caption>
            <thead>
              <tr className="theme-label text-left text-xs uppercase tracking-[0.16em]">
                <th className="w-10 px-2 py-2">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className="text-purple-200/80 transition hover:text-white"
                  >
                    Select
                  </button>
                </th>
                <th className="w-[58px] px-2 py-2 text-center">Open</th>
                <th className="w-[12%] px-2 py-2">
                  <SortButton
                    active={sortKey === "breed"}
                    direction={sortDirection}
                    onClick={() => toggleSort("breed")}
                  >
                    Breed
                  </SortButton>
                </th>
                <th className="w-[18%] px-2 py-2">
                  <SortButton
                    active={sortKey === "name"}
                    direction={sortDirection}
                    onClick={() => toggleSort("name")}
                  >
                    Dog
                  </SortButton>
                </th>
                <th className="w-12 px-2 py-2">
                  <SortButton
                    active={sortKey === "sex"}
                    direction={sortDirection}
                    onClick={() => toggleSort("sex")}
                  >
                    Sex
                  </SortButton>
                </th>
                <th className="w-16 px-2 py-2">
                  <SortButton
                    active={sortKey === "age"}
                    direction={sortDirection}
                    onClick={() => toggleSort("age")}
                  >
                    Age
                  </SortButton>
                </th>
                <th className="w-14 px-2 py-2">
                  <SortButton
                    active={sortKey === "typeExpression"}
                    direction={sortDirection}
                    onClick={() => toggleSort("typeExpression")}
                  >
                    Type
                  </SortButton>
                </th>
                <th className="w-16 px-2 py-2">
                  <SortButton
                    active={sortKey === "structureBalance"}
                    direction={sortDirection}
                    onClick={() => toggleSort("structureBalance")}
                  >
                    Struct.
                  </SortButton>
                </th>
                <th className="w-14 px-2 py-2">
                  <SortButton
                    active={sortKey === "movement"}
                    direction={sortDirection}
                    onClick={() => toggleSort("movement")}
                  >
                    Move.
                  </SortButton>
                </th>
                <th className="w-14 px-2 py-2">
                  <SortButton
                    active={sortKey === "coatPresentation"}
                    direction={sortDirection}
                    onClick={() => toggleSort("coatPresentation")}
                  >
                    Coat
                  </SortButton>
                </th>
                <th className="w-14 px-2 py-2">
                  <SortButton
                    active={sortKey === "temperamentRingBehavior"}
                    direction={sortDirection}
                    onClick={() => toggleSort("temperamentRingBehavior")}
                  >
                    Temp.
                  </SortButton>
                </th>
                <th className="w-14 px-2 py-2">
                  <SortButton
                    active={sortKey === "conditioningHandling"}
                    direction={sortDirection}
                    onClick={() => toggleSort("conditioningHandling")}
                  >
                    Prep
                  </SortButton>
                </th>
                <th className="w-[118px] px-2 py-2 text-center">Groom</th>
              </tr>
            </thead>

            <tbody>
              {filteredDogs.map((dog) => {
                const dogHref = `/dogs/${dog.dogId}`;
                const groomingBusy = groomingActionDogId === dog.dogId;
                const hasOpenGroomingListing = Boolean(
                  dog.groomingStatus.openListingId
                );
                const canUseGroomingAction =
                  (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) > 0;
                const noGroomingActionsRemaining = !canUseGroomingAction;
                const isGroomingAgeEligible =
                  dog.ageHours >= MIN_SHOW_AGE_HOURS;
                const groomDisabled =
                  !isGroomingAgeEligible ||
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  !canUseGroomingAction ||
                  groomingBusy;
                const offerDisabled =
                  !isGroomingAgeEligible ||
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  groomingBusy;
                const groomingAgeTitle = isGroomingAgeEligible
                  ? undefined
                  : "Dogs must be show eligible age before grooming.";
                const groomingCapacityTitle = noGroomingActionsRemaining
                  ? "No grooming actions remaining this week."
                  : undefined;
                const groomingSelfActionTitle =
                  groomingAgeTitle ?? groomingCapacityTitle;
                const groomingMenuTitle =
                  groomingAgeTitle ??
                  (noGroomingActionsRemaining && offerDisabled
                    ? groomingCapacityTitle
                    : undefined);
                const groomingMenuOpen = expandedGroomingDogId === dog.dogId;
                const groomingOfferConfirmOpen =
                  confirmingGroomingOfferDogId === dog.dogId;
                const groomingMenuDisabled = groomDisabled && offerDisabled;
                const groomingMenuId = `grooming-actions-${dog.dogId}`;
                const groomingMenuLabel =
                  noGroomingActionsRemaining && !offerDisabled
                    ? "Offer"
                    : "Groom";

                return (
                  <Fragment key={dog.dogId}>
                  <tr
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(dogHref)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(dogHref);
                      }
                    }}
                    className="theme-card-interactive cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-purple-300/45"
                  >
                    <td className="rounded-l-2xl px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedDogIds.includes(dog.dogId)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={() => toggleDogSelection(dog.dogId)}
                        aria-label={`Select ${getDogDisplayName(dog)}`}
                      />
                    </td>

                    <td className="px-2 py-2 text-center">
                      <Link
                        href={dogHref}
                        aria-label={`View ${dog.callName ?? dog.regNumber}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="inline-flex rounded-lg border border-purple-300/25 bg-purple-500/10 px-2 py-1 text-[0.68rem] font-semibold text-purple-100 transition hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-purple-300/45"
                      >
                        Open
                      </Link>
                    </td>

                  <td className="theme-heading px-2 py-2 font-medium">
                    <div className="truncate text-xs leading-4">
                      {dog.breedName}
                    </div>
                  </td>

                  <td className="theme-heading px-2 py-2 font-medium">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{getDogDisplayName(dog)}</span>
                      <DogStatusBadges
                        healthStatus={dog.healthBadgeStatus}
                        fullHealthClearance={dog.hasAllGreenHealthTests}
                        isListedForSale={dog.isListedForSale}
                        isListedAtStud={dog.isListedAtStud}
                      />
                    </div>
                    {selectedRuns.length > 1 && dog.currentRun ? (
                      <div className="theme-copy mt-0.5 truncate text-[0.68rem]">
                        {dog.currentRun.name}
                      </div>
                    ) : null}
                  </td>

                  <td className="theme-heading px-2 py-2">{dog.sex}</td>
                  <td className="theme-heading px-2 py-2">
                    {formatAge(dog.ageHours)}
                  </td>

                  <td className="px-2 py-2">
                    <StatCell value={dog.visibleCategories.typeExpression ?? 0} />
                  </td>
                  <td className="px-2 py-2">
                    <StatCell value={dog.visibleCategories.structureBalance ?? 0} />
                  </td>
                  <td className="px-2 py-2">
                    <StatCell value={dog.visibleCategories.movement ?? 0} />
                  </td>
                  <td className="px-2 py-2">
                    <StatCell value={dog.visibleCategories.coatPresentation ?? 0} />
                  </td>
                  <td className="px-2 py-2">
                    <StatCell
                      value={dog.visibleCategories.temperamentRingBehavior ?? 0}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <StatCell
                      value={dog.visibleCategories.conditioningHandling ?? 0}
                    />
                  </td>

                  <td className="rounded-r-2xl px-2 py-2">
                    <div className="grid gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedGroomingDogId((current) =>
                            current === dog.dogId ? null : dog.dogId
                          );
                          setConfirmingGroomingOfferDogId(null);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        disabled={groomingMenuDisabled}
                        title={groomingMenuTitle}
                        aria-expanded={groomingMenuOpen}
                        aria-controls={groomingMenuId}
                        className="w-full rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[0.7rem] font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {groomingMenuLabel}
                      </button>
                      {groomingMenuOpen ? (
                        <div id={groomingMenuId} className="grid gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void runGroomingAction({
                                dogId: dog.dogId,
                                endpoint: "/api/services/grooming/self-groom",
                              });
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            disabled={groomDisabled}
                            title={groomingSelfActionTitle}
                            className="w-full rounded-md border border-amber-300/20 bg-black/20 px-2 py-1 text-[0.64rem] font-semibold text-amber-100 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {noGroomingActionsRemaining
                              ? "No Grooming Left"
                              : "Groom yourself"}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmingGroomingOfferDogId(dog.dogId);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            disabled={offerDisabled}
                            title={groomingAgeTitle}
                            className="w-full rounded-md border border-sky-300/20 bg-sky-500/10 px-2 py-1 text-[0.64rem] font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            Offer for grooming
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
                  {groomingOfferConfirmOpen ? (
                    <tr className="theme-card">
                      <td colSpan={13} className="rounded-2xl px-4 py-3">
                        <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 p-3">
                          <div className="text-sm font-semibold text-sky-100">
                            Offer this dog for outside grooming?
                          </div>
                          <p className="mt-1 text-xs leading-5 text-sky-50/80">
                            Offer {getDogDisplayName(dog)} for outside
                            grooming? This dog will be listed for another
                            player to groom.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void runGroomingAction({
                                  dogId: dog.dogId,
                                  endpoint: "/api/services/grooming/list",
                                });
                              }}
                              disabled={groomingBusy || offerDisabled}
                              className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {groomingBusy
                                ? "Offering..."
                                : "Yes, Offer for Grooming"}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setConfirmingGroomingOfferDogId(null);
                              }}
                              disabled={groomingBusy}
                              className="theme-secondary-button rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              Keep Dog Here
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </main>
      </div>
    </section>
  );
}
