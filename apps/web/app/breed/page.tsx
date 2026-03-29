"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

type BreedingAttemptDto = {
  id: string;
  sireId: string;
  damId: string;
  breedCode2: string;
  createdEpoch: number;
  pregCheckEpoch: number | null;
  dueEpoch: number | null;
  checkedEpoch: number | null;
  isPregnant: boolean | null;
  status: string;
  sireName: string;
  damName: string;
  hoursUntilPregCheck: number | null;
  hoursUntilDue: number | null;
};

type BreedingListResponse = {
  ok: boolean;
  currentEpoch?: number;
  breedings?: BreedingAttemptDto[];
  error?: string;
};

type CreateBreedingResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

const MIN_BREED_AGE_HOURS = 730;
const DAM_MAX_BREED_AGE_HOURS = 2520;

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

function isBreedEligible(dog: KennelDogDto): boolean {
  if (dog.ageHours < MIN_BREED_AGE_HOURS) {
    return false;
  }

  if (dog.sex === "F" && dog.ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return false;
  }

  return true;
}

function dogLabel(dog: KennelDogDto) {
  return dog.callName ?? dog.regNumber;
}

export default function BreedPage() {
  const searchParams = useSearchParams();
  const dogIdFromQuery = searchParams.get("dogId") ?? "";

  const [dogs, setDogs] = useState<KennelDogDto[]>([]);
  const [kennel, setKennel] = useState<KennelSummary | null>(null);
  const [selectedDogId, setSelectedDogId] = useState("");
  const [activeBreedings, setActiveBreedings] = useState<BreedingAttemptDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingMateId, setSubmittingMateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDogs() {
    const res = await fetch("/api/dogs/mine", {
      method: "GET",
      cache: "no-store",
    });

    const data: KennelDogsResponse = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load kennel dogs.");
    }

    setDogs(data.dogs ?? []);
    setKennel(data.kennel ?? null);
  }

  async function loadBreedings(dogId: string) {
    if (!dogId) {
      setActiveBreedings([]);
      return;
    }

    const res = await fetch(`/api/breedings?dogId=${encodeURIComponent(dogId)}`, {
      method: "GET",
      cache: "no-store",
    });

    const data: BreedingListResponse = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load breeding status.");
    }

    setActiveBreedings(data.breedings ?? []);
  }

  async function reloadAll(nextDogId?: string) {
    setLoading(true);
    setError(null);

    try {
      await loadDogs();

      const dogToUse = nextDogId || selectedDogId || dogIdFromQuery;
      if (dogToUse) {
        await loadBreedings(dogToUse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load breeding page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
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

        if (cancelled) return;

        const loadedDogs = data.dogs ?? [];
        setDogs(loadedDogs);
        setKennel(data.kennel ?? null);

        const initialDogId =
          (dogIdFromQuery &&
            loadedDogs.some((dog) => dog.dogId === dogIdFromQuery) &&
            dogIdFromQuery) ||
          loadedDogs[0]?.dogId ||
          "";

        setSelectedDogId(initialDogId);

        if (initialDogId) {
          const breedingRes = await fetch(
            `/api/breedings?dogId=${encodeURIComponent(initialDogId)}`,
            {
              method: "GET",
              cache: "no-store",
            }
          );

          const breedingData: BreedingListResponse = await breedingRes.json();

          if (!breedingRes.ok || !breedingData.ok) {
            throw new Error(breedingData.error || "Failed to load breeding status.");
          }

          if (!cancelled) {
            setActiveBreedings(breedingData.breedings ?? []);
          }
        } else {
          setActiveBreedings([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load breeding page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [dogIdFromQuery]);

  async function handleDogChange(nextDogId: string) {
    setSelectedDogId(nextDogId);
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      await loadBreedings(nextDogId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load breeding status."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleBreed(mateDogId: string) {
    if (!selectedDogId) return;

    setSubmittingMateId(mateDogId);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/breedings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryDogId: selectedDogId,
          mateDogId,
        }),
      });

      const data: CreateBreedingResponse = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Breeding attempt failed.");
      }

      setMessage(data.message ?? "Breeding attempt created.");
      await loadBreedings(selectedDogId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Breeding attempt failed.");
    } finally {
      setSubmittingMateId(null);
    }
  }

  const selectedDog = useMemo(
    () => dogs.find((dog) => dog.dogId === selectedDogId) ?? null,
    [dogs, selectedDogId]
  );

  const selectedDogEligible = selectedDog ? isBreedEligible(selectedDog) : false;

  const selectedDogHasActiveBreeding = useMemo(() => {
    if (!selectedDog) return false;

    return activeBreedings.some(
      (attempt) =>
        attempt.status === "INITIATED" ||
        attempt.status === "PREGNANT"
    );
  }, [activeBreedings, selectedDog]);

  const compatibleMates = useMemo(() => {
    if (!selectedDog) return [];

    return dogs.filter((dog) => {
      if (dog.dogId === selectedDog.dogId) return false;
      if (dog.breedCode2 !== selectedDog.breedCode2) return false;
      if (dog.sex === selectedDog.sex) return false;
      if (!isBreedEligible(dog)) return false;
      return true;
    });
  }, [dogs, selectedDog]);

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="mb-8 rounded-[28px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Breeding
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Breeding page
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75 sm:text-base">
                Select one owned dog, choose a compatible owned mate, and create a
                breeding attempt. Pregnancy does not resolve instantly in this build:
                the check happens after 30 hours, and the due point is 60 hours. 
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/kennel"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Back to My Kennel
              </Link>

              {selectedDog ? (
                <Link
                  href={`/dogs/${selectedDog.dogId}`}
                  className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Back to Dog Profile
                </Link>
              ) : null}
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
            Loading breeding page...
          </div>
        ) : !kennel || dogs.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
            You need owned dogs before you can breed.
          </div>
        ) : (
          <>
            <section className="mb-8 rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <div>
                  <label
                    htmlFor="selectedDog"
                    className="mb-2 block text-sm font-semibold uppercase tracking-wide text-purple-200"
                  >
                    Selected Dog
                  </label>

                  <select
                    id="selectedDog"
                    value={selectedDogId}
                    onChange={(e) => handleDogChange(e.target.value)}
                    className="w-full rounded-2xl border border-purple-300/20 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                  >
                    {dogs.map((dog) => (
                      <option key={dog.dogId} value={dog.dogId}>
                        {dogLabel(dog)} — {dog.breedName} ({dog.breedCode2}) —{" "}
                        {dog.sex}
                      </option>
                    ))}
                  </select>

                  {selectedDog ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
                      <div className="text-sm font-medium text-purple-200">
                        {selectedDog.breedName}{" "}
                        <span className="text-purple-100/60">
                          ({selectedDog.breedCode2})
                        </span>
                      </div>

                      <h2 className="mt-2 text-2xl font-bold text-white">
                        {dogLabel(selectedDog)}
                      </h2>

                      <div className="mt-2 text-sm text-purple-100/70">
                        {selectedDog.regNumber}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            Sex
                          </div>
                          <div className="mt-1 font-medium text-white">
                            {selectedDog.sex}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            Age
                          </div>
                          <div className="mt-1 font-medium text-white">
                            {formatAge(selectedDog.ageHours)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            Eligibility
                          </div>
                          <div className="mt-1 font-medium text-white">
                            {selectedDogEligible ? "Eligible" : "Not eligible"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <h2 className="text-lg font-semibold text-white">
                    Active breeding status
                  </h2>

                  {activeBreedings.length === 0 ? (
                    <p className="mt-3 text-sm leading-7 text-purple-100/70">
                      No active breeding attempt is attached to this dog.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {activeBreedings.map((attempt) => (
                        <div
                          key={attempt.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            {attempt.status}
                          </div>

                          <div className="mt-2 text-sm font-medium text-white">
                            {attempt.sireName} × {attempt.damName}
                          </div>

                          {attempt.status === "INITIATED" ? (
                            <p className="mt-2 text-sm text-purple-100/70">
                              Pregnancy check in{" "}
                              {attempt.hoursUntilPregCheck ?? 0} hour(s).
                            </p>
                          ) : null}

                          {attempt.status === "PREGNANT" ? (
                            <p className="mt-2 text-sm text-purple-100/70">
                              Gestation in progress. Due in{" "}
                              {attempt.hoursUntilDue ?? 0} hour(s).
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {!selectedDog ? null : !selectedDogEligible ? (
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                This dog is not currently breeding eligible.
              </section>
            ) : selectedDogHasActiveBreeding ? (
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                This dog already has an active breeding in progress. Wait for the
                pregnancy check or due point before creating another breeding.
              </section>
            ) : compatibleMates.length === 0 ? (
              <section className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-purple-100/75 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                No compatible owned mates are available right now.
              </section>
            ) : (
              <section>
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold text-white">
                    Compatible mates
                  </h2>
                  <p className="mt-1 text-sm text-purple-100/60">
                    Same breed, opposite sex, alive, and breeding-age eligible.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {compatibleMates.map((mate) => (
                    <article
                      key={mate.dogId}
                      className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(42,22,58,0.96),rgba(20,10,30,0.98))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-purple-200">
                            {mate.breedName}{" "}
                            <span className="text-purple-100/60">
                              ({mate.breedCode2})
                            </span>
                          </div>

                          <h3 className="mt-2 text-xl font-semibold text-white">
                            {dogLabel(mate)}
                          </h3>

                          <p className="mt-1 text-sm text-purple-100/60">
                            {mate.regNumber}
                          </p>
                        </div>

                        <div className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-100">
                          {mate.sex}
                        </div>
                      </div>

                      <div className="mb-5 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            Age
                          </div>
                          <div className="mt-1 font-medium text-white">
                            {formatAge(mate.ageHours)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-purple-200">
                            Origin
                          </div>
                          <div className="mt-1 font-medium text-white">
                            {mate.originType}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-200">
                          Visible Categories
                        </h4>

                        <div className="space-y-3">
                          {Object.entries(mate.visibleCategories).map(([key, value]) => (
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

                      <div className="mt-5 flex gap-3">
                        <Link
                          href={`/dogs/${mate.dogId}`}
                          className="flex-1 rounded-2xl border border-purple-300/25 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                        >
                          View Dog
                        </Link>

                        <button
                          onClick={() => handleBreed(mate.dogId)}
                          disabled={submittingMateId === mate.dogId}
                          className="flex-1 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submittingMateId === mate.dogId
                            ? "Creating..."
                            : "Breed Pair"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

