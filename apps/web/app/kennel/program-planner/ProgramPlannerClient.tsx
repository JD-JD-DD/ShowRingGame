"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";

type TagType =
  | "KEEP"
  | "WATCH"
  | "SELL_CANDIDATE"
  | "REHOME_CANDIDATE"
  | "NO_ACTION";

type VisibleCategoryKey =
  | "typeExpression"
  | "structureBalance"
  | "movement"
  | "coatPresentation"
  | "temperamentRingBehavior"
  | "conditioningHandling";

type PlannerDog = {
  dogId: string;
  displayName: string;
  titledName: string;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  ageHours: number;
  ageLabel: string;
  ageClass: string;
  lifecycleState: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  ownerName: string | null;
  breederName: string | null;
  litter: { id: string; serial7: string; bornEpoch: number } | null;
  sire: { id: string; displayName: string; regNumber: string } | null;
  dam: { id: string; displayName: string; regNumber: string } | null;
  visibleCategories: Record<VisibleCategoryKey, number>;
  healthSummary: {
    status: "too_young" | "eligible_incomplete" | "complete" | "concern";
    label: string;
    eligibleCount: number;
    completeCount: number;
    concernCount: number;
  };
  showSummary: {
    label: string;
    showEntryCount: number;
    pointCount: number;
    majorCount: number;
    isChampion: boolean;
    isPointed: boolean;
    isShowEligible: boolean;
  };
  breedingSummary: {
    label: string;
    canBreed: boolean;
    alreadyBred: boolean;
    pregnant: boolean;
    cooldown: boolean;
    recentLitter: boolean;
    championOffspringCount: number;
  };
  marketSummary: {
    label: string;
    marketState: string;
    isListedForSale: boolean;
    isListedAtStud: boolean;
  };
  goalFitLabel: string;
  reasonTags: string[];
  warningTags: string[];
  existingPlannerTag: {
    id: string;
    tagType: TagType;
    goalKey: string;
    note: string | null;
    isVisibleOnDogPage: boolean;
    updatedAt: string;
  } | null;
};

