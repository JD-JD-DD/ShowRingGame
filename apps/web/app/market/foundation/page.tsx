"use client";

import Link from "next/link";
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

function scoreToBarWidth(value: number): string {
  const safe = Math.max(0, Math.min(20, value));
  return `${(safe / 20) * 100}%`;
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

      setMessage(`Purchased ${dog.callName ?? dog.regNumber} (${dog.breedCode2}).`);
      await loadDogs(breedFilter);
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
            <div>
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Foundation Market
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Browse foundation dogs
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75 sm:text-base">
                These are system-generated dogs available to start or strengthen your
                kennel. Players see visible ring categories only. Hidden structural
                traits remain private. :contentReference[oaicite:1]{index=1}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Back to My Kennel
              </Link>

              <Link
                href="/dogs"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Dogs Directory
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-[24px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.78),rgba(24,12,35,0.88))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Current Listings
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{dogs.length}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Buying Goal
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  Find useful stock, not perfect stock
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Market Rule
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  Foundation dogs stay below elite bred dogs
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="breedFilter"
                  className="text-sm font-medium text-purple-100"
                >
                  Filter by breed code
                </label>
                <input
                  id="breedFilter"
                  type="text"
                  list="foundation-breeds"
                  value={breedFilter}
                  onChange={(e) => setBreedFilter(e.target.value.toUpperCase())}
                  placeholder="Enter breed code"
                  className="rounded-xl border border-purple-300/20 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/40"
                />
                <datalist id="foundation-breeds">
                  {breedOptions.map((breedCode2) => (
                    <option key={breedCode2} value={breedCode2} />
                  ))}
                </datalist>
              </div>

              <button
                onClick={handleApplyBreedFilter}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
              >
                Apply
              </button>

              <button
                onClick={handleClearBreedFilter}
                className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>
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

        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            Loading foundation dogs...
          </div>
        ) : dogs.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            No foundation dogs are available right now.
          </div>
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
                      <div className="text-xs uppercase tracking-[0.18em] text-purple-200">
                        {dog.breedCode2}
                      </div>
                      <h2 className="mt-2 text-2xl font-bold text-white">
                        {dog.callName ?? "Unnamed"}
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

                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-200">
                      Visible Ring Categories
                    </h3>

                    <div className="space-y-3">
                      {Object.entries(dog.visibleCategories).map(([key, value]) => (
                        <div key={key}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                            <span className="text-purple-100/80">
                              {formatCategoryName(key)}
                            </span>
                            <span className="font-semibold text-white">
                              {value.toFixed(1)}
                            </span>
                          </div>

                          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#a855f7)]"
                              style={{ width: scoreToBarWidth(value) }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link
                      href={`/dogs/${dog.dogId}`}
                      className="flex-1 rounded-2xl border border-purple-300/25 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      View Dog
                    </Link>

                    <button
                      onClick={() => handleBuy(dog)}
                      disabled={buyingDogId === dog.dogId}
                      className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {buyingDogId === dog.dogId ? "Buying..." : "Buy Dog"}
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

