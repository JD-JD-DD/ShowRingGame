"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BreedSelectOptions } from "@/components/breeds/BreedSelectOptions";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";
import { formatDogDisplayName } from "@/lib/dogNames";
import {
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
  healthBadgeStatus: "green" | "yellow" | "red" | null;
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
  areaIds: string[];
  visibleCategories: VisibleCategories;
  breedingCardStatus: BreedingCardStatus;
};

type KennelAreaDto = {
  id: string;
  name: string;
  sortOrder: number;
};

type KennelDogsResponse = {
  ok: boolean;
  dogs?: KennelDogDto[];
  areas?: KennelAreaDto[];
  groomingSummary?: GroomingSummaryDto;
  error?: string;
};

type GroomingSummaryDto = {
  groomingActionsUsedThisWeek: number;
  groomingActionsRemainingThisWeek: number;
  totalGroomingActionLimit: number;
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

type BulkAction = "" | "show-entry" | "rehome" | "add-area" | "remove-area";
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
        active ? "text-white" : "text-purple-200/80 hover:text-white"
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dogs, setDogs] = useState<KennelDogDto[]>([]);
  const [areas, setAreas] = useState<KennelAreaDto[]>([]);
  const [groomingSummary, setGroomingSummary] =
    useState<GroomingSummaryDto | null>(null);
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [confirmingBulkAction, setConfirmingBulkAction] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [areaActionLoading, setAreaActionLoading] = useState(false);
  const [areaCreateLoading, setAreaCreateLoading] = useState(false);
  const [groomingActionDogId, setGroomingActionDogId] = useState<string | null>(
    null
  );

  const [activeAreaId, setActiveAreaId] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [areaActionTargetId, setAreaActionTargetId] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [sexFilter, setSexFilter] = useState<"" | "M" | "F">("");
  const [onlyBreedable, setOnlyBreedable] = useState(false);
  const [onlyForSale, setOnlyForSale] = useState(false);
  const [onlyAtStud, setOnlyAtStud] = useState(false);
  const [groomingStateFilter, setGroomingStateFilter] =
    useState<GroomingStateFilter>("");

  const [sortKey, setSortKey] = useState<SortKey>("breed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  async function loadDogs(options?: { preserveLoadingState?: boolean }) {
    if (!options?.preserveLoadingState) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/dogs/mine", {
        method: "GET",
        cache: "no-store",
      });

      const data: KennelDogsResponse = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to load kennel dogs.");
      }

      setDogs(data.dogs ?? []);
      setAreas(data.areas ?? []);
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
    loadDogs();
  }, []);

  useEffect(() => {
    setSelectedDogIds((current) =>
      current.filter((dogId) => dogs.some((dog) => dog.dogId === dogId))
    );
  }, [dogs]);

  useEffect(() => {
    if (selectedDogIds.length === 0) {
      setBulkAction("");
      setConfirmingBulkAction(false);
    }
  }, [selectedDogIds.length]);

  useEffect(() => {
    if (activeAreaId && !areas.some((area) => area.id === activeAreaId)) {
      setActiveAreaId("");
    }

    if (
      areaActionTargetId &&
      !areas.some((area) => area.id === areaActionTargetId)
    ) {
      setAreaActionTargetId("");
    }
  }, [activeAreaId, areaActionTargetId, areas]);

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
      const areaMatch = activeAreaId ? dog.areaIds.includes(activeAreaId) : true;
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
        areaMatch &&
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
    activeAreaId,
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
  const areaCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const dog of dogs) {
      for (const areaId of dog.areaIds) {
        counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
      }
    }

    return counts;
  }, [dogs]);
  const activeArea = areas.find((area) => area.id === activeAreaId) ?? null;
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
        dog.lifecycleState === "ALIVE" &&
        dog.marketState === "NOT_FOR_SALE"
    );
  const canApplyBulkAction =
    bulkAction === "show-entry" ||
    (bulkAction === "rehome" && canBulkRehome && !bulkActionLoading) ||
    ((bulkAction === "add-area" || bulkAction === "remove-area") &&
      Boolean(areaActionTargetId) &&
      !areaActionLoading);

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
    const visibleIds = filteredDogs.map((dog) => dog.dogId);
    const visibleIdSet = new Set(visibleIds);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((dogId) => selectedDogIds.includes(dogId));

    if (allVisibleSelected) {
      setConfirmingBulkAction(false);
      setSelectedDogIds((current) =>
        current.filter((dogId) => !visibleIdSet.has(dogId))
      );
      return;
    }

    setConfirmingBulkAction(false);
    setSelectedDogIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function updateBulkAction(action: BulkAction) {
    setBulkAction(action);
    setConfirmingBulkAction(false);

    if (
      (action === "add-area" || action === "remove-area") &&
      !areaActionTargetId
    ) {
      setAreaActionTargetId(activeAreaId || areas[0]?.id || "");
    }
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

    if (bulkAction === "add-area" || bulkAction === "remove-area") {
      void updateSelectedDogsArea(bulkAction === "add-area" ? "add" : "remove");
    }
  }

  async function createArea() {
    const name = newAreaName.trim();

    if (name.length < 2 || areaCreateLoading) {
      return;
    }

    setAreaCreateLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/areas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        area?: KennelAreaDto;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.area) {
        throw new Error(data.error || "Failed to create kennel area.");
      }

      setAreas((current) => [...current, data.area!]);
      setActiveAreaId(data.area.id);
      setAreaActionTargetId(data.area.id);
      setNewAreaName("");
      setMessage(`Created kennel area "${data.area.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create area.");
    } finally {
      setAreaCreateLoading(false);
    }
  }

  async function deleteArea(area: KennelAreaDto) {
    if (areaActionLoading || areaCreateLoading) {
      return;
    }

    // Require an explicit confirmation so an accidental click on the pill
    // control does not remove a custom roster view unexpectedly.
    const confirmed = window.confirm(
      `Delete kennel area "${area.name}"? Dogs will stay in your kennel.`
    );

    if (!confirmed) {
      return;
    }

    setAreaActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/kennel/areas/${area.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        areaId?: string;
        areaName?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.areaId) {
        throw new Error(data.error || "Failed to delete kennel area.");
      }

      setAreas((current) =>
        current.filter((candidate) => candidate.id !== data.areaId)
      );
      setDogs((current) =>
        current.map((dog) => ({
          ...dog,
          areaIds: dog.areaIds.filter((areaId) => areaId !== data.areaId),
        }))
      );

      if (activeAreaId === data.areaId) {
        setActiveAreaId("");
      }

      if (areaActionTargetId === data.areaId) {
        setAreaActionTargetId("");
      }

      setMessage(`Deleted kennel area "${data.areaName ?? area.name}".`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete kennel area."
      );
    } finally {
      setAreaActionLoading(false);
    }
  }

  async function runGroomingAction(args: {
    dogId: string;
    endpoint: string;
    confirmMessage?: string;
  }) {
    if (groomingActionDogId) {
      return;
    }

    if (args.confirmMessage && !window.confirm(args.confirmMessage)) {
      return;
    }

    setGroomingActionDogId(args.dogId);
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

  async function updateSelectedDogsArea(action: "add" | "remove") {
    if (!areaActionTargetId || selectedDogIds.length === 0 || areaActionLoading) {
      return;
    }

    setAreaActionLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/kennel/areas/${areaActionTargetId}/dogs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dogIds: selectedDogIds, action }),
        }
      );
      const data = (await response.json()) as {
        ok?: boolean;
        areaId?: string;
        dogIds?: string[];
        action?: "add" | "remove";
        error?: string;
      };

      if (!response.ok || !data.ok || !data.areaId) {
        throw new Error(data.error || "Failed to update kennel area.");
      }

      const updatedDogIds = new Set(data.dogIds ?? selectedDogIds);
      const targetAreaId = data.areaId;
      const targetAreaName =
        areas.find((area) => area.id === targetAreaId)?.name ?? "area";

      setDogs((current) =>
        current.map((dog) => {
          if (!updatedDogIds.has(dog.dogId)) {
            return dog;
          }

          const areaIds = new Set(dog.areaIds);

          if (action === "add") {
            areaIds.add(targetAreaId);
          } else {
            areaIds.delete(targetAreaId);
          }

          return {
            ...dog,
            areaIds: [...areaIds],
          };
        })
      );
      setBulkAction("");
      setConfirmingBulkAction(false);
      setMessage(
        `${action === "add" ? "Added" : "Removed"} ${updatedDogIds.size} dog(s) ${
          action === "add" ? "to" : "from"
        } "${targetAreaName}".`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update kennel area."
      );
    } finally {
      setAreaActionLoading(false);
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
    <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-purple-200">
            My Dogs
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Kennel Roster
          </h2>
          <p className="mt-2 text-sm leading-7 text-purple-100/70">
            Sort, filter, and compare your dogs in one working roster.
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-sky-300/15 bg-sky-500/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
              Kennel Areas
            </div>
            <p className="mt-2 text-sm leading-6 text-purple-100/70">
              Create private views for groups like puppies to show, brood bitches,
              or health testing.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newAreaName}
              onChange={(event) => setNewAreaName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createArea();
                }
              }}
              placeholder="New area name..."
              className="min-w-[220px] rounded-xl border border-sky-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/40"
            />
            <button
              type="button"
              onClick={() => void createArea()}
              disabled={newAreaName.trim().length < 2 || areaCreateLoading}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {areaCreateLoading ? "Creating..." : "Create Area"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveAreaId("");
              setSelectedDogIds([]);
              setBulkAction("");
              setConfirmingBulkAction(false);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeAreaId === ""
                ? "border-sky-200/70 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/5 text-purple-100/70 hover:bg-white/10"
            }`}
          >
            All Dogs ({dogs.length})
          </button>
          {areas.map((area) => (
            <div
              key={area.id}
              className={`inline-flex items-center gap-1 rounded-full border pr-1 transition ${
                activeAreaId === area.id
                  ? "border-fuchsia-200/70 bg-fuchsia-500/20 text-fuchsia-100"
                  : "border-white/10 bg-white/5 text-purple-100/70 hover:bg-white/10"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveAreaId(area.id);
                  setSelectedDogIds([]);
                  setBulkAction("");
                  setConfirmingBulkAction(false);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
              >
                {area.name} ({areaCounts.get(area.id) ?? 0})
              </button>
              <button
                type="button"
                aria-label={`Delete kennel area ${area.name}`}
                title={`Delete ${area.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteArea(area);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[13px] font-bold text-purple-100/75 transition hover:border-red-300/35 hover:bg-red-500/15 hover:text-red-100"
              >
                ×
              </button>
            </div>
          ))}
          {areas.length === 0 ? (
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-purple-100/55">
              No custom areas yet
            </span>
          ) : null}
        </div>
      </div>

      {groomingSummary ? (
        <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                Grooming Assistance
              </div>
              <p className="mt-2 text-sm leading-6 text-purple-100/75">
                Grooming actions used this week:{" "}
                {groomingSummary.groomingActionsUsedThisWeek} /{" "}
                {groomingSummary.totalGroomingActionLimit}. Own dogs groomed:{" "}
                {groomingSummary.selfGroomsCompletedThisWeek}. Outside jobs
                completed: {groomingSummary.outsideGroomsCompletedThisWeek}.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-purple-200/70">
                  Remaining
                </div>
                <div className="mt-1 font-semibold text-white">
                  {groomingSummary.groomingActionsRemainingThisWeek}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-purple-200/70">
                  Level
                </div>
                <div className="mt-1 font-semibold text-white">
                  {groomingSummary.groomingLevel}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-purple-200/70">
                  XP
                </div>
                <div className="mt-1 font-semibold text-white">
                  {groomingSummary.groomingXp}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200/80">
            {activeArea ? activeArea.name : "All Dogs"} View
          </div>
          <div className="mt-1 text-sm text-purple-100/60">
            {filteredDogs.length} visible dog
            {filteredDogs.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(260px,1.2fr)_minmax(150px,0.7fr)_minmax(130px,0.7fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_minmax(180px,0.9fr)]">
          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="min-w-0 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Breeds</option>
            <BreedSelectOptions options={breedOptions} />
          </select>

          <select
            value={sexFilter}
            onChange={(e) => setSexFilter(e.target.value as "" | "M" | "F")}
            className="min-w-0 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Sexes</option>
            <option value="M">Dogs</option>
            <option value="F">Bitches</option>
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-purple-100">
            <input
              type="checkbox"
              checked={onlyBreedable}
              onChange={(e) => setOnlyBreedable(e.target.checked)}
            />
            Breedable
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-purple-100">
            <input
              type="checkbox"
              checked={onlyForSale}
              onChange={(e) => setOnlyForSale(e.target.checked)}
            />
            For Sale
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-purple-100">
            <input
              type="checkbox"
              checked={onlyAtStud}
              onChange={(e) => setOnlyAtStud(e.target.checked)}
            />
            At Stud
          </label>

          <select
            value={groomingStateFilter}
            onChange={(e) =>
              setGroomingStateFilter(e.target.value as GroomingStateFilter)
            }
            className="min-w-0 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Grooming</option>
            <option value="groomed">Groomed</option>
            <option value="ungroomed">Ungroomed</option>
          </select>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {selectedDogIds.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-purple-300/15 bg-black/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">
                {selectedDogIds.length} selected
              </div>
              <div className="mt-1 text-xs text-purple-100/65">
                Choose a bulk action, then apply it.
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(170px,1fr)_auto_auto]">
              <select
                value={bulkAction}
                onChange={(event) =>
                  updateBulkAction(event.target.value as BulkAction)
                }
                className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Bulk action...</option>
                <option value="add-area">Add to Area</option>
                <option value="remove-area">Remove from Area</option>
                <option value="show-entry">Show Entry</option>
                <option value="rehome">Re-Home</option>
              </select>

              {bulkAction === "add-area" || bulkAction === "remove-area" ? (
                <select
                  value={areaActionTargetId}
                  onChange={(event) => setAreaActionTargetId(event.target.value)}
                  className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Choose area...</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <button
                type="button"
                onClick={applyBulkAction}
                disabled={!canApplyBulkAction}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {bulkAction === "show-entry"
                  ? "Continue"
                  : areaActionLoading
                    ? "Updating..."
                    : "Apply Action"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedDogIds([]);
                  setBulkAction("");
                  setConfirmingBulkAction(false);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          {bulkAction === "rehome" && !canBulkRehome ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Only dogs at least 8 weeks old that are active and not listed for sale
              can be re-homed in bulk.
            </div>
          ) : null}

          {confirmingBulkAction && bulkAction === "rehome" ? (
            <div className="mt-3 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-red-100">
                Confirm re-home for {selectedDogIds.length} selected dog
                {selectedDogIds.length === 1 ? "" : "s"}.
              </div>
              <div className="mt-1 text-sm leading-6 text-red-100/75">
                This cannot be undone. The selected dog
                {selectedDogIds.length === 1 ? "" : "s"} will leave your kennel
                and you will no longer be able to use{" "}
                {selectedDogIds.length === 1 ? "it" : "them"}.
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
                  {bulkActionLoading ? "Re-Homing..." : "Confirm Re-Home"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingBulkAction(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
          Loading kennel dogs...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-6 text-sm text-red-100">
          {error}
        </div>
      ) : filteredDogs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
          No dogs match your current filters.
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full table-fixed border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                <th className="w-10 px-2 py-2">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className="text-purple-200/80 transition hover:text-white"
                  >
                    Select
                  </button>
                </th>
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
                <th className="w-[72px] px-2 py-2 text-center">Groom</th>
                <th className="w-[72px] px-2 py-2 text-center">Offer</th>
              </tr>
            </thead>

            <tbody>
              {filteredDogs.map((dog) => {
                const dogHref = activeAreaId
                  ? `/dogs/${dog.dogId}?areaId=${encodeURIComponent(
                      activeAreaId
                    )}`
                  : `/dogs/${dog.dogId}`;
                const groomingBusy = groomingActionDogId === dog.dogId;
                const hasOpenGroomingListing = Boolean(
                  dog.groomingStatus.openListingId
                );
                const canUseGroomingAction =
                  (groomingSummary?.groomingActionsRemainingThisWeek ?? 0) > 0;
                const groomDisabled =
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  !canUseGroomingAction ||
                  groomingBusy;
                const offerDisabled =
                  dog.groomingStatus.groomedThisWeek ||
                  hasOpenGroomingListing ||
                  groomingBusy;

                return (
                  <tr
                    key={dog.dogId}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(dogHref)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(dogHref);
                      }
                    }}
                    className="cursor-pointer border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-300/45"
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

                  <td className="px-2 py-2 text-white font-medium">
                    <div className="truncate text-xs leading-4">
                      {dog.breedName}
                    </div>
                  </td>

                  <td className="px-2 py-2 text-white font-medium">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{getDogDisplayName(dog)}</span>
                      <DogStatusBadges
                        healthStatus={dog.healthBadgeStatus}
                        isListedForSale={dog.isListedForSale}
                        isListedAtStud={dog.isListedAtStud}
                      />
                    </div>
                  </td>

                  <td className="px-2 py-2 text-white">{dog.sex}</td>
                  <td className="px-2 py-2 text-white">
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

                  <td className="px-2 py-2">
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
                      className="w-full rounded-lg border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[0.7rem] font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Groom
                    </button>
                  </td>
                  <td className="rounded-r-2xl px-2 py-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void runGroomingAction({
                          dogId: dog.dogId,
                          endpoint: "/api/services/grooming/list",
                          confirmMessage: `Offer ${getDogDisplayName(
                            dog
                          )} for outside grooming?`,
                        });
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      disabled={offerDisabled}
                      className="w-full rounded-lg border border-sky-300/25 bg-sky-500/10 px-2 py-1 text-[0.7rem] font-semibold text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Offer
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
