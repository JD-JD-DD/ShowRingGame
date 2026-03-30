"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VisibleCategories = Record<string, number>;

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
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
  homeDistrict: string | number | null;
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

function scoreToBarWidth(value: number): string {
  const safe = Math.max(0, Math.min(20, Number(value) || 0));
  return `${(safe / 20) * 100}%`;
}

function formatCountdown(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours <= 0) return "Now";
  return `${hours}d`;
}

function getBreedingStatusStyles(label: BreedingCardStatus["label"]): string {
  switch (label) {
    case "Pregnant":
      return "border-emerald-300/20 bg-emerald-500/10";
    case "Pending Pregnancy Confirmation":
      return "border-amber-300/20 bg-amber-500/10";
    case "Whelped":
      return "border-sky-300/20 bg-sky-500/10";
    case "Available for Stud":
      return "border-indigo-300/20 bg-indigo-500/10";
    case "Not Eligible":
      return "border-rose-300/20 bg-rose-500/10";
    case "Open":
    default:
      return "border-fuchsia-300/20 bg-fuchsia-500/10";
  }
}

function getBreedingStatusTextStyles(label: BreedingCardStatus["label"]): string {
  switch (label) {
    case "Pregnant":
      return "text-emerald-100";
    case "Pending Pregnancy Confirmation":
      return "text-amber-100";
    case "Whelped":
      return "text-sky-100";
    case "Available for Stud":
      return "text-indigo-100";
    case "Not Eligible":
      return "text-rose-100";
    case "Open":
    default:
      return "text-fuchsia-100";
  }
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
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            My Dogs
          </h2>
          <p className="mt-1 text-sm text-purple-100/60">
            Dogs currently owned by this kennel.
          </p>
        </div>

        <button
          onClick={loadDogs}
          className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2 text-sm font-medium text-purple-100 transition hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          Loading kennel dogs...
        </div>
      ) : dogs.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-purple-100/70 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          You do not own any dogs yet.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {dogs.map((dog) => (
            <Link
              key={dog.dogId}
              href={`/dogs/${dog.dogId}`}
              className="group block"
            >
              <article className="h-full rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-1 hover:border-purple-400/30 hover:shadow-[0_26px_70px_rgba(0,0,0,0.45)]">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-purple-200">
                      {dog.breedName}{" "}
                      <span className="text-purple-100/60">
                        ({dog.breedCode2})
                      </span>
                    </div>

                    <h3 className="mt-2 text-xl font-semibold text-white group-hover:text-purple-200">
                      {dog.callName ?? "Unnamed"}
                    </h3>

                    <p className="mt-1 text-sm text-purple-100/60">
                      {dog.regNumber}
                    </p>
                  </div>

                  <div className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
                    {dog.sex}
                  </div>
                </div>

                <div
                  className={`mb-5 rounded-2xl border px-4 py-3 ${getBreedingStatusStyles(
                    dog.breedingCardStatus.label
                  )}`}
                >
                  <div className="text-xs uppercase tracking-wide text-purple-200">
                    Breeding Status
                  </div>
                  <div
                    className={`mt-1 text-sm font-semibold ${getBreedingStatusTextStyles(
                      dog.breedingCardStatus.label
                    )}`}
                  >
                    {dog.breedingCardStatus.label}
                  </div>

                  {dog.breedingCardStatus.pregCheckInHours !== null ? (
                    <div className="mt-2 text-xs text-purple-100/80">
                      Pregnancy check:{" "}
                      {formatCountdown(dog.breedingCardStatus.pregCheckInHours)}
                    </div>
                  ) : null}

                  {dog.breedingCardStatus.dueInHours !== null ? (
                    <div className="mt-1 text-xs text-purple-100/80">
                      Whelp due: {formatCountdown(dog.breedingCardStatus.dueInHours)}
                    </div>
                  ) : null}
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Age
                    </div>
                    <div className="mt-1 font-medium text-white">
                      {formatAge(dog.ageHours)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Origin
                    </div>
                    <div className="mt-1 font-medium text-white">
                      {dog.originType}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Market State
                    </div>
                    <div className="mt-1 font-medium text-white">
                      {dog.marketState}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200">
                      Foundation
                    </div>
                    <div className="mt-1 font-medium text-white">
                      {dog.isFoundation ? "Yes" : "No"}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-200">
                    Visible Categories
                  </h4>

                  <div className="space-y-3">
                    {Object.entries(dog.visibleCategories).map(([key, value]) => (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span className="text-purple-100/80">
                            {formatCategoryName(key)}
                          </span>
                          <span className="font-semibold text-white">
                            {typeof value === "number"
                              ? value.toFixed(1)
                              : String(value)}
                          </span>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#dc2626,#facc15,#22c55e,#facc15,#dc2626)]"
                            style={{
                              width: scoreToBarWidth(
                                typeof value === "number" ? value : Number(value)
                              ),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 text-xs font-medium text-purple-100/40 group-hover:text-purple-200/80">
                  View full profile →
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

