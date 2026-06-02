"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import HealthClearBadge from "@/components/dogs/HealthClearBadge";
import {
  getPhenotypeHealthSeverity,
  hasAllGreenPhenotypeHealthTests,
  type PhenotypeHealthSeverity,
} from "@/lib/dogHealth";
import { formatDogDisplayName } from "@/lib/dogNames";
import { epochToDate } from "@/lib/gameClock";
import {
  BREEDING_FEE,
  calculatePedigreeCoi,
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  WHELPING_COOLDOWN_HOURS,
  getPhenotypeHealthResultLabel,
  type PedigreeDog,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

type VisibleCategories = Record<string, number>;

type HealthTest = {
  testTypeCode: string;
  resultCode: string;
};

type DogCardDto = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  lifecycleState: string;
  ownerKennelName: string | null;
  isOwnedByCurrentKennel: boolean;
  isEligibleToBreed: boolean;
  inBreedingConflict: boolean;
  studListingId: string | null;
  studFeeAmount: number | null;
  coiPercent: number | null;
  lastLitterEpoch: number | null;
  healthTests: HealthTest[];
  visibleCategories: VisibleCategories;
};

type Props = {
  kennelId: string;
  kennelName: string;
  kennelBalance: number;
  currentEpoch: number;
  pedigree: PedigreeDog[];
  dogs: DogCardDto[];
  initialDogId: string | null;
  initialStudListingId: string | null;
};

type SireSource = "ALL" | "OWNED" | "PUBLIC";
type SireSort = "RECOMMENDED" | "LOWEST_COI" | "HEALTH" | "FEE";

const USUAL_PREG_CHECK_DAYS = 28;
const USUAL_GESTATION_DAYS = 56;

const HEALTH_TONES: Record<PhenotypeHealthSeverity, string> = {
  green: "border-emerald-300/35 bg-emerald-500/10 text-emerald-100",
  yellow: "border-amber-300/35 bg-amber-500/10 text-amber-100",
  red: "border-red-400/45 bg-red-500/15 font-bold text-red-200",
};

function dogDisplayName(dog: DogCardDto) {
  return formatDogDisplayName(dog);
}

function ageLabel(ageHours: number) {
  const years = Math.floor(ageHours / 365);
  const days = ageHours % 365;

  if (years <= 0) return `${days} days`;
  return days > 0 ? `${years}y ${days}d` : `${years}y`;
}

