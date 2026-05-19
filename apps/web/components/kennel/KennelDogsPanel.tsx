"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VisibleCategories = Record<string, number>;

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
    | "Did Not Take"
    | "Whelped"
    | "Available for Stud"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
};

type KennelDogDto = {
  dogId: string;
  callName: string | null;
  regNumber: string;
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
  return dog.callName?.trim() || dog.regNumber;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dogs, setDogs] = useState<KennelDogDto[]>([]);

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "age" ? "desc" : "asc");
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or breed..."
            className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/40"
          />

          <select
            value={breedFilter}
            onChange={(e) => setBreedFilter(e.target.value)}
            className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
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
            className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
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
          <table className="min-w-[1180px] w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
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

                  <td className="px-3 py-3 text-xs text-purple-100/80 whitespace-nowrap">
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
