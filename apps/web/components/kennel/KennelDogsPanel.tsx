"use client";

import { useEffect, useState } from "react";

type VisibleCategories = Record<string, number>;

type KennelDogDto = {
  dogId: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  marketState: string;
  originType: string;
  isFoundation: boolean;
  visibleCategories: VisibleCategories;
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

function formatAge(ageHours: number): string {
  const weeks = Math.floor(ageHours / 7);
  const years = Math.floor(weeks / 52);

  if (years >= 1) {
    const remainingWeeks = weeks % 52;
    return remainingWeeks > 0 ? `${years}y ${remainingWeeks}w` : `${years}y`;
  }

  return `${weeks}w`;
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function KennelDogsPanel() {
  const [dogs, setDogs] = useState<KennelDogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDogs() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/dogs/mine", {
        method: "GET",
        cache: "no-store",
      });

      const data: KennelDogsResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load kennel dogs.");
      }

      setDogs(data.dogs ?? []);
    } catch (err) {
      setDogs([]);
      setError(
        err instanceof Error ? err.message : "Failed to load kennel dogs."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDogs();
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My Dogs</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Dogs currently owned by this kennel.
          </p>
        </div>

        <button
          onClick={loadDogs}
          className="rounded-md border px-4 py-2 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border bg-neutral-900 p-6 text-sm text-neutral-600 shadow-sm">
          Loading kennel dogs...
        </div>
      ) : dogs.length === 0 ? (
        <div className="rounded-xl border bg-neutral-900 p-6 text-sm text-neutral-600 shadow-sm">
          You do not own any dogs yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dogs.map((dog) => (
            <article
              key={dog.dogId}
              className="rounded-2xl border bg-neutral-900 p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    {dog.callName ?? "Unnamed"}
                  </h3>
                  <p className="text-sm text-neutral-600">{dog.regNumber}</p>
                </div>

                <div className="rounded-full border px-3 py-1 text-xs font-medium">
                  {dog.breedCode2}
                </div>
              </div>

              <div className="mb-4 space-y-1 text-sm">
                <div>
                  <span className="text-neutral-500">Breed:</span>{" "}
                  <span className="font-medium">
                    {dog.breedName} ({dog.breedCode2})
                  </span>
                </div>

                <div>
                  <span className="text-neutral-500">Sex:</span>{" "}
                  <span className="font-medium">{dog.sex}</span>
                </div>

                <div>
                  <span className="text-neutral-500">Age:</span>{" "}
                  <span className="font-medium">{formatAge(dog.ageHours)}</span>
                </div>

                <div>
                  <span className="text-neutral-500">Origin:</span>{" "}
                  <span className="font-medium">{dog.originType}</span>
                </div>

                <div>
                  <span className="text-neutral-500">Market State:</span>{" "}
                  <span className="font-medium">{dog.marketState}</span>
                </div>

                <div>
                  <span className="text-neutral-500">Foundation:</span>{" "}
                  <span className="font-medium">
                    {dog.isFoundation ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Visible Categories
                </h4>

                <div className="space-y-2">
                  {Object.entries(dog.visibleCategories).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-200"
                    >
                      <span>{formatCategoryName(key)}</span>
                      <span className="font-semibold">
                        {typeof value === "number" ? value.toFixed(1) : value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

