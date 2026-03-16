"use client";

import { useEffect, useMemo, useState } from "react";

type VisibleCategories = Record<string, number>;

type FoundationDogMarketDto = {
  listingId: string;
  dogId: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  price: number;
  visibleCategories: VisibleCategories;
};

type FoundationDogsResponse = {
  ok: boolean;
  dogs?: FoundationDogMarketDto[];
  error?: string;
};

type BuyDogResponse = {
  ok: boolean;
  dog?: FoundationDogMarketDto;
  error?: string;
};

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0
      ? `${years}y ${remainingWeeks}w`
      : `${years}y`;
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

export default function FoundationMarketPage() {
  const [dogs, setDogs] = useState<FoundationDogMarketDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyingDogId, setBuyingDogId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [breedFilter, setBreedFilter] = useState("");

  async function loadDogs(selectedBreed?: string) {
    setLoading(true);
    setError(null);

    try {
      const query = selectedBreed?.trim()
        ? `?breedCode2=${encodeURIComponent(selectedBreed.trim().toUpperCase())}`
        : "";

      const res = await fetch(`/api/foundation-dogs${query}`, {
        method: "GET",
        cache: "no-store",
      });

      const data: FoundationDogsResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load foundation dogs.");
      }

      setDogs(data.dogs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market.");
      setDogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDogs();
  }, []);

  const breedOptions = useMemo(() => {
    return Array.from(new Set(dogs.map((dog) => dog.breedCode2))).sort();
  }, [dogs]);

  async function handleApplyBreedFilter() {
    setMessage(null);
    await loadDogs(breedFilter);
  }

  async function handleClearBreedFilter() {
    setBreedFilter("");
    setMessage(null);
    await loadDogs();
  }

  async function handleBuy(dog: FoundationDogMarketDto) {
    setBuyingDogId(dog.dogId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/foundation-dogs/${dog.dogId}/buy`, {
        method: "POST",
      });

      const data: BuyDogResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Purchase failed.");
      }

      setMessage(
        `Purchased ${dog.callName ?? dog.regNumber} (${dog.breedCode2}).`
      );

      await loadDogs(breedFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBuyingDogId(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Foundation Market
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Browse system-generated foundation dogs available for purchase.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="breedFilter" className="text-sm font-medium">
              Filter by breed
            </label>
            <input
              id="breedFilter"
              type="text"
              list="foundation-breeds"
              value={breedFilter}
              onChange={(e) => setBreedFilter(e.target.value.toUpperCase())}
              placeholder="Enter breed code"
              className="rounded-md border px-3 py-2 text-sm"
            />
            <datalist id="foundation-breeds">
              {breedOptions.map((breedCode2) => (
                <option key={breedCode2} value={breedCode2} />
              ))}
            </datalist>
          </div>

          <button
            onClick={handleApplyBreedFilter}
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Apply
          </button>

          <button
            onClick={handleClearBreedFilter}
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {message ? (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border p-6 text-sm text-neutral-600">
          Loading foundation dogs...
        </div>
      ) : dogs.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-neutral-600">
          No foundation dogs available right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dogs.map((dog) => (
            <article
              key={dog.dogId}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {dog.callName ?? "Unnamed"}
                  </h2>
                  <p className="text-sm text-neutral-600">{dog.regNumber}</p>
                </div>

                <div className="rounded-full border px-3 py-1 text-xs font-medium">
                  {dog.breedCode2}
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-neutral-500">Sex:</span>{" "}
                  <span className="font-medium">{dog.sex}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Age:</span>{" "}
                  <span className="font-medium">{formatAge(dog.ageHours)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-neutral-500">Price:</span>{" "}
                  <span className="font-semibold">{formatMoney(dog.price)}</span>
                </div>
              </div>

              <div className="mb-5">
                <h3 className="mb-2 text-sm font-semibold">
                  Visible Categories
                </h3>
                <div className="space-y-2">
                  {Object.entries(dog.visibleCategories).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2 text-sm"
                    >
                      <span>{formatCategoryName(key)}</span>
                      <span className="font-semibold">{value.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleBuy(dog)}
                disabled={buyingDogId === dog.dogId}
                className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {buyingDogId === dog.dogId ? "Buying..." : "Buy Dog"}
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
