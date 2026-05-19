"use client";

import { useMemo, useState } from "react";

type DogCardDto = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  ownerKennelName: string | null;
  isEligibleToBreed: boolean;
  inBreedingConflict: boolean;
};

type Props = {
  kennelId: string;
  kennelName: string;
  kennelBalance: number;
  dogs: DogCardDto[];
};

const BREEDING_FEE = 500;
const USUAL_PREG_CHECK_DAYS = 28;
const USUAL_GESTATION_DAYS = 56;

function dogDisplayName(dog: DogCardDto) {
  return dog.callName || dog.registeredName || dog.regNumber;
}

function ageLabel(ageHours: number) {
  const years = Math.floor(ageHours / 365);
  const days = ageHours % 365;

  if (years <= 0) return `${days} days`;
  return `${years}y ${days}d`;
}

function sexLabel(sex: "M" | "F") {
  return sex === "M" ? "Dog" : "Bitch";
}

function formatGameDays(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value} game days`
    : "soon";
}

function reasonDogUnavailable(dog: DogCardDto) {
  if (dog.lifecycleState !== "ALIVE") return "Not alive";
  if (dog.inBreedingConflict) return "Already in breeding cycle";
  if (!dog.isEligibleToBreed) return "Not eligible";
  return null;
}

export default function BreedPageClient({
  kennelName,
  kennelBalance,
  dogs,
}: Props) {
  const [sireId, setSireId] = useState<string>("");
  const [damId, setDamId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const males = useMemo(() => dogs.filter((d) => d.sex === "M"), [dogs]);
  const females = useMemo(() => dogs.filter((d) => d.sex === "F"), [dogs]);

  const selectedSire = males.find((d) => d.id === sireId) || null;
  const selectedDam = females.find((d) => d.id === damId) || null;

  const filteredDams = useMemo(() => {
    if (!selectedSire) return females;
    return females.filter((dog) => dog.breedCode2 === selectedSire.breedCode2);
  }, [females, selectedSire]);

  const filteredSires = useMemo(() => {
    if (!selectedDam) return males;
    return males.filter((dog) => dog.breedCode2 === selectedDam.breedCode2);
  }, [males, selectedDam]);

  const breedMismatch =
    selectedSire && selectedDam
      ? selectedSire.breedCode2 !== selectedDam.breedCode2
      : false;

  const canSubmit =
    !!selectedSire &&
    !!selectedDam &&
    selectedSire.isEligibleToBreed &&
    selectedDam.isEligibleToBreed &&
    !breedMismatch &&
    kennelBalance >= BREEDING_FEE &&
    !submitting;

  async function handleSubmit() {
    if (!selectedSire || !selectedDam) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/breedings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
            primaryDogId: selectedSire.id,
            mateDogId: selectedDam.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setErrorMessage(data?.error ?? "Breeding could not be created.");
        return;
      }

      const attempt = data?.attempt;
      setSuccessMessage(
        `Breeding created. Pregnancy check in ${formatGameDays(
          attempt?.hoursUntilPregCheck
        )}, due in ${formatGameDays(attempt?.hoursUntilDue)}.`
      );
    } catch {
      setErrorMessage("Something went wrong while creating the breeding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr,1.5fr,1fr]">
      <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-semibold text-white">Select Sire</h2>
        <p className="mt-2 text-sm leading-7 text-purple-100/70">
          Choose an eligible male you own.
        </p>

        <div className="mt-6 space-y-3">
          {filteredSires.map((dog) => {
            const unavailable = reasonDogUnavailable(dog);
            const selected = sireId === dog.id;

            return (
              <button
                key={dog.id}
                type="button"
                onClick={() => setSireId(dog.id)}
                disabled={!dog.isEligibleToBreed}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? "border-purple-300 bg-purple-500/20"
                    : "border-white/10 bg-black/20 hover:border-purple-300/40"
                } ${!dog.isEligibleToBreed ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {dogDisplayName(dog)}
                    </div>
                    <div className="mt-1 text-sm text-purple-100/70">
                      {dog.regNumber}
                    </div>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-purple-100">
                    {sexLabel(dog.sex)}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-purple-100/80 sm:grid-cols-2">
                  <div>Breed: {dog.breedName}</div>
                  <div>Age: {ageLabel(dog.ageHours)}</div>
                </div>

                {unavailable ? (
                  <div className="mt-3 text-xs font-medium text-rose-300">
                    {unavailable}
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-medium text-emerald-300">
                    Eligible
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-semibold text-white">Select Dam</h2>
        <p className="mt-2 text-sm leading-7 text-purple-100/70">
          Choose an eligible female of the same breed.
        </p>

        <div className="mt-6 space-y-3">
          {filteredDams.map((dog) => {
            const unavailable = reasonDogUnavailable(dog);
            const selected = damId === dog.id;

            return (
              <button
                key={dog.id}
                type="button"
                onClick={() => setDamId(dog.id)}
                disabled={!dog.isEligibleToBreed}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? "border-purple-300 bg-purple-500/20"
                    : "border-white/10 bg-black/20 hover:border-purple-300/40"
                } ${!dog.isEligibleToBreed ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {dogDisplayName(dog)}
                    </div>
                    <div className="mt-1 text-sm text-purple-100/70">
                      {dog.regNumber}
                    </div>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-purple-100">
                    {sexLabel(dog.sex)}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-purple-100/80 sm:grid-cols-2">
                  <div>Breed: {dog.breedName}</div>
                  <div>Age: {ageLabel(dog.ageHours)}</div>
                </div>

                {unavailable ? (
                  <div className="mt-3 text-xs font-medium text-rose-300">
                    {unavailable}
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-medium text-emerald-300">
                    Eligible
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-semibold text-white">Breeding Summary</h2>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Kennel
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {kennelName}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Sire
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {selectedSire ? dogDisplayName(selectedSire) : "Not selected"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Dam
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              {selectedDam ? dogDisplayName(selectedDam) : "Not selected"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-purple-100/80">Breeding fee</span>
              <span className="font-semibold text-white">
                ${BREEDING_FEE.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-purple-100/80">Balance after</span>
              <span className="font-semibold text-white">
                ${(kennelBalance - BREEDING_FEE).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/80">
            <div>Pregnancy check: usually {USUAL_PREG_CHECK_DAYS} game days</div>
            <div className="mt-2">
              Expected whelping: usually {USUAL_GESTATION_DAYS} game days
            </div>
            <div className="mt-2 text-purple-200/90">
              Timing can vary by one or two days.
            </div>
          </div>

          {breedMismatch && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Selected dogs are not the same breed.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-[linear-gradient(90deg,#dc2626,#facc15,#22c55e,#facc15,#dc2626)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Creating Breeding..." : "Confirm Breeding"}
          </button>
        </div>
      </aside>
    </div>
  );
}

