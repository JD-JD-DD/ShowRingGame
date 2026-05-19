"use client";

import { useMemo, useState } from "react";
import TraitLine from "@/components/ui/TraitLine";

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

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function sortedByAgeThenName(dogs: DogCardDto[]) {
  return [...dogs].sort((a, b) => {
    const ageCompare = b.ageHours - a.ageHours;
    if (ageCompare !== 0) return ageCompare;
    return dogDisplayName(a).localeCompare(dogDisplayName(b));
  });
}

function TraitSummary({ dog, compact = false }: { dog: DogCardDto; compact?: boolean }) {
  const entries = Object.entries(dog.visibleCategories);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {entries.map(([key, value]) => (
        <TraitLine
          key={key}
          label={formatCategoryName(key)}
          value={value}
          min={0}
          max={20}
          ideal={10}
          leftLabel="Poor"
          rightLabel="Poor"
        />
      ))}
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
    <div className="mt-4 grid gap-2 text-sm text-purple-100/80 sm:grid-cols-2">
      <div>Breed: {dog.breedName}</div>
      <div>Age: {ageLabel(dog.ageHours)}</div>
    </div>
  );
}

function AnchoredDogCard({ dog }: { dog: DogCardDto }) {
  const unavailable = reasonDogUnavailable(dog);

  return (
    <section className="sticky top-4 z-20 rounded-[28px] border border-purple-300/25 bg-[linear-gradient(180deg,rgba(42,22,58,0.98),rgba(20,10,30,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
        Selected Dog
      </div>
      <div className="mt-4">
        <DogSummaryHeader dog={dog} />
        <DogMeta dog={dog} />
      </div>

      {unavailable ? (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {unavailable}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
          Eligible
        </div>
      )}

      <div className="mt-5">
        <TraitSummary dog={dog} compact />
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

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3">
        <TraitSummary dog={dog} compact />
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
  onSubmit: () => void;
}) {
  return (
    <aside className="sticky top-4 rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <h2 className="text-xl font-semibold text-white">Breeding Summary</h2>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-purple-200">
            Kennel
          </div>
          <div className="mt-1 text-sm font-medium text-white">{kennelName}</div>
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
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-[linear-gradient(90deg,#dc2626,#facc15,#22c55e,#facc15,#dc2626)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Creating Breeding..." : "Confirm Breeding"}
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
  const initialDog = dogs.find((dog) => dog.id === initialDogId) ?? null;
  const [sireId, setSireId] = useState<string>(
    initialDog?.sex === "M" ? initialDog.id : ""
  );
  const [damId, setDamId] = useState<string>(
    initialDog?.sex === "F" ? initialDog.id : ""
  );
  const [submitting, setSubmitting] = useState(false);
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

  if (anchorDog) {
    const selectedMate =
      anchorDog.sex === "M" ? selectedDam : selectedSire;
    const mateLabel = anchorDog.sex === "M" ? "Select Dam" : "Select Sire";
    const emptyLabel =
      anchorDog.sex === "M"
        ? "No eligible bitches of this breed are available."
        : "No eligible dogs of this breed are available.";

    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,420px),minmax(0,1fr),minmax(280px,360px)]">
        <AnchoredDogCard dog={anchorDog} />

        <section className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
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
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-purple-100/70">
                {emptyLabel}
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
          onSubmit={handleSubmit}
        />
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
        onSubmit={handleSubmit}
      />
    </div>
  );
}
