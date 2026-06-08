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

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                The Market
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Browse dogs available for purchase
              </h1>

              <p className="mt-3 text-sm leading-7 text-purple-100/75 sm:text-base">
                This is the central marketplace for dogs in ShowRing Game.
                Browse foundation dogs and player-listed dogs offered for sale.
              </p>

              <p className="mt-3 text-sm leading-7 text-purple-100/75 sm:text-base">
                To begin, choose a breed. You can type a breed name or select one from the dropdown below.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/studs"
                className="rounded-2xl border border-sky-300/25 bg-sky-500/10 px-5 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
              >
                Browse Studs
              </Link>
              <Link
                href="/kennel"
                className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Back to My Kennel
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Find a Breed
          </h2>

          {loadingBreeds ? (
            <p className="text-sm text-purple-100/60">Loading breeds...</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-purple-100/60">
                  Group
                </label>
                <select
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setSelectedBreedCode2("");
                  }}
                  className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
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
                <label className="mb-1 block text-xs uppercase tracking-wide text-purple-100/60">
                  Search Breed Name
                </label>
                <input
                  type="text"
                  value={breedSearch}
                  onChange={(e) => setBreedSearch(e.target.value)}
                  placeholder="Type breed name..."
                  className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wide text-purple-100/60">
                  Breed
                </label>
                <select
                  value={selectedBreedCode2}
                  onChange={(e) => setSelectedBreedCode2(e.target.value)}
                  className="w-full rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="">Select a breed</option>
                  <BreedSelectOptions options={filteredBreeds} />
                </select>
              </div>

              <button
                onClick={handleBrowseDogs}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Browse Dogs
              </button>

              <button
                onClick={handleClear}
                className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {message ? (
          <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {!selectedBreedCode2 && !hasSearched ? (
          <section className="rounded-[28px] border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-purple-100/60 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            Select a breed above to view available dogs.
          </section>
        ) : loadingDogs ? (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            Loading dogs for {selectedBreedCode2}...
          </section>
        ) : dogs.length === 0 ? (
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            Click Browse Dogs.
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {dogs.map((dog) => (
              <article
                key={dog.dogId}
                className="overflow-hidden rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] shadow-[0_22px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(124,58,237,0.22),rgba(255,255,255,0.02))] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-purple-200">
                        {dog.breedName}{" "}
                        <span className="text-purple-100/60">({dog.breedCode2})</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-bold text-white">
                        {dog.displayName}
                      </h2>
                      <div className="mt-2 text-sm text-purple-100/70">
                        {dog.regNumber}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-right">
                      <div className="text-xs uppercase tracking-wide text-purple-200">
                        Price
                      </div>
                      <div className="mt-1 text-xl font-bold text-white">
                        {formatMoney(dog.price)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5">
                  <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-purple-200">
                        Sex
                      </div>
                      <div className="mt-1 font-medium text-white">{dog.sex}</div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-purple-200">
                        Age
                      </div>
                      <div className="mt-1 font-medium text-white">
                        {formatAge(dog.ageHours)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Seller
                    </div>
                    <div className="mt-1 font-medium text-white">
                      {dog.sellerType === "SYSTEM"
                        ? "Foundation Market"
                        : dog.sellerKennelName ?? "Player Kennel"}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-200">
                      Visible Ring Categories
                    </h3>

                    <div className="space-y-3">
                      {Object.entries(dog.visibleCategories).map(([key, value]) => (
                        <TraitLine
                          key={key}
                          label={formatCategoryName(key)}
                          value={value}
                          min={0}
                          max={20}
                          ideal={10}
                          leftLabel="0"
                          rightLabel="20"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex items-stretch gap-3">
                    <Link
                      href={`/dogs/${dog.dogId}`}
                      className="flex-[1.45] rounded-2xl bg-purple-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-purple-500"
                    >
                      View Dog
                    </Link>

                    <button
                      onClick={() => handleBuy(dog)}
                      disabled={buyingDogId === dog.dogId || dog.isOwnedByCurrentKennel}
                      className="flex-1 rounded-2xl border border-purple-300/25 bg-white/5 px-3 py-3 text-xs font-semibold text-purple-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