type PlannerData = {
  availableBreeds: Array<{
    breedCode2: string;
    breedName: string;
    breedGroupName: string | null;
    count: number;
  }>;
  selectedBreed: {
    breedCode2: string;
    breedName: string;
    breedGroupName: string | null;
    count: number;
  } | null;
  selectedGoalKey: string | null;
  availableGoals: Array<{ key: string; label: string }>;
  categoryLabels: Record<VisibleCategoryKey, string>;
  snapshot: {
    totalDogs: number;
    males: number;
    females: number;
    puppies: number;
    juniors: number;
    adults: number;
    veterans: number;
    champions: number;
    pointed: number;
    unshown: number;
    healthComplete: number;
    healthIncomplete: number;
    healthConcern: number;
    healthTooYoung: number;
    breedingAgeDogs: number;
    showEligibleDogs: number;
    forSaleDogs: number;
    atStudDogs: number;
    recentlyBredOrWhelped: number;
    averageProfile: Record<VisibleCategoryKey, number>;
    categorySpread: Array<{
      key: VisibleCategoryKey;
      label: string;
      average: number;
      direction: string;
      under: number;
      near: number;
      over: number;
      spread: number;
    }>;
  } | null;
  patternSummary: string[];
  filterCounts: Array<{
    group: string;
    key: string;
    label: string;
    count: number;
  }>;
  dogs: PlannerDog[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  kennel?: { id: string; name: string; balance: number };
  planner?: PlannerData;
  message?: string;
};

const BUCKETS: Array<{ key: TagType; label: string }> = [
  { key: "KEEP", label: "Keep" },
  { key: "WATCH", label: "Watch" },
  { key: "SELL_CANDIDATE", label: "Sell Candidate" },
  { key: "REHOME_CANDIDATE", label: "Re-home Candidate" },
  { key: "NO_ACTION", label: "No Action" },
];

const CATEGORY_KEYS: VisibleCategoryKey[] = [
  "typeExpression",
  "structureBalance",
  "movement",
  "coatPresentation",
  "temperamentRingBehavior",
  "conditioningHandling",
];

function valueTone(value: number) {
  if (value < 9.25) return "border-sky-300/25 bg-sky-500/10 text-sky-100";
  if (value > 10.75) return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
}

function filterMatchesDog(filterKey: string, dog: PlannerDog) {
  const [group, first, second] = filterKey.split(":");

  if (group === "sex") return dog.sex === first;
  if (group === "age") return dog.ageClass === first;
  if (group === "purpose") {
    if (first === "champion") return dog.showSummary.isChampion;
    if (first === "pointed") return dog.showSummary.isPointed;
    if (first === "unshown") return dog.showSummary.showEntryCount === 0;
    if (first === "showEligible") return dog.showSummary.isShowEligible;
    if (first === "breedEligible") return dog.breedingSummary.canBreed;
  }
  if (group === "category") {
    const value = dog.visibleCategories[first as VisibleCategoryKey];
    if (second === "under") return value < 9.25;
    if (second === "near") return value >= 9.25 && value <= 10.75;
    if (second === "over") return value > 10.75;
  }
  if (group === "health") {
    if (first === "complete") return dog.healthSummary.status === "complete";
    if (first === "incomplete") {
      return dog.healthSummary.status === "eligible_incomplete";
    }
    if (first === "concern") return dog.healthSummary.status === "concern";
    if (first === "tooYoung") return dog.healthSummary.status === "too_young";
  }
  if (group === "use") {
    if (first === "alreadyBred") return dog.breedingSummary.alreadyBred;
    if (first === "inactive") {
      return (
        dog.showSummary.showEntryCount === 0 && !dog.breedingSummary.alreadyBred
      );
    }
  }
  if (group === "market") {
    if (first === "forSale") return dog.marketSummary.isListedForSale;
    if (first === "atStud") return dog.marketSummary.isListedAtStud;
  }
  if (group === "reason" && first === "duplicate") {
    return dog.reasonTags.some((tag) => tag.startsWith("Similar visible profile"));
  }

  return true;
}

function buildFinalWarnings(dogs: PlannerDog[], buckets: Record<string, TagType>) {
  const warningRows = [
    {
      label: "Re-home candidates have champion titles.",
      count: dogs.filter(
        (dog) => buckets[dog.dogId] === "REHOME_CANDIDATE" && dog.showSummary.isChampion
      ).length,
    },
    {
      label: "Re-home candidates are the only adult female in this breed.",
      count: dogs.filter(
        (dog) =>
          buckets[dog.dogId] === "REHOME_CANDIDATE" &&
          dog.reasonTags.includes("Only Adult Female")
      ).length,
    },
    {
      label: "Re-home candidates are incomplete on health testing.",
      count: dogs.filter(
        (dog) =>
          buckets[dog.dogId] === "REHOME_CANDIDATE" &&
          dog.healthSummary.status === "eligible_incomplete"
      ).length,
    },
    {
      label: "Sell candidates are already part of a planned breeding.",
      count: dogs.filter(
        (dog) =>
          buckets[dog.dogId] === "SELL_CANDIDATE" && dog.breedingSummary.pregnant
      ).length,
    },
    {
      label: "No Action dogs are currently for sale.",
      count: dogs.filter(
        (dog) =>
          buckets[dog.dogId] === "NO_ACTION" && dog.marketSummary.isListedForSale
      ).length,
    },
    {
      label: "Re-home candidates have a recent litter.",
      count: dogs.filter(
        (dog) =>
          buckets[dog.dogId] === "REHOME_CANDIDATE" &&
          dog.breedingSummary.recentLitter
      ).length,
    },
  ];

  return warningRows.filter((row) => row.count > 0);
}

export default function ProgramPlannerClient() {
  const [planner, setPlanner] = useState<PlannerData | null>(null);
  const [kennelName, setKennelName] = useState<string>("");
  const [selectedBreed, setSelectedBreed] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [visibleStep, setVisibleStep] = useState(1);
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [buckets, setBuckets] = useState<Record<string, TagType>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [visibleNotes, setVisibleNotes] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlanner() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedBreed) params.set("breedCode2", selectedBreed);
      if (selectedGoal) params.set("goalKey", selectedGoal);

      try {
        const response = await fetch(`/api/kennel/program-planner?${params}`);
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok || !data.planner) {
          throw new Error(data.error ?? "Unable to load Program Planner.");
        }

        if (cancelled) return;

        const loadedPlanner = data.planner;

        setPlanner(loadedPlanner);
        setKennelName(data.kennel?.name ?? "");

        if (!selectedBreed && loadedPlanner.selectedBreed) {
          setSelectedBreed(loadedPlanner.selectedBreed.breedCode2);
          setVisibleStep(2);
        }

        setBuckets((current) => {
          const next = { ...current };
          for (const dog of loadedPlanner.dogs) {
            next[dog.dogId] =
              next[dog.dogId] ?? dog.existingPlannerTag?.tagType ?? "NO_ACTION";
          }
          return next;
        });
        setNotes((current) => {
          const next = { ...current };
          for (const dog of loadedPlanner.dogs) {
            next[dog.dogId] = next[dog.dogId] ?? dog.existingPlannerTag?.note ?? "";
          }
          return next;
        });
        setVisibleNotes((current) => {
          const next = new Set(current);
          for (const dog of loadedPlanner.dogs) {
            if (dog.existingPlannerTag?.isVisibleOnDogPage) {
              next.add(dog.dogId);
            }
          }
          return next;
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load Program Planner."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadPlanner();

    return () => {
      cancelled = true;
    };
  }, [selectedBreed, selectedGoal]);

  const availableGoals = planner?.availableGoals ?? [];
  const dogs = planner?.dogs ?? [];
  const selectedFilters = [...filters];
  const filteredDogs = useMemo(
    () =>
      dogs.filter((dog) =>
        selectedFilters.every((filterKey) => filterMatchesDog(filterKey, dog))
      ),
    [dogs, selectedFilters]
  );
  const dynamicFilterCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of planner?.filterCounts ?? []) {
      const otherActiveFilters = selectedFilters.filter(
        (filterKey) => filterKey !== item.key
      );
      const count = dogs.filter(
        (dog) =>
          otherActiveFilters.every((filterKey) =>
            filterMatchesDog(filterKey, dog)
          ) && filterMatchesDog(item.key, dog)
      ).length;

      counts.set(item.key, count);
    }

    return counts;
  }, [dogs, planner?.filterCounts, selectedFilters]);
  const bucketCounts = useMemo(
    () =>
      Object.fromEntries(
        BUCKETS.map((bucket) => [
          bucket.key,
          dogs.filter((dog) => (buckets[dog.dogId] ?? "NO_ACTION") === bucket.key)
            .length,
        ])
      ) as Record<TagType, number>,
    [dogs, buckets]
  );
  const finalWarnings = useMemo(
    () => buildFinalWarnings(dogs, buckets),
    [dogs, buckets]
  );

  function toggleFilter(key: string) {
    setFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function chooseBreed(nextBreed: string) {
    setSelectedBreed(nextBreed);
    setSelectedGoal("");
    setFilters(new Set());
    setMessage(null);
    setVisibleStep(nextBreed ? 2 : 1);
  }

  function chooseGoal(nextGoal: string) {
    setSelectedGoal(nextGoal);
    setMessage(null);
    setVisibleStep(3);
  }

  async function saveTags() {
    if (!planner?.selectedBreed || !selectedGoal) {
      setError("Choose a breed and program goal before saving.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/program-planner/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          breedCode2: planner.selectedBreed.breedCode2,
          goalKey: selectedGoal,
          tags: dogs.map((dog) => ({
            dogId: dog.dogId,
            tagType: buckets[dog.dogId] ?? "NO_ACTION",
            note: notes[dog.dogId] ?? "",
            isVisibleOnDogPage: visibleNotes.has(dog.dogId),
          })),
        }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to save planner tags.");
      }

      setMessage(data.message ?? "Planner tags saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save planner tags."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="planner-page mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="theme-label text-sm uppercase tracking-[0.25em]">
            Premium Planning Tool
          </p>
          <h1 className="theme-heading mt-2 text-3xl font-semibold sm:text-4xl">
            Program Planner
          </h1>
          <p className="theme-copy mt-3 max-w-3xl text-sm leading-7">
            Review a breed across your kennel, find patterns, and save
            keep/watch/sell/re-home notes without building a spreadsheet.
          </p>
        </div>
        <Link
          href="/kennel"
          className="theme-secondary-button rounded-2xl px-5 py-3 text-sm font-semibold"
        >
          Back to My Kennel
        </Link>
      </div>

      <div className="theme-panel theme-copy mb-6 rounded-[28px] p-5 text-sm leading-6">
        Program Planner uses visible dog information and your selected goal to
        organize your review. It does not choose dogs for you.
        {kennelName ? (
          <span className="ml-2 text-purple-100/60">Kennel: {kennelName}</span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mb-6 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <section className="grid gap-6">
        <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                Step 1
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Choose Breed
              </h2>
              <p className="mt-2 text-sm text-purple-100/65">
                Choose a breed to review your kennel&apos;s current direction.
              </p>
            </div>
            <label className="grid min-w-[280px] gap-2 text-sm text-purple-100/75">
              Breed
              <select
                autoComplete="off"
                value={selectedBreed}
                onChange={(event) => chooseBreed(event.target.value)}
                className="rounded-xl border border-fuchsia-200/55 bg-purple-950/80 px-4 py-3 font-semibold text-white shadow-[0_0_20px_rgba(192,132,252,0.15)] outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-300/25"
              >
                <option value="">Choose a breed...</option>
                <BreedSelectOptions
                  options={(planner?.availableBreeds ?? []).map((breed) => ({
                    code2: breed.breedCode2,
                    name: breed.breedName,
                    groupName: breed.breedGroupName,
                    count: breed.count,
                  }))}
                  getLabel={(breed) => `${breed.name} (${breed.count})`}
                />
              </select>
            </label>
          </div>

          {!selectedBreed && !isLoading ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/65">
              Choose a breed to begin reviewing your program.
            </div>
          ) : null}

          {planner?.snapshot ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Total", planner.snapshot.totalDogs],
                  ["Males", planner.snapshot.males],
                  ["Females", planner.snapshot.females],
                  ["Adults", planner.snapshot.adults],
                  ["Champions", planner.snapshot.champions],
                  ["Health Complete", planner.snapshot.healthComplete],
                  ["Show Eligible", planner.snapshot.showEligibleDogs],
                  ["Breeding Age", planner.snapshot.breedingAgeDogs],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/25 p-3"
                  >
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      {label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-100/75">
                  Category Spread
                </h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {planner.snapshot.categorySpread.map((category) => (
                    <div
                      key={category.key}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white">
                          {category.label}
                        </span>
                        <span className="text-xs text-purple-100/60">
                          avg {category.average}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-1 text-[0.68rem] text-purple-100/70">
                        {category.key === "conditioningHandling" ? (
                          <>
                            <span>below opt. {category.under}</span>
                            <span>opt. {category.near}</span>
                            <span>above opt. {category.over}</span>
                          </>
                        ) : (
                          <>
                            <span>under {category.under}</span>
                            <span>near {category.near}</span>
                            <span>over {category.over}</span>
                          </>
                        )}
                        <span>spread {category.spread}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {visibleStep >= 2 && planner?.selectedBreed ? (
        <div className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
            Step 2
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Choose Program Goal
          </h2>
          <p className="mt-2 text-sm text-purple-100/65">
            Select the direction you want the planner to organize against.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableGoals.map((goal) => (
              <button
                key={goal.key}
                type="button"
                onClick={() => chooseGoal(goal.key)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  selectedGoal === goal.key
                    ? "border-fuchsia-200 bg-fuchsia-500/20 text-white shadow-[0_0_28px_rgba(217,70,239,0.16)]"
                    : "border-white/10 bg-white/5 text-purple-100 hover:bg-white/10"
                }`}
              >
                {goal.label}
              </button>
            ))}
          </div>
          {!selectedGoal ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/65">
              Select a program goal to see goal-fit notes.
            </div>
          ) : null}
        </div>
        ) : null}

        {visibleStep >= 3 && planner?.selectedBreed && selectedGoal ? (
          <>
            <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                    Step 3
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Set Review Priorities
                  </h2>
                  <p className="mt-2 text-sm text-purple-100/65">
                    Counts are shown before filters are applied.
                  </p>
                </div>
                {filters.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilters(new Set())}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 hover:bg-white/10"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {Object.entries(
                  planner.filterCounts.reduce<Record<string, typeof planner.filterCounts>>(
                    (groups, item) => {
                      groups[item.group] = groups[item.group] ?? [];
                      groups[item.group].push(item);
                      return groups;
                    },
                    {}
                  )
                ).map(([group, items]) => (
                  <div key={group}>
                    <h3 className="mb-2 text-sm font-semibold text-purple-100">
                      {group}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {items.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleFilter(item.key)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            filters.has(item.key)
                              ? "border-sky-200 bg-sky-500/20 text-white"
                              : "border-white/10 bg-black/20 text-purple-100/75 hover:bg-white/10"
                          }`}
                        >
                          {item.label}:{" "}
                          {dynamicFilterCounts.get(item.key) ?? item.count}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleStep((step) => Math.max(step, 4))}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  Continue to Dog Review
                </button>
                <span className="text-sm text-purple-100/60">
                  Filters are optional. Continue when your review lens is set.
                </span>
              </div>
            </div>

            {visibleStep >= 4 ? (
            <>
            <div className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(135deg,rgba(76,29,149,0.5),rgba(15,23,42,0.72))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                Program Summary
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Your kennel pattern in this breed
              </h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {planner.patternSummary.length > 0 ? (
                  planner.patternSummary.map((pattern) => (
                    <div
                      key={pattern}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-purple-50/80"
                    >
                      {pattern}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/65">
                    No kennel pattern notes found yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                    Step 4
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    Dog Review Cards and Buckets
                  </h2>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/75">
                  Showing {filteredDogs.length} of {dogs.length}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredDogs.length > 0 ? (
                  filteredDogs.map((dog) => (
                    <article
                      key={dog.dogId}
                      className="rounded-[24px] border border-white/10 bg-black/24 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.25)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {dog.titledName}
                          </h3>
                          <p className="mt-1 text-xs text-purple-100/55">
                            {dog.regNumber} · {dog.sex} · {dog.ageLabel} ·{" "}
                            {dog.lifecycleState}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-sky-100">
                            Goal fit: {dog.goalFitLabel}
                          </p>
                        </div>
                        <Link
                          href={`/dogs/${dog.dogId}`}
                          className="rounded-xl border border-purple-300/25 bg-white/5 px-3 py-2 text-xs font-semibold text-purple-100 hover:bg-white/10"
                        >
                          View Dog
                        </Link>
                      </div>

                      <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-purple-100/55">
                        Main categories: 0–20 directional · 10 ideal; Cond/Handling: 0–10 · 10 optimized
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {CATEGORY_KEYS.map((key) => (
                          <div
                            key={key}
                            className={`rounded-xl border p-2 ${valueTone(
                              dog.visibleCategories[key]
                            )}`}
                          >
                            <div className="text-[0.66rem] font-semibold uppercase tracking-wide opacity-75">
                              {planner.categoryLabels[key]}
                            </div>
                            <div className="mt-1 text-base font-bold">
                              {dog.visibleCategories[key].toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          dog.healthSummary.label,
                          dog.showSummary.label,
                          dog.breedingSummary.label,
                          dog.marketSummary.label,
                        ].map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-purple-100/75"
                          >
                            {label}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {dog.reasonTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-50"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {dog.warningTags.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                          {dog.warningTags.map((warning) => (
                            <div
                              key={warning}
                              className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100"
                            >
                              {warning}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-100/65">
                          Player bucket
                        </div>
                        <div className="grid gap-2 sm:grid-cols-5">
                          {BUCKETS.map((bucket) => (
                            <button
                              key={bucket.key}
                              type="button"
                              onClick={() =>
                                setBuckets((current) => ({
                                  ...current,
                                  [dog.dogId]: bucket.key,
                                }))
                              }
                              className={`min-h-10 rounded-xl border px-2 text-xs font-semibold transition ${
                                (buckets[dog.dogId] ?? "NO_ACTION") === bucket.key
                                  ? "border-emerald-200 bg-emerald-500/20 text-white"
                                  : "border-white/10 bg-white/5 text-purple-100/70 hover:bg-white/10"
                              }`}
                            >
                              {bucket.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <textarea
                          value={notes[dog.dogId] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({
                              ...current,
                              [dog.dogId]: event.target.value,
                            }))
                          }
                          rows={3}
                          maxLength={1200}
                          placeholder="Optional private planner note."
                          className="w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-purple-100/35 focus:border-fuchsia-300/50"
                        />
                        <label className="flex items-center gap-2 text-xs font-medium text-purple-100/75">
                          <input
                            type="checkbox"
                            checked={visibleNotes.has(dog.dogId)}
                            onChange={(event) => {
                              setVisibleNotes((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(dog.dogId);
                                else next.delete(dog.dogId);
                                return next;
                              });
                            }}
                            className="h-4 w-4"
                          />
                          Show this planner note on the private dog page
                        </label>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-purple-100/65">
                    No dogs match these filters.
                  </div>
                )}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setVisibleStep((step) => Math.max(step, 5))}
                  disabled={dogs.length === 0}
                  className="rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Review Final Buckets
                </button>
                <span className="text-sm text-purple-100/60">
                  Bucket choices stay editable after final review opens.
                </span>
              </div>
            </div>

            {visibleStep >= 5 ? (
            <div className="rounded-[28px] border border-fuchsia-300/20 bg-[linear-gradient(180deg,rgba(76,29,149,0.65),rgba(15,23,42,0.95))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">
                Step 5
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Final Review
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-5">
                {BUCKETS.map((bucket) => (
                  <div
                    key={bucket.key}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      {bucket.label}
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-white">
                      {bucketCounts[bucket.key] ?? 0}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-100/75">
                  Review Warnings
                </h3>
                <div className="mt-3 grid gap-2">
                  {finalWarnings.length > 0 ? (
                    finalWarnings.map((warning) => (
                      <div
                        key={warning.label}
                        className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                      >
                        {warning.count} {warning.label}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                      No review warnings found.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveTags}
                  disabled={isSaving || !selectedGoal || dogs.length === 0}
                  className="rounded-2xl bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSaving ? "Saving..." : "Save Review and Apply Tags"}
                </button>
                <span className="text-sm text-purple-100/60">
                  Re-home remains tag-only in this first version.
                </span>
              </div>
            </div>
            ) : null}
            </>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
