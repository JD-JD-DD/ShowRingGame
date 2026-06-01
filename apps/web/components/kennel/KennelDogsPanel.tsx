"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  marketState: string;
  originType: string;
  isFoundation: boolean;
  visibleCategories: VisibleCategories;
  breedingCardStatus: BreedingCardStatus;
};

type KennelSummary = {
  id: string;
  name: string;
  slug: string;
  balance: number;
  homeDistrict: string;
  dogCount: number;
};

type KennelDogsResponse = {
  ok: boolean;
  kennel?: KennelSummary;
  dogs?: KennelDogDto[];
  error?: string;
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

function formatBreedingStatus(status: BreedingCardStatus): string {
  if (
    status.label === "Pregnant" &&
    typeof status.dueInHours === "number" &&
    Number.isFinite(status.dueInHours)
  ) {
    return `Pregnant, due in ${status.dueInHours}d`;
  }

  if (
    status.label === "Pending Pregnancy Confirmation" &&
    typeof status.pregCheckInHours === "number" &&
    Number.isFinite(status.pregCheckInHours)
  ) {
    return `Check in ${status.pregCheckInHours}d`;
  }

  if (
    status.label === "Post-Whelp Cooldown" &&
    typeof status.cooldownInHours === "number" &&
    Number.isFinite(status.cooldownInHours)
  ) {
    return `Cooldown ${status.cooldownInHours}d`;
  }

  return status.label;
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
  const [selectedDogIds, setSelectedDogIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [confirmingBulkAction, setConfirmingBulkAction] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [breedFilter, setBreedFilter] = useState("");
  const [sexFilter, setSexFilter] = useState<"" | "M" | "F">("");
  const [search, setSearch] = useState("");
  const [onlyBreedable, setOnlyBreedable] = useState(false);
  const [onlyShowEligible, setOnlyShowEligible] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("breed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    async function loadDogs() {
      setLoading(true);
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
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load kennel dogs."
        );
      } finally {
        setLoading(false);
      }
    }

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

  const breedOptions = useMemo(() => {
    return Array.from(new Set(dogs.map((dog) => dog.breedName))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [dogs]);

  const filteredDogs = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = dogs.filter((dog) => {
      const name = getDogDisplayName(dog).toLowerCase();

      const breedMatch = breedFilter ? dog.breedName === breedFilter : true;
      const sexMatch = sexFilter ? dog.sex === sexFilter : true;
      const searchMatch =
        !q || name.includes(q) || dog.breedName.toLowerCase().includes(q);

      const breedableMatch = onlyBreedable
        ? dog.breedingCardStatus.label === "Open" ||
          dog.breedingCardStatus.label === "Available for Stud"
        : true;

      const showEligibleMatch = onlyShowEligible
        ? dog.ageHours >= 182 &&
          dog.ageHours <= 3840 &&
          dog.lifecycleState === "ALIVE"
        : true;

      return (
        breedMatch &&
        sexMatch &&
        searchMatch &&
        breedableMatch &&
        showEligibleMatch
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
    search,
    onlyBreedable,
    onlyShowEligible,
    sortKey,
    sortDirection,
  ]);

  const selectedDogs = useMemo(() => {
    const selected = new Set(selectedDogIds);
    return dogs.filter((dog) => selected.has(dog.dogId));
  }, [dogs, selectedDogIds]);

  const selectedDogsQuery = selectedDogIds.join(",");
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
    (bulkAction === "rehome" && canBulkRehome && !bulkActionLoading);

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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(280px,1fr)_minmax(150px,0.7fr)_minmax(130px,0.7fr)_minmax(150px,0.8fr)]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or breed..."
            className="min-w-0 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/40"
          />

          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="min-w-0 rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            <option value="">All Breeds</option>
            {breedOptions.map((breed) => (
              <option key={breed} value={breed}>
                {breed}
              </option>
            ))}
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
              checked={onlyShowEligible}
              onChange={(e) => setOnlyShowEligible(e.target.checked)}
            />
            Show Eligible
          </label>
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

            <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto_auto]">
              <select
                value={bulkAction}
                onChange={(event) =>
                  updateBulkAction(event.target.value as BulkAction)
                }
                className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
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
                {bulkAction === "show-entry" ? "Continue" : "Apply Action"}
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
        <div className="overflow-x-auto">
          <table className="min-w-[1240px] w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
                <th className="px-3 py-2">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className="text-purple-200/80 transition hover:text-white"
                  >
                    Select
                  </button>
                </th>
                <th className="px-3 py-2 text-right">Open</th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "breed"}
                    direction={sortDirection}
                    onClick={() => toggleSort("breed")}
                  >
                    Breed
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "name"}
                    direction={sortDirection}
                    onClick={() => toggleSort("name")}
                  >
                    Dog
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "sex"}
                    direction={sortDirection}
                    onClick={() => toggleSort("sex")}
                  >
                    Sex
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "age"}
                    direction={sortDirection}
                    onClick={() => toggleSort("age")}
                  >
                    Age
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "typeExpression"}
                    direction={sortDirection}
                    onClick={() => toggleSort("typeExpression")}
                  >
                    Type
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "structureBalance"}
                    direction={sortDirection}
                    onClick={() => toggleSort("structureBalance")}
                  >
                    Struct.
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "movement"}
                    direction={sortDirection}
                    onClick={() => toggleSort("movement")}
                  >
                    Move.
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "coatPresentation"}
                    direction={sortDirection}
                    onClick={() => toggleSort("coatPresentation")}
                  >
                    Coat
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "temperamentRingBehavior"}
                    direction={sortDirection}
                    onClick={() => toggleSort("temperamentRingBehavior")}
                  >
                    Temp.
                  </SortButton>
                </th>
                <th className="px-3 py-2">
                  <SortButton
                    active={sortKey === "conditioningHandling"}
                    direction={sortDirection}
                    onClick={() => toggleSort("conditioningHandling")}
                  >
                    Cond.
                  </SortButton>
                </th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredDogs.map((dog) => (
                <tr
                  key={dog.dogId}
                  className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
                >
                  <td className="rounded-l-2xl px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDogIds.includes(dog.dogId)}
                      onChange={() => toggleDogSelection(dog.dogId)}
                      aria-label={`Select ${getDogDisplayName(dog)}`}
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/dogs/${dog.dogId}`}
                      className="inline-flex rounded-xl border border-purple-300/25 bg-white/5 px-3 py-1.5 text-xs font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      Open
                    </Link>
                  </td>

                  <td className="px-3 py-3 text-white font-medium">
                    {dog.breedName}
                  </td>

                  <td className="px-3 py-3 text-white font-medium">
                    {getDogDisplayName(dog)}
                  </td>

                  <td className="px-3 py-3 text-white">{dog.sex}</td>
                  <td className="px-3 py-3 text-white">
                    {formatAge(dog.ageHours)}
                  </td>

                  <td className="px-3 py-3">
                    <StatCell value={dog.visibleCategories.typeExpression ?? 0} />
                  </td>
                  <td className="px-3 py-3">
                    <StatCell value={dog.visibleCategories.structureBalance ?? 0} />
                  </td>
                  <td className="px-3 py-3">
                    <StatCell value={dog.visibleCategories.movement ?? 0} />
                  </td>
                  <td className="px-3 py-3">
                    <StatCell value={dog.visibleCategories.coatPresentation ?? 0} />
                  </td>
                  <td className="px-3 py-3">
                    <StatCell
                      value={dog.visibleCategories.temperamentRingBehavior ?? 0}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <StatCell
                      value={dog.visibleCategories.conditioningHandling ?? 0}
                    />
                  </td>

                  <td className="rounded-r-2xl px-3 py-3 text-xs text-purple-100/80 whitespace-nowrap">
                    {formatBreedingStatus(dog.breedingCardStatus)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
