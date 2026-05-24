"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BREEDING_FEE,
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
} from "@showring/rules";

type VisibleCategories = Record<string, number>;

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
  visibleCategories: VisibleCategories;
};

type Props = {
  kennelId: string;
  kennelName: string;
  kennelBalance: number;
  dogs: DogCardDto[];
  initialDogId: string | null;
};

const USUAL_PREG_CHECK_DAYS = 28;
const USUAL_GESTATION_DAYS = 56;

function dogDisplayName(dog: DogCardDto) {
  return dog.registeredName || dog.callName || dog.regNumber;
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

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function reasonDogUnavailable(dog: DogCardDto) {
  if (dog.lifecycleState !== "ALIVE") return "Not alive";
  if (dog.inBreedingConflict) return "Already in breeding cycle";
  if (dog.ageHours < MIN_BREED_AGE_HOURS) return "Too young to breed";
  if (dog.sex === "F" && dog.ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return "Past dam breeding age";
  }
  if (!dog.isEligibleToBreed) return "Not eligible";
  return null;
}

function sortedByAgeThenName(dogs: DogCardDto[]) {
  return [...dogs].sort((a, b) => {
    const ageCompare = b.ageHours - a.ageHours;
    if (ageCompare !== 0) return ageCompare;
    return dogDisplayName(a).localeCompare(dogDisplayName(b));
  });
}

function markerColor(value: number) {
  const distance = Math.abs(value - 10);

  if (distance <= 0.5) return "#22c55e";
  if (distance <= 2) return "#84cc16";
  if (distance <= 4) return "#eab308";
  if (distance <= 6) return "#f97316";
  return "#dc2626";
}

function MiniTraitSummary({ dog }: { dog: DogCardDto }) {
  const entries = Object.entries(dog.visibleCategories);

  return (
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
      {entries.map(([key, value]) => {
        const safeValue = Math.max(0, Math.min(20, value));
        const valuePercent = (safeValue / 20) * 100;

        return (
          <div key={key} className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-purple-100/75">
                {formatCategoryName(key)}
              </span>
              <span className="font-semibold text-white">
                {safeValue.toFixed(1)}
              </span>
            </div>
            <div className="relative mt-1 h-3">
              <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded bg-white/20" />
              <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 rounded bg-emerald-300/80" />
              <div
                className="absolute top-1/2 h-3 w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.24)]"
                style={{
                  left: `${valuePercent}%`,
                  backgroundColor: markerColor(safeValue),
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DogSummaryHeader({ dog }: { dog: DogCardDto }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-base font-semibold text-white">
          {dogDisplayName(dog)}
        </div>
        <div className="mt-1 text-sm text-purple-100/70">{dog.regNumber}</div>
      </div>
      <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-purple-100">
        {sexLabel(dog.sex)}
      </div>
    </div>
  );
}

function DogMeta({ dog }: { dog: DogCardDto }) {
  return (
    <div className="mt-3 grid gap-2 text-sm text-purple-100/80 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
      <div>Breed: {dog.breedName}</div>
      <div>Age: {ageLabel(dog.ageHours)}</div>
    </div>
  );
}

function AnchoredDogCard({ dog }: { dog: DogCardDto }) {
  const unavailable = reasonDogUnavailable(dog);

  return (
    <section className="z-20 rounded-2xl border border-purple-300/25 bg-[linear-gradient(180deg,rgba(42,22,58,0.98),rgba(20,10,30,0.98))] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.35)] lg:col-span-3 lg:sticky lg:top-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
        Selected Dog
      </div>
      <div className="mt-3">
        <DogSummaryHeader dog={dog} />
        <DogMeta dog={dog} />
      </div>

      {unavailable ? (
        <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200">
          {unavailable}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">
          Eligible
        </div>
      )}

      <div className="mt-4">
        <MiniTraitSummary dog={dog} />
      </div>
    </section>
  );
}

function MateCard({
  dog,
  selected,
  onSelect,
}: {
  dog: DogCardDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? "border-purple-300 bg-purple-500/20"
          : "border-white/10 bg-black/20 hover:border-purple-300/40"
      }`}
    >
      <DogSummaryHeader dog={dog} />
      <DogMeta dog={dog} />

      <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
        <MiniTraitSummary dog={dog} />
      </div>
    </button>
  );
}

function SummaryCard({
  kennelName,
  kennelBalance,
  selectedSire,
  selectedDam,
  canSubmit,
  submitting,
  errorMessage,
  successMessage,
  redirecting,
  onSubmit,
}: {
  kennelName: string;
  kennelBalance: number;
  selectedSire: DogCardDto | null;
  selectedDam: DogCardDto | null;
  canSubmit: boolean;
  submitting: boolean;
  errorMessage: string;
  successMessage: string;
  redirecting: boolean;
  onSubmit: () => void;
}) {
  return (
    <aside className="rounded-2xl border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] xl:sticky xl:top-4">
      <h2 className="text-xl font-semibold text-white">Breeding Summary</h2>

      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">
            Kennel
          </div>
          <div className="mt-1 text-sm font-medium text-white">{kennelName}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">
            Sire
          </div>
          <div className="mt-1 text-sm font-medium text-white">
            {selectedSire ? dogDisplayName(selectedSire) : "Not selected"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">
            Dam
          </div>
          <div className="mt-1 text-sm font-medium text-white">
            {selectedDam ? dogDisplayName(selectedDam) : "Not selected"}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
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

        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-purple-100/80">
          <div>Pregnancy check: usually {USUAL_PREG_CHECK_DAYS} game days</div>
          <div className="mt-2">
            Expected whelping: usually {USUAL_GESTATION_DAYS} game days
          </div>
          <div className="mt-2 text-purple-200/90">
            Timing can vary by one or two days.
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || redirecting}
          className="w-full rounded-xl bg-[linear-gradient(90deg,#dc2626,#facc15,#22c55e,#facc15,#dc2626)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {redirecting
            ? "Confirmed"
            : submitting
              ? "Creating Breeding..."
              : "Confirm Breeding"}
        </button>
      </div>
    </aside>
  );
}

export default function BreedPageClient({
  kennelName,
  kennelBalance,
  dogs,
  initialDogId,
}: Props) {
  const router = useRouter();
  const initialDog = dogs.find((dog) => dog.id === initialDogId) ?? null;
  const [sireId, setSireId] = useState<string>(
    initialDog?.sex === "M" ? initialDog.id : ""
  );
  const [damId, setDamId] = useState<string>(
    initialDog?.sex === "F" ? initialDog.id : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const eligibleDogs = useMemo(
    () => sortedByAgeThenName(dogs.filter((dog) => dog.isEligibleToBreed)),
    [dogs]
  );

  const males = useMemo(
    () => eligibleDogs.filter((dog) => dog.sex === "M"),
    [eligibleDogs]
  );
  const females = useMemo(
    () => eligibleDogs.filter((dog) => dog.sex === "F"),
    [eligibleDogs]
  );

  const selectedSire = dogs.find((dog) => dog.id === sireId) ?? null;
  const selectedDam = dogs.find((dog) => dog.id === damId) ?? null;
  const anchorDog = initialDog;

  const mateDogs = useMemo(() => {
    if (!anchorDog) return [];

    return eligibleDogs.filter(
      (dog) =>
        dog.id !== anchorDog.id &&
        dog.sex !== anchorDog.sex &&
        dog.breedCode2 === anchorDog.breedCode2
    );
  }, [anchorDog, eligibleDogs]);

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

  function selectMate(dog: DogCardDto) {
    if (dog.sex === "M") {
      setSireId(dog.id);
      return;
    }

    setDamId(dog.id);
  }

  async function handleSubmit() {
    if (!selectedSire || !selectedDam) return;

    setSubmitting(true);
    setRedirecting(false);
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

      const returnDogId = anchorDog?.id ?? selectedDam.id ?? selectedSire.id;

      setRedirecting(true);
      setSuccessMessage("Confirmed. Returning to the dog page...");

      window.setTimeout(() => {
        router.push(`/dogs/${returnDogId}`);
      }, 900);
    } catch {
      setErrorMessage("Something went wrong while creating the breeding.");
    } finally {
      if (!redirecting) {
        setSubmitting(false);
      }
    }
  }

  if (anchorDog) {
    const selectedMate =
      anchorDog.sex === "M" ? selectedDam : selectedSire;
    const mateLabel = anchorDog.sex === "M" ? "Select Dam" : "Select Sire";
    const emptyLabel =
      anchorDog.sex === "M"
        ? "No eligible bitches of this breed are available."
        : "No eligible dogs of this breed are available.";

    return (
      <div className="grid gap-5 lg:grid-cols-12">
        <AnchoredDogCard dog={anchorDog} />

        <section className="rounded-2xl border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] lg:col-span-6 xl:col-span-6">
          <h2 className="text-xl font-semibold text-white">{mateLabel}</h2>
          <p className="mt-2 text-sm leading-7 text-purple-100/70">
            Eligible {anchorDog.breedName} mates from your kennel.
          </p>

          <div className="mt-6 space-y-4">
            {mateDogs.length > 0 ? (
              mateDogs.map((dog) => (
                <MateCard
                  key={dog.id}
                  dog={dog}
                  selected={selectedMate?.id === dog.id}
                  onSelect={() => selectMate(dog)}
                />
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
                {emptyLabel}
              </div>
            )}
          </div>
        </section>

        <div className="lg:col-span-3">
          <SummaryCard
            kennelName={kennelName}
            kennelBalance={kennelBalance}
            selectedSire={selectedSire}
            selectedDam={selectedDam}
            canSubmit={canSubmit}
            submitting={submitting}
            errorMessage={errorMessage}
            successMessage={successMessage}
            redirecting={redirecting}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr,1.5fr,1fr]">
      <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-semibold text-white">Select Sire</h2>
        <p className="mt-2 text-sm leading-7 text-purple-100/70">
          Choose an eligible male you own.
        </p>

        <div className="mt-6 space-y-4">
          {filteredSires.length > 0 ? (
            filteredSires.map((dog) => (
              <MateCard
                key={dog.id}
                dog={dog}
                selected={sireId === dog.id}
                onSelect={() => setSireId(dog.id)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
              No eligible dogs match the current pairing.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <h2 className="text-xl font-semibold text-white">Select Dam</h2>
        <p className="mt-2 text-sm leading-7 text-purple-100/70">
          Choose an eligible female of the same breed.
        </p>

        <div className="mt-6 space-y-4">
          {filteredDams.length > 0 ? (
            filteredDams.map((dog) => (
              <MateCard
                key={dog.id}
                dog={dog}
                selected={damId === dog.id}
                onSelect={() => setDamId(dog.id)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
              No eligible bitches match the current pairing.
            </div>
          )}
        </div>
      </section>

      <SummaryCard
        kennelName={kennelName}
        kennelBalance={kennelBalance}
        selectedSire={selectedSire}
        selectedDam={selectedDam}
        canSubmit={canSubmit}
        submitting={submitting}
        errorMessage={errorMessage}
        successMessage={successMessage}
        redirecting={redirecting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
