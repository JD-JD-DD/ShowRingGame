"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BreedSelectOptions,
  compareBreedGroupNames,
  normalizeBreedGroupName,
} from "@/components/breeds/BreedSelectOptions";
import TraitLine from "@/components/ui/TraitLine";

type VisibleCategories = Record<string, number>;

type MarketDogDto = {
  listingId: string;
  dogId: string;
  displayName: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  price: number;
  sellerType: "PLAYER" | "NPC" | "SYSTEM";
  sellerKennelName: string | null;
  listingType: string;
  isOwnedByCurrentKennel: boolean;
  visibleCategories: VisibleCategories;
};

type MarketDogsResponse = {
  ok: boolean;
  dogs?: MarketDogDto[];
  error?: string;
};

type BuyDogResponse = {
  ok: boolean;
  dog?: MarketDogDto;
  dogId?: string;
  error?: string;
};

type BreedCatalogDto = {
  code2: string;
  name: string;
  groupName: string | null;
};

type BreedCatalogResponse = {
  ok: boolean;
  breeds?: BreedCatalogDto[];
  error?: string;
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

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

const VISIBLE_CATEGORY_LABELS: Record<string, string> = {
  typeExpression: "Type & Expression",
  structureBalance: "Structure & Balance",
  movement: "Movement",
  coatPresentation: "Coat & Presentation",
  temperamentRingBehavior: "Temperament & Ring Behavior",
  conditioningHandling: "Conditioning & Handling",
};

function formatCategoryName(key: string): string {
  return (
    VISIBLE_CATEGORY_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function visibleCategoryEntries(categories: VisibleCategories) {
  return Object.entries(categories).filter(
    ([key]) => key !== "conditioningHandling"
  );
}

export default function MarketPage() {
  const [breedCatalog, setBreedCatalog] = useState<BreedCatalogDto[]>([]);
  const [loadingBreeds, setLoadingBreeds] = useState(true);

  const [groupFilter, setGroupFilter] = useState("");
  const [breedSearch, setBreedSearch] = useState("");
  const [selectedBreedCode2, setSelectedBreedCode2] = useState("");

  const [dogs, setDogs] = useState<MarketDogDto[]>([]);
  const [loadingDogs, setLoadingDogs] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyingDogId, setBuyingDogId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBreedCatalog() {
      setLoadingBreeds(true);

      try {
        const res = await fetch("/api/breeds/catalog", {
          method: "GET",
          cache: "no-store",
        });

        const data: BreedCatalogResponse = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Failed to load breeds.");
        }

        setBreedCatalog(data.breeds ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load breeds.");
      } finally {
        setLoadingBreeds(false);
      }
    }

    loadBreedCatalog();
  }, []);

  const groupOptions = useMemo(() => {
    return Array.from(
      new Set(
        breedCatalog
          .map((breed) => breed.groupName)
          .map((groupName) => normalizeBreedGroupName(groupName))
          .filter((group): group is string => !!group)
      )
    ).sort(compareBreedGroupNames);
  }, [breedCatalog]);

  const filteredBreeds = useMemo(() => {
    return breedCatalog
      .filter((breed) =>
        groupFilter ? normalizeBreedGroupName(breed.groupName) === groupFilter : true
      )
      .filter((breed) =>
        breedSearch.trim()
          ? breed.name.toLowerCase().includes(breedSearch.trim().toLowerCase())
          : true
      );
  }, [breedCatalog, groupFilter, breedSearch]);

  async function loadDogs(breedCode2: string) {
    setLoadingDogs(true);
    setError(null);
    setMessage(null);
    setHasSearched(true);

    try {
      const query = `?breedCode2=${encodeURIComponent(
        breedCode2.trim().toUpperCase()
      )}`;

      const res = await fetch(`/api/market-dogs${query}`, {
        method: "GET",
        cache: "no-store",
      });

      const data: MarketDogsResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load dogs.");
      }

      setDogs(data.dogs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dogs.");
      setDogs([]);
    } finally {
      setLoadingDogs(false);
    }
  }

  async function handleBrowseDogs() {
    if (!selectedBreedCode2) {
      setError("Please choose a breed first.");
      return;
    }

    await loadDogs(selectedBreedCode2);
  }

  async function handleClear() {
    setGroupFilter("");
    setBreedSearch("");
    setSelectedBreedCode2("");
    setDogs([]);
    setHasSearched(false);
    setError(null);
    setMessage(null);
  }

  async function handleBuy(dog: MarketDogDto) {
    setBuyingDogId(dog.dogId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/market-dogs/${dog.listingId}/buy`, {
        method: "POST",
      });

      const data: BuyDogResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Purchase failed.");
      }

      setMessage(`Purchased ${dog.displayName} (${dog.breedCode2}).`);

      if (selectedBreedCode2) {
        await loadDogs(selectedBreedCode2);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBuyingDogId(null);
    }
  }

  return (
    <main className="market-page min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <section className="theme-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="theme-neutral-badge mb-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                The Market
              </div>

              <h1 className="theme-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Browse dogs available for purchase
              </h1>

              <p className="theme-copy mt-3 text-sm leading-7 sm:text-base">
                This is the central marketplace for dogs in ShowRing Game.
                Browse foundation dogs and player-listed dogs offered for sale.
              </p>

              <p className="theme-copy mt-3 text-sm leading-7 sm:text-base">
                To begin, choose a breed. You can type a breed name or select one from the dropdown below.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/studs"
                className="theme-status-info rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:opacity-90"
              >
                Browse Studs
              </Link>
              <Link
                href="/kennel"
                className="theme-primary-button rounded-2xl px-5 py-3 text-sm font-semibold"
              >
                Back to My Kennel
              </Link>
            </div>
          </div>
        </section>

        <section className="theme-panel mb-8 rounded-[28px] px-6 py-6 backdrop-blur">
          <h2 className="theme-heading mb-4 text-lg font-semibold">
            Find a Breed
          </h2>

          {loadingBreeds ? (
            <p className="theme-copy text-sm">Loading breeds...</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
              <div>
                <label className="theme-label mb-1 block text-xs uppercase tracking-wide">
                  Group
                </label>
                <select
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setSelectedBreedCode2("");
                  }}
                  className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="">All Groups</option>
                  {groupOptions.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="theme-label mb-1 block text-xs uppercase tracking-wide">
                  Search Breed Name
                </label>
                <input
                  type="text"
                  value={breedSearch}
                  onChange={(e) => setBreedSearch(e.target.value)}
                  placeholder="Type breed name..."
                  className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label className="theme-label mb-1 block text-xs uppercase tracking-wide">
                  Breed
                </label>
                <select
                  value={selectedBreedCode2}
                  onChange={(e) => setSelectedBreedCode2(e.target.value)}
                  className="theme-control w-full rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select a breed</option>
                  <BreedSelectOptions options={filteredBreeds} />
                </select>
              </div>

              <button
                onClick={handleBrowseDogs}
                className="theme-primary-button rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                Browse Dogs
              </button>

              <button
                onClick={handleClear}
                className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {message ? (
          <div className="theme-notice theme-notice--success mb-4 px-4 py-3 text-sm">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="theme-notice theme-notice--danger mb-4 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {!selectedBreedCode2 && !hasSearched ? (
          <section className="theme-panel theme-copy rounded-[28px] px-6 py-10 text-center text-sm">
            Select a breed above to view available dogs.
          </section>
        ) : loadingDogs ? (
          <section className="theme-panel theme-copy rounded-[28px] p-8 text-sm">
            Loading dogs for {selectedBreedCode2}...
          </section>
        ) : dogs.length === 0 ? (
          <section className="theme-panel theme-copy rounded-[28px] p-8 text-sm">
            Click Browse Dogs.
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {dogs.map((dog) => (
              <article
                key={dog.dogId}
                className="theme-panel overflow-hidden rounded-[28px]"
              >
                <div className="border-b border-[color:var(--dog-border)] bg-[color:var(--dog-card)] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="theme-label text-sm font-medium">
                        {dog.breedName}{" "}
                        <span className="theme-copy">({dog.breedCode2})</span>
                      </div>
                      <h2 className="theme-heading mt-2 text-2xl font-bold">
                        {dog.displayName}
                      </h2>
                      <div className="theme-copy mt-2 text-sm">
                        {dog.regNumber}
                      </div>
                    </div>

                    <div className="theme-card rounded-2xl px-4 py-2 text-right">
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Price
                      </div>
                      <div className="theme-heading mt-1 text-xl font-bold">
                        {formatMoney(dog.price)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="theme-card rounded-2xl px-4 py-3">
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Sex
                      </div>
                      <div className="theme-heading mt-1 font-medium">{dog.sex}</div>
                    </div>

                    <div className="theme-card rounded-2xl px-4 py-3">
                      <div className="theme-label text-xs uppercase tracking-wide">
                        Age
                      </div>
                      <div className="theme-heading mt-1 font-medium">
                        {formatAge(dog.ageHours)}
                      </div>
                    </div>
                  </div>

                  <div className="theme-card mb-5 rounded-2xl px-4 py-3 text-sm">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Seller
                    </div>
                    <div className="theme-heading mt-1 font-medium">
                      {dog.sellerType === "SYSTEM"
                        ? "Foundation Market"
                        : dog.sellerKennelName ?? "Player Kennel"}
                    </div>
                  </div>

                  <div>
                    <h3 className="theme-label mb-3 text-sm font-semibold uppercase tracking-wide">
                      Visible Ring Categories
                    </h3>

                    <div className="space-y-3">
                      {visibleCategoryEntries(dog.visibleCategories).map(
                        ([key, value]) => (
                          <TraitLine
                            key={key}
                            label={formatCategoryName(key)}
                            value={value}
                            min={0}
                            max={20}
                            ideal={10}
                            leftLabel="Under ideal"
                            rightLabel="Over ideal"
                          />
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex items-stretch gap-3">
                    <Link
                      href={`/dogs/${dog.dogId}`}
                      className="theme-primary-button flex-[1.45] rounded-2xl px-4 py-3 text-center text-sm font-semibold"
                    >
                      View Dog
                    </Link>

                    <button
                      onClick={() => handleBuy(dog)}
                      disabled={buyingDogId === dog.dogId || dog.isOwnedByCurrentKennel}
                      className="theme-secondary-button flex-1 rounded-2xl px-3 py-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {dog.isOwnedByCurrentKennel
                        ? "Your Listing"
                        : buyingDogId === dog.dogId
                          ? "Buying..."
                          : "Buy Dog"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