function formatMoney(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function formatGameDate(epoch: number) {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCategoryName(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function latestHealthTests(dog: DogCardDto) {
  return PHENOTYPE_HEALTH_TEST_CODES.map((testTypeCode) => ({
    testTypeCode,
    result:
      dog.healthTests.find((test) => test.testTypeCode === testTypeCode) ?? null,
  }));
}

function reasonDogUnavailable(dog: DogCardDto, currentEpoch: number) {
  if (dog.lifecycleState !== "ALIVE") return "Not alive";
  if (dog.ageHours < MIN_BREED_AGE_HOURS) return "Too young to breed";
  if (dog.sex === "F" && dog.ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return "Past dam breeding age";
  }
  if (
    dog.sex === "F" &&
    dog.lastLitterEpoch !== null &&
    currentEpoch < dog.lastLitterEpoch + WHELPING_COOLDOWN_HOURS
  ) {
    return `Post-whelp cooldown: ${
      dog.lastLitterEpoch + WHELPING_COOLDOWN_HOURS - currentEpoch
    } game days remaining`;
  }
  if (dog.inBreedingConflict) return "Already in breeding cycle";
  if (!dog.isEligibleToBreed) return "Not eligible";
  return null;
}

function pairingCoi(sire: DogCardDto | null, dam: DogCardDto | null, pedigree: PedigreeDog[]) {
  if (!sire || !dam) return null;

  return calculatePedigreeCoi({
    sireId: sire.id,
    damId: dam.id,
    pedigree,
  });
}

function ancestorIds(dogId: string, pedigree: PedigreeDog[]) {
  const pedigreeById = new Map(pedigree.map((dog) => [dog.id, dog]));
  const ancestors = new Set<string>();
  let currentIds = [dogId];

  for (let generation = 0; generation < 8 && currentIds.length > 0; generation += 1) {
    const nextIds = new Set<string>();

    for (const currentId of currentIds) {
      const dog = pedigreeById.get(currentId);

      if (!dog) continue;

      for (const parentId of [dog.sireId, dog.damId]) {
        if (parentId && !ancestors.has(parentId)) {
          ancestors.add(parentId);
          nextIds.add(parentId);
        }
      }
    }

    currentIds = [...nextIds];
  }

  return ancestors;
}

function sharedAncestorCount(sire: DogCardDto, dam: DogCardDto, pedigree: PedigreeDog[]) {
  const sireAncestors = ancestorIds(sire.id, pedigree);
  const damAncestors = ancestorIds(dam.id, pedigree);

  return [...sireAncestors].filter((ancestorId) => damAncestors.has(ancestorId))
    .length;
}

function coiTone(coiPercent: number | null) {
  if (coiPercent === null) return "text-purple-100/65";
  if (coiPercent <= 6.25) return "text-emerald-200";
  if (coiPercent <= 12.5) return "text-amber-200";
  return "font-bold text-red-200";
}

function coiLabel(coiPercent: number | null) {
  if (coiPercent === null) return "Pending";
  if (coiPercent <= 6.25) return "Lower COI";
  if (coiPercent <= 12.5) return "Moderate COI";
  return "Higher COI";
}

function complementCount(dam: DogCardDto | null, sire: DogCardDto) {
  if (!dam) return 0;

  return Object.keys(dam.visibleCategories).filter((key) => {
    const damDistance = Math.abs((dam.visibleCategories[key] ?? 10) - 10);
    const sireDistance = Math.abs((sire.visibleCategories[key] ?? 10) - 10);
    return damDistance >= 2 && sireDistance < damDistance;
  }).length;
}

function sireRecommendationScore(
  sire: DogCardDto,
  dam: DogCardDto | null,
  pedigree: PedigreeDog[]
) {
  const coi = pairingCoi(sire, dam, pedigree)?.coiPercent ?? 0;
  const healthBonus = hasAllGreenPhenotypeHealthTests(sire.healthTests) ? 35 : 0;
  const coiScore = Math.max(0, 30 - coi * 2);
  const complementBonus = complementCount(dam, sire) * 4;
  const feePenalty = (sire.studFeeAmount ?? 0) / 500;

  return healthBonus + coiScore + complementBonus - feePenalty;
}

function DogName({ dog }: { dog: DogCardDto }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{dogDisplayName(dog)}</span>
      {hasAllGreenPhenotypeHealthTests(dog.healthTests) ? (
        <HealthClearBadge />
      ) : null}
    </div>
  );
}

function HealthSummary({ dog, compact = false }: { dog: DogCardDto; compact?: boolean }) {
  const tests = latestHealthTests(dog);

  return (
    <div className={compact ? "mt-3 grid gap-1.5" : "grid gap-2"}>
      {tests.map(({ testTypeCode, result }) => {
        const definition =
          PHENOTYPE_HEALTH_TESTS[testTypeCode as PhenotypeHealthTestCode];

        if (!result) {
          return (
            <div
              key={testTypeCode}
              className="flex items-center justify-between gap-2 text-xs text-purple-100/50"
            >
              <span>{definition.label}</span>
              <span>Not tested</span>
            </div>
          );
        }

        const severity = getPhenotypeHealthSeverity(
          result.testTypeCode,
          result.resultCode
        );

        return (
          <div
            key={testTypeCode}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-purple-100/70">{definition.label}</span>
            <span
              className={`rounded-full border px-2 py-0.5 ${HEALTH_TONES[severity]}`}
            >
              {getPhenotypeHealthResultLabel(
                testTypeCode as PhenotypeHealthTestCode,
                result.resultCode
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DogOptionCard({
  dog,
  currentEpoch,
  selected,
  pairingDam,
  pedigree,
  shortlisted,
  onSelect,
  onToggleShortlist,
}: {
  dog: DogCardDto;
  currentEpoch: number;
  selected: boolean;
  pairingDam?: DogCardDto | null;
  pedigree: PedigreeDog[];
  shortlisted?: boolean;
  onSelect: () => void;
  onToggleShortlist?: () => void;
}) {
  const unavailable = reasonDogUnavailable(dog, currentEpoch);
  const projectedCoi =
    dog.sex === "M" && pairingDam ? pairingCoi(dog, pairingDam, pedigree) : null;

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        selected
          ? "border-purple-300/70 bg-purple-500/20"
          : unavailable
            ? "border-white/10 bg-black/15 opacity-70"
            : "border-white/10 bg-black/20 hover:border-purple-300/45"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">
            <DogName dog={dog} />
          </div>
          <div className="mt-1 text-xs text-purple-100/55">{dog.regNumber}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] font-semibold text-purple-100/75">
          {dog.isOwnedByCurrentKennel ? "My Kennel" : "Public Stud"}
        </span>
      </div>

      <div className="mt-3 grid gap-1 text-xs text-purple-100/70 sm:grid-cols-2">
        <span>Age: {ageLabel(dog.ageHours)}</span>
        <span className={coiTone(dog.coiPercent)}>
          Dog COI: {dog.coiPercent === null ? "Pending" : `${dog.coiPercent.toFixed(2)}%`}
        </span>
        {!dog.isOwnedByCurrentKennel ? (
          <>
            <span>Owner: {dog.ownerKennelName ?? "Player Kennel"}</span>
            <span>Stud fee: {formatMoney(dog.studFeeAmount ?? 0)}</span>
          </>
        ) : null}
        {projectedCoi ? (
          <span className={coiTone(projectedCoi.coiPercent)}>
            Litter COI: {projectedCoi.coiPercent.toFixed(2)}%
          </span>
        ) : null}
        {dog.sex === "F" && dog.lastLitterEpoch !== null ? (
          <span>Last litter: {formatGameDate(dog.lastLitterEpoch)}</span>
        ) : null}
      </div>

      <HealthSummary dog={dog} compact />

      {unavailable ? (
        <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">
          {unavailable}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSelect}
          disabled={Boolean(unavailable)}
          className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected ? "Selected" : "Select"}
        </button>
        <Link
          href={`/dogs/${dog.id}`}
          target="_blank"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-purple-100 transition hover:bg-white/10"
        >
          Profile
        </Link>
        {onToggleShortlist ? (
          <button
            type="button"
            onClick={onToggleShortlist}
            className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/20"
          >
            {shortlisted ? "Unpin" : "Compare"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TraitOutlook({ dam, sire }: { dam: DogCardDto; sire: DogCardDto }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.14em] text-purple-200/70">
            <th className="px-3 py-2">Visible Category</th>
            <th className="px-3 py-2 text-right">Dam</th>
            <th className="px-3 py-2 text-right">Sire</th>
            <th className="px-3 py-2 text-right">Estimated Puppy Range</th>
            <th className="px-3 py-2">Outlook</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(dam.visibleCategories).map(([key, damValue]) => {
            const sireValue = sire.visibleCategories[key] ?? damValue;
            const midpoint = (damValue + sireValue) / 2;
            const low = Math.max(0, midpoint - 2);
            const high = Math.min(20, midpoint + 2);
            const parentBest = Math.min(
              Math.abs(damValue - 10),
              Math.abs(sireValue - 10)
            );
            const outlook =
              Math.abs(midpoint - 10) <= 1.5
                ? "Likely strength"
                : parentBest < Math.abs(damValue - 10)
                  ? "Sire complements dam"
                  : Math.abs(damValue - sireValue) >= 4
                    ? "Variable"
                    : "Watch closely";

            return (
              <tr key={key} className="border-t border-white/10">
                <td className="px-3 py-2 text-purple-100/80">
                  {formatCategoryName(key)}
                </td>
                <td className="px-3 py-2 text-right text-white">
                  {damValue.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right text-white">
                  {sireValue.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-100">
                  {low.toFixed(1)} - {high.toFixed(1)}
                </td>
                <td className="px-3 py-2 text-purple-100/70">{outlook}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-5 text-purple-100/50">
        Puppy ranges are planning estimates from visible parental categories.
        Individual puppies still vary.
      </p>
    </div>
  );
}

function PairingAnalysis({
  kennelBalance,
  dam,
  sire,
  pedigree,
  submitting,
  redirecting,
  errorMessage,
  successMessage,
  onSubmit,
}: {
  kennelBalance: number;
  dam: DogCardDto;
  sire: DogCardDto;
  pedigree: PedigreeDog[];
  submitting: boolean;
  redirecting: boolean;
  errorMessage: string;
  successMessage: string;
  onSubmit: () => void;
}) {
  const coi = pairingCoi(sire, dam, pedigree);
  const totalCost = BREEDING_FEE + (sire.studFeeAmount ?? 0);
  const bothHealthClear =
    hasAllGreenPhenotypeHealthTests(dam.healthTests) &&
    hasAllGreenPhenotypeHealthTests(sire.healthTests);
  const sharedAncestors = sharedAncestorCount(sire, dam, pedigree);
  const cues = [
    {
      label: coiLabel(coi?.coiPercent ?? null),
      tone: coiTone(coi?.coiPercent ?? null),
    },
    {
      label:
        sharedAncestors === 0
          ? "No shared ancestors found in the calculated pedigree"
          : `${sharedAncestors} shared ancestor${sharedAncestors === 1 ? "" : "s"} found in the calculated pedigree`,
      tone: sharedAncestors === 0 ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: bothHealthClear
        ? "Both parents have all-green phenotype tests"
        : "Review health results before confirming",
      tone: bothHealthClear ? "text-emerald-200" : "text-amber-200",
    },
    {
      label: `${complementCount(dam, sire)} visible trait categories complemented by sire`,
      tone: "text-sky-100",
    },
    {
      label: sire.isOwnedByCurrentKennel
        ? "Owned sire: no stud fee"
        : `Public stud fee: ${formatMoney(sire.studFeeAmount ?? 0)}`,
      tone: "text-purple-100/80",
    },
  ];

  return (
    <section className="mt-8 rounded-[28px] border border-purple-300/20 bg-[linear-gradient(180deg,rgba(42,22,58,0.98),rgba(20,10,30,0.98))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
            Step 3
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Pairing Preview
          </h2>
          <p className="mt-2 text-sm text-purple-100/70">
            Review the litter plan before confirming the breeding.
          </p>
        </div>
        <div className={`text-right ${coiTone(coi?.coiPercent ?? null)}`}>
          <div className="text-xs uppercase tracking-wide">Estimated litter COI</div>
          <div className="mt-1 text-3xl font-bold">
            {coi ? `${coi.coiPercent.toFixed(2)}%` : "Pending"}
          </div>
          {coi ? (
            <div className="text-xs">
              Calculated through {coi.generationDepth} generation
              {coi.generationDepth === 1 ? "" : "s"}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-purple-200">Dam</div>
          <div className="mt-2 font-semibold text-white"><DogName dog={dam} /></div>
          <div className="mt-3"><HealthSummary dog={dam} /></div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs uppercase tracking-wide text-purple-200">Sire</div>
          <div className="mt-2 font-semibold text-white"><DogName dog={sire} /></div>
          <div className="mt-3"><HealthSummary dog={sire} /></div>
        </div>
        <aside className="rounded-2xl border border-purple-300/20 bg-white/5 p-4">
          <h3 className="font-semibold text-white">Plan Summary</h3>
          <div className="mt-4 space-y-2 text-sm text-purple-100/75">
            <div className="flex justify-between gap-3">
              <span>Breeding fee</span><span>{formatMoney(BREEDING_FEE)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Stud fee</span><span>{formatMoney(sire.studFeeAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold text-white">
              <span>Total</span><span>{formatMoney(totalCost)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Balance after</span>
              <span>{formatMoney(kennelBalance - totalCost)}</span>
            </div>
            <div className="border-t border-white/10 pt-2">
              Pregnancy check in about {USUAL_PREG_CHECK_DAYS} game days
            </div>
            <div>Expected litter in about {USUAL_GESTATION_DAYS} game days</div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {successMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || redirecting || kennelBalance < totalCost}
            className="mt-4 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {redirecting
              ? "Confirmed"
              : submitting
                ? "Creating Breeding..."
                : "Confirm Litter Plan"}
          </button>
        </aside>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white">Planning Notes</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {cues.map((cue) => (
            <div key={cue.label} className={`text-sm ${cue.tone}`}>
              {cue.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
        <h3 className="font-semibold text-white">Visible Trait Outlook</h3>
        <TraitOutlook dam={dam} sire={sire} />
      </div>
    </section>
  );
}

function Shortlist({
  dam,
  sires,
  pedigree,
}: {
  dam: DogCardDto | null;
  sires: DogCardDto[];
  pedigree: PedigreeDog[];
}) {
  if (!dam || sires.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-500/5 p-4">
      <h3 className="font-semibold text-white">Pinned Sire Comparison</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-purple-200/70">
              <th className="px-3 py-2">Sire</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2 text-right">Litter COI</th>
              <th className="px-3 py-2 text-right">Stud Fee</th>
              <th className="px-3 py-2 text-right">Complements</th>
            </tr>
          </thead>
          <tbody>
            {sires.map((sire) => {
              const coi = pairingCoi(sire, dam, pedigree);

              return (
                <tr key={sire.id} className="border-t border-white/10">
                  <td className="px-3 py-2 font-semibold text-white">
                    <DogName dog={sire} />
                  </td>
                  <td className="px-3 py-2 text-purple-100/70">
                    {sire.isOwnedByCurrentKennel ? "My Kennel" : "Public Stud"}
                  </td>
                  <td className={`px-3 py-2 text-right ${coiTone(coi?.coiPercent ?? null)}`}>
                    {coi ? `${coi.coiPercent.toFixed(2)}%` : "Pending"}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-100/80">
                    {formatMoney(sire.studFeeAmount ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-right text-sky-100">
                    {complementCount(dam, sire)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function BreedPageClient({
  kennelName,
  kennelBalance,
  currentEpoch,
  pedigree,
  dogs,
  initialDogId,
  initialStudListingId,
}: Props) {
  const router = useRouter();
  const initialDog =
    dogs.find((dog) => dog.id === initialDogId && dog.isOwnedByCurrentKennel) ??
    null;
  const initialStud =
    dogs.find((dog) => dog.studListingId === initialStudListingId) ?? null;
  const initialBreedCode = initialDog?.breedCode2 ?? initialStud?.breedCode2 ?? "";
  const [breedCode2, setBreedCode2] = useState(initialBreedCode);
  const [damId, setDamId] = useState(initialDog?.sex === "F" ? initialDog.id : "");
  const [sireId, setSireId] = useState(
    initialDog?.sex === "M" ? initialDog.id : initialStud?.id ?? ""
  );
  const [sireSource, setSireSource] = useState<SireSource>("ALL");
  const [sireSort, setSireSort] = useState<SireSort>("RECOMMENDED");
  const [shortlistedSireIds, setShortlistedSireIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const breeds = useMemo(() => {
    const breedByCode = new Map<string, string>();

    for (const dog of dogs) {
      breedByCode.set(dog.breedCode2, dog.breedName);
    }

    return [...breedByCode.entries()]
      .map(([code2, name]) => ({ code2, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dogs]);

  const selectedDam = dogs.find((dog) => dog.id === damId) ?? null;
  const selectedSire = dogs.find((dog) => dog.id === sireId) ?? null;
  const dams = useMemo(
    () =>
      dogs
        .filter(
          (dog) =>
            dog.isOwnedByCurrentKennel &&
            dog.sex === "F" &&
            dog.breedCode2 === breedCode2
        )
        .sort((a, b) => b.ageHours - a.ageHours),
    [breedCode2, dogs]
  );
  const sires = useMemo(() => {
    const candidates = dogs.filter(
      (dog) =>
        dog.sex === "M" &&
        dog.breedCode2 === breedCode2 &&
        (dog.isOwnedByCurrentKennel || Boolean(dog.studListingId)) &&
        (sireSource === "ALL" ||
          (sireSource === "OWNED" && dog.isOwnedByCurrentKennel) ||
          (sireSource === "PUBLIC" && !dog.isOwnedByCurrentKennel))
    );

    return candidates.sort((a, b) => {
      if (sireSort === "LOWEST_COI") {
        return (
          (pairingCoi(a, selectedDam, pedigree)?.coiPercent ?? 0) -
          (pairingCoi(b, selectedDam, pedigree)?.coiPercent ?? 0)
        );
      }
      if (sireSort === "HEALTH") {
        return (
          Number(hasAllGreenPhenotypeHealthTests(b.healthTests)) -
          Number(hasAllGreenPhenotypeHealthTests(a.healthTests))
        );
      }
      if (sireSort === "FEE") {
        return (a.studFeeAmount ?? 0) - (b.studFeeAmount ?? 0);
      }

      return (
        sireRecommendationScore(b, selectedDam, pedigree) -
        sireRecommendationScore(a, selectedDam, pedigree)
      );
    });
  }, [breedCode2, dogs, pedigree, selectedDam, sireSort, sireSource]);
  const shortlistedSires = shortlistedSireIds
    .map((id) => dogs.find((dog) => dog.id === id))
    .filter((dog): dog is DogCardDto => Boolean(dog));

  function chooseBreed(nextBreedCode: string) {
    setBreedCode2(nextBreedCode);

    if (selectedDam?.breedCode2 !== nextBreedCode) setDamId("");
    if (selectedSire?.breedCode2 !== nextBreedCode) setSireId("");
    setShortlistedSireIds([]);
  }

  function toggleShortlist(sireIdToToggle: string) {
    setShortlistedSireIds((current) => {
      if (current.includes(sireIdToToggle)) {
        return current.filter((id) => id !== sireIdToToggle);
      }

      return current.length >= 3 ? [...current.slice(1), sireIdToToggle] : [...current, sireIdToToggle];
    });
  }

  async function handleSubmit() {
    if (!selectedSire || !selectedDam) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/breedings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryDogId: selectedSire.id,
          mateDogId: selectedDam.id,
          studListingId: selectedSire.studListingId,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.ok) {
        setErrorMessage(data?.error ?? "Breeding could not be created.");
        return;
      }

      setRedirecting(true);
      setSuccessMessage("Confirmed. Returning to the dam's page...");
      window.setTimeout(() => router.push(`/dogs/${selectedDam.id}`), 900);
    } catch {
      setErrorMessage("Something went wrong while creating the breeding.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <section className="rounded-[28px] border border-purple-300/20 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
              Step 1
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Choose A Breed
            </h2>
            <p className="mt-2 text-sm text-purple-100/70">
              Parent choices and planning tools appear after you select a breed.
            </p>
          </div>
          <label className="grid min-w-[280px] gap-2 text-sm text-purple-100/75">
            Breed
            <select
              value={breedCode2}
              onChange={(event) => chooseBreed(event.target.value)}
              className="rounded-xl border border-purple-300/25 bg-black/35 px-4 py-3 font-semibold text-white outline-none"
            >
              <option value="">Choose a breed...</option>
              {breeds.map((breed) => (
                <option key={breed.code2} value={breed.code2}>
                  {breed.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {breedCode2 ? (
        <>
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Step 2A
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">Choose Dam</h2>
              <p className="mt-2 text-sm text-purple-100/70">
                Your kennel&apos;s females, including clear explanations when a dam is unavailable.
              </p>
              <div className="mt-5 space-y-3">
                {dams.length > 0 ? (
                  dams.map((dog) => (
                    <DogOptionCard
                      key={dog.id}
                      dog={dog}
                      currentEpoch={currentEpoch}
                      selected={dog.id === damId}
                      pedigree={pedigree}
                      onSelect={() => setDamId(dog.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/65">
                    No females of this breed are currently in your kennel.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                    Step 2B
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Choose Sire</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "OWNED", "PUBLIC"] as const).map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setSireSource(source)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        sireSource === source
                          ? "border-sky-300/50 bg-sky-500/20 text-sky-100"
                          : "border-white/10 bg-white/5 text-purple-100/70"
                      }`}
                    >
                      {source === "OWNED" ? "My Kennel" : source === "PUBLIC" ? "Public Studs" : "All"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="mt-4 grid gap-2 text-xs uppercase tracking-wide text-purple-200/70">
                Sort Sires
                <select
                  value={sireSort}
                  onChange={(event) => setSireSort(event.target.value as SireSort)}
                  className="rounded-xl border border-purple-300/20 bg-black/35 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none"
                >
                  <option value="RECOMMENDED">Recommended</option>
                  <option value="LOWEST_COI">Lowest Litter COI</option>
                  <option value="HEALTH">Health Clear First</option>
                  <option value="FEE">Lowest Stud Fee</option>
                </select>
              </label>
              <div className="mt-5 space-y-3">
                {sires.length > 0 ? (
                  sires.map((dog) => (
                    <DogOptionCard
                      key={`${dog.id}-${dog.studListingId ?? "owned"}`}
                      dog={dog}
                      currentEpoch={currentEpoch}
                      selected={dog.id === sireId}
                      pairingDam={selectedDam}
                      pedigree={pedigree}
                      shortlisted={shortlistedSireIds.includes(dog.id)}
                      onSelect={() => setSireId(dog.id)}
                      onToggleShortlist={() => toggleShortlist(dog.id)}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-purple-100/65">
                    No sires match this breed and source filter.
                  </div>
                )}
              </div>
            </div>
          </section>

          <Shortlist dam={selectedDam} sires={shortlistedSires} pedigree={pedigree} />

          {selectedDam && selectedSire ? (
            <PairingAnalysis
              kennelBalance={kennelBalance}
              dam={selectedDam}
              sire={selectedSire}
              pedigree={pedigree}
              submitting={submitting}
              redirecting={redirecting}
              errorMessage={errorMessage}
              successMessage={successMessage}
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-purple-100/70">
              Select a dam and sire to unlock the full pairing preview.
            </div>
          )}
        </>
      ) : null}

      <div className="mt-6 text-xs text-purple-100/50">
        Planning for {kennelName}. Pairing estimates support breeder judgment and do not guarantee individual puppy outcomes.
      </div>
    </div>
  );
}
